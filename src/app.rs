//! The single owner of application state. This is where the SolidJS provider
//! tree ends up: every provider becomes a field, every `useQuery` becomes a
//! [`Query`] fed by a background task, every `onMount` registration becomes an
//! explicit register/unregister call.

use ratatui::layout::Rect;
use serde_json::Value as JsonValue;
use sqlx::PgPool;
use std::collections::VecDeque;
use tokio::sync::mpsc::UnboundedSender;

use crate::commands::command_line::CommandLine;
use crate::commands::messages::Messages;
use crate::commands::parse::{expand_variables, parse_command, CommandVariables, ParsedCommand};
use crate::commands::{ArgSpec, ArgValue, Command, Commands};
use crate::config::{self, Configuration};
use crate::db::{self, ColumnInfo, JsonRow};
use crate::keybinds::{Keybind, Keybinds};
use crate::picker::{Picker, PickerAction, PickerItem};
use crate::state::PersistedState;
use crate::table::layout::ColumnLayout;
use crate::table::render::visible_rows;
use crate::table::sql::extract_table_from_sql;
use crate::table::Table;

/// Port of the `useQuery` states the UI switched on.
#[derive(Debug, Default)]
pub enum Query<T> {
    #[default]
    Idle,
    Loading,
    Ready(T),
    Failed(String),
}

impl<T> Query<T> {
    pub fn is_loading(&self) -> bool {
        matches!(self, Query::Loading)
    }

    pub fn data(&self) -> Option<&T> {
        match self {
            Query::Ready(data) => Some(data),
            _ => None,
        }
    }

    pub fn error(&self) -> Option<&str> {
        match self {
            Query::Failed(error) => Some(error),
            _ => None,
        }
    }
}

/// Results of background work, delivered to the event loop.
pub enum Msg {
    Connected {
        url: String,
        result: Result<PgPool, String>,
    },
    Rows {
        key: String,
        result: Result<Vec<JsonRow>, String>,
    },
    Structure {
        key: String,
        result: Result<Vec<ColumnInfo>, String>,
    },
    Count {
        key: String,
        result: Result<i64, String>,
    },
    Tables(Result<Vec<String>, String>),
    Schemas(Result<Vec<String>, String>),
    Databases(Result<Vec<String>, String>),
    Executed(Result<(), String>),
    ConfigChanged,
}

pub struct App {
    pub config: Configuration,
    pub state: PersistedState,
    pub keybinds: Keybinds,
    pub commands: Commands,
    pub messages: Messages,

    pub pool: Option<PgPool>,
    pub connecting: bool,
    pub connection_error: Option<String>,

    pub rows: Query<Vec<JsonRow>>,
    pub structure: Query<Vec<ColumnInfo>>,
    pub count: Option<i64>,
    pub table: Option<Table>,
    pub layout: ColumnLayout,

    pub picker: Option<Picker>,
    pub command_line: Option<CommandLine>,

    /// Area the table is drawn into, refreshed every frame — the equivalent of
    /// measuring the canvas container.
    pub viewport: Rect,
    pub should_quit: bool,

    tx: UnboundedSender<Msg>,
    inflight: usize,
    pending_commands: VecDeque<ParsedCommand>,
    /// The hop query the loaded data belongs to.
    loaded_key: Option<String>,
}

impl App {
    pub fn new(tx: UnboundedSender<Msg>) -> Self {
        let (config, config_error) = config::load();

        let mut app = Self {
            keybinds: Keybinds::new(&config.leader_key),
            config,
            state: PersistedState::load(),
            commands: Commands::default(),
            messages: Messages::default(),
            pool: None,
            connecting: false,
            connection_error: None,
            rows: Query::Idle,
            structure: Query::Idle,
            count: None,
            table: None,
            layout: ColumnLayout::default(),
            picker: None,
            command_line: None,
            viewport: Rect::default(),
            should_quit: false,
            tx,
            inflight: 0,
            pending_commands: VecDeque::new(),
            loaded_key: None,
        };

        if let Some(error) = config_error {
            app.messages.error(error);
        }

        app.register_commands();
        app.apply_config();
        app
    }

    pub fn schema(&self) -> String {
        self.state.schema.clone().unwrap_or_else(|| "public".into())
    }

    // ---------------------------------------------------------------- config

    /// Port of the `createWatcher(config, ...)` effect in `KeybindProvider`:
    /// drop every config keybind and register the new set.
    fn apply_config(&mut self) {
        if let Err(error) = self.keybinds.set_leader_key(&self.config.leader_key) {
            self.messages.error(error);
        }

        self.keybinds.clear_config();

        let keybinds: Vec<Keybind> = self
            .config
            .keybinds
            .iter()
            .map(|(expression, entry)| {
                let mut keybind = Keybind::new(entry.command(), expression);
                keybind.description = entry.description().map(str::to_string);
                keybind
            })
            .collect();

        for keybind in keybinds {
            if let Err(error) = self.keybinds.register_config(&keybind) {
                self.messages.error(format!(
                    "Invalid keybind \"{}\": {error}",
                    keybind.keybind_expression
                ));
            }
        }
    }

    fn reload_config(&mut self) {
        let (config, error) = config::load();
        self.config = config;
        self.apply_config();

        match error {
            Some(error) => self.messages.error(error),
            None => self.messages.info("Reloaded configuration"),
        }
    }

    // ------------------------------------------------------------ connection

    pub fn connect(&mut self) {
        let Some(url) = self.state.database_url.clone() else {
            return;
        };

        let (url, _database) = match db::credentials(&url) {
            Ok(credentials) => credentials,
            Err(error) => {
                self.connection_error = Some(format!("Invalid database url: {error}"));
                return;
            }
        };

        self.connecting = true;
        self.connection_error = None;
        self.state.database_url = Some(url.clone());

        self.spawn(async move {
            let result = db::connect(&url).await.map_err(|e| e.to_string());
            Msg::Connected { url, result }
        });
    }

    /// Port of `setActiveUrl`: forget everything tied to the old connection.
    pub fn set_active_url(&mut self, url: &str) {
        self.state.clear_hops();
        self.state.schema = None;
        self.table = None;
        self.rows = Query::Idle;
        self.structure = Query::Idle;
        self.count = None;
        self.loaded_key = None;
        self.pool = None;
        self.state.database_url = Some(url.to_string());

        if !self.state.saved_urls.iter().any(|u| u == url) {
            self.state.saved_urls.push(url.to_string());
        }

        self.state.save();
        self.connect();
    }

    // ----------------------------------------------------------- async tasks

    fn spawn<F>(&mut self, future: F)
    where
        F: std::future::Future<Output = Msg> + Send + 'static,
    {
        self.inflight += 1;
        let tx = self.tx.clone();
        tokio::spawn(async move {
            let _ = tx.send(future.await);
        });
    }

    pub fn is_busy(&self) -> bool {
        self.inflight > 0
    }

    pub fn on_msg(&mut self, msg: Msg) {
        if !matches!(msg, Msg::ConfigChanged) {
            self.inflight = self.inflight.saturating_sub(1);
        }

        match msg {
            Msg::ConfigChanged => self.reload_config(),

            Msg::Connected { url, result } => {
                self.connecting = false;
                match result {
                    Ok(pool) => {
                        self.pool = Some(pool);
                        self.connection_error = None;
                        if self.state.current_hop().is_some() {
                            self.load_current_hop();
                        } else {
                            // Port of Router's InitialQuery -> pickTable()
                            self.load_tables();
                        }
                    }
                    Err(error) => {
                        self.connection_error = Some(error);
                        self.state.database_url = Some(url);
                    }
                }
            }

            Msg::Rows { key, result } => {
                if self.loaded_key.as_deref() != Some(&key) {
                    return;
                }
                match result {
                    Ok(rows) => self.rows = Query::Ready(rows),
                    Err(error) => self.fail_current_hop(error),
                }
                self.try_build_table();
            }

            Msg::Structure { key, result } => {
                if self.loaded_key.as_deref() != Some(&key) {
                    return;
                }
                match result {
                    Ok(structure) => self.structure = Query::Ready(structure),
                    Err(error) => self.fail_current_hop(error),
                }
                self.try_build_table();
            }

            Msg::Count { key, result } => {
                if self.loaded_key.as_deref() == Some(&key) {
                    self.count = result.ok();
                }
            }

            Msg::Tables(result) => self.open_list_picker(PickerAction::PickTable, '▤', result),
            Msg::Schemas(result) => self.open_list_picker(PickerAction::PickSchema, '□', result),
            Msg::Databases(result) => {
                self.open_list_picker(PickerAction::PickDatabase, '⛁', result)
            }

            Msg::Executed(result) => match result {
                Ok(()) => self.reload_table(),
                Err(error) => self.messages.error(error),
            },
        }
    }

    /// Port of `PopCurrentHop`: report and step back out of the failed query.
    fn fail_current_hop(&mut self, error: String) {
        self.messages.error(error.clone());
        self.rows = Query::Failed(error.clone());
        self.structure = Query::Failed(error);
        self.loaded_key = None;

        if self.state.hops.len() > 1 {
            self.state.pop_hop();
            self.load_current_hop();
        }
    }

    // -------------------------------------------------------------- querying

    fn open_list_picker(
        &mut self,
        action: PickerAction,
        icon: char,
        result: Result<Vec<String>, String>,
    ) {
        match result {
            Ok(values) => self.open_picker(
                action,
                values
                    .into_iter()
                    .map(|value| PickerItem {
                        label: value.clone(),
                        value,
                        icon: Some(icon),
                    })
                    .collect(),
            ),
            Err(error) => self.messages.error(error),
        }
    }

    pub fn load_schemas(&mut self) {
        let Some(pool) = self.pool.clone() else {
            return;
        };
        self.spawn(
            async move { Msg::Schemas(db::schemas(&pool).await.map_err(|e| e.to_string())) },
        );
    }

    pub fn load_databases(&mut self) {
        let Some(pool) = self.pool.clone() else {
            return;
        };
        self.spawn(
            async move { Msg::Databases(db::databases(&pool).await.map_err(|e| e.to_string())) },
        );
    }

    /// Saved urls need no query — they come straight out of the persisted state.
    pub fn open_url_picker(&mut self) {
        let items: Vec<PickerItem> = self
            .state
            .saved_urls
            .clone()
            .into_iter()
            .map(|url| {
                let label = url::Url::parse(&url)
                    .map(|u| format!("{}{}", u.host_str().unwrap_or_default(), u.path()))
                    .unwrap_or_else(|_| url.clone());
                PickerItem {
                    value: url,
                    label,
                    icon: Some('⇄'),
                }
            })
            .collect();

        self.open_picker(PickerAction::PickUrl, items);
    }

    pub fn load_tables(&mut self) {
        let Some(pool) = self.pool.clone() else {
            return;
        };
        let schema = self.schema();

        self.spawn(async move {
            Msg::Tables(db::tables(&pool, &schema).await.map_err(|e| e.to_string()))
        });
    }

    /// Port of `SqlQueryPage`: fetch rows, structure and the row count for the
    /// current hop.
    pub fn load_current_hop(&mut self) {
        let Some(pool) = self.pool.clone() else {
            return;
        };
        let Some(hop) = self.state.current_hop() else {
            return;
        };

        let query = hop.query.clone();
        let key = query.clone();
        self.loaded_key = Some(key.clone());
        self.rows = Query::Loading;
        self.count = None;

        {
            let pool = pool.clone();
            let query = query.clone();
            let key = key.clone();
            self.spawn(async move {
                Msg::Rows {
                    key,
                    result: db::select(&pool, &query, Vec::new())
                        .await
                        .map_err(|e| e.to_string()),
                }
            });
        }

        let extracted = extract_table_from_sql(&query);
        let schema = extracted
            .as_ref()
            .and_then(|e| e.schema.clone())
            .unwrap_or_else(|| self.schema());

        match extracted.as_ref().map(|e| e.table.clone()) {
            Some(table_name) => {
                self.structure = Query::Loading;
                {
                    let pool = pool.clone();
                    let key = key.clone();
                    let schema = schema.clone();
                    let table_name = table_name.clone();
                    self.spawn(async move {
                        Msg::Structure {
                            key,
                            result: db::table_structure(&pool, &schema, &table_name)
                                .await
                                .map_err(|e| e.to_string()),
                        }
                    });
                }

                let key = key.clone();
                self.spawn(async move {
                    Msg::Count {
                        key,
                        result: db::count(&pool, &schema, &table_name)
                            .await
                            .map_err(|e| e.to_string()),
                    }
                });
            }
            // No table could be parsed out of the query — the columns get
            // inferred from the result instead.
            None => self.structure = Query::Ready(Vec::new()),
        }
    }

    pub fn reload_table(&mut self) {
        self.load_current_hop();
    }

    /// Port of the `structure()` memo in `SqlQueryPage`: prefer the catalog,
    /// narrow it to the selected columns, otherwise infer from the first row.
    fn try_build_table(&mut self) {
        let (Some(rows), Some(structure)) = (self.rows.data(), self.structure.data()) else {
            return;
        };
        let Some(hop) = self.state.current_hop() else {
            return;
        };

        let extracted = extract_table_from_sql(&hop.query);
        let table_name = extracted
            .as_ref()
            .map(|e| e.table.clone())
            .unwrap_or_default();

        let structure: Vec<ColumnInfo> = if structure.is_empty() {
            infer_structure(rows.first())
        } else {
            match extracted.as_ref().and_then(|e| e.columns.as_ref()) {
                // null/undefined columns means SELECT * - return all columns
                None => structure.clone(),
                Some(columns) => structure
                    .iter()
                    .filter(|s| columns.iter().any(|c| c.name == s.column_name))
                    .cloned()
                    .collect(),
            }
        };

        let table = Table::new(table_name, &structure, rows);
        self.layout = ColumnLayout::compute(&table);
        self.table = Some(table);
        self.clamp_cursor();
    }

    // ---------------------------------------------------------------- cursor

    fn max_row(&self) -> usize {
        self.table
            .as_ref()
            .map(|t| t.rows().len().saturating_sub(1))
            .unwrap_or(0)
    }

    fn max_column(&self) -> usize {
        self.table
            .as_ref()
            .map(|t| t.columns().len().saturating_sub(1))
            .unwrap_or(0)
    }

    pub fn cursor(&self) -> (usize, usize) {
        self.state
            .current_hop()
            .map(|h| (h.row_index, h.column_index))
            .unwrap_or((0, 0))
    }

    fn clamp_cursor(&mut self) {
        let (max_row, max_column) = (self.max_row(), self.max_column());
        if let Some(hop) = self.state.current_hop_mut() {
            hop.row_index = hop.row_index.min(max_row);
            hop.column_index = hop.column_index.min(max_column);
        }
        self.ensure_cursor_visible();
    }

    pub fn visible_row_count(&self) -> usize {
        visible_rows(self.viewport).max(1)
    }

    /// Half a page, like `numberOfVisibleRows` in the original.
    pub fn half_page(&self) -> usize {
        (self.visible_row_count() / 2).max(1)
    }

    fn move_row(&mut self, delta: isize) {
        let max = self.max_row();
        if let Some(hop) = self.state.current_hop_mut() {
            hop.row_index = hop.row_index.saturating_add_signed(delta).min(max);
        }
        self.ensure_cursor_visible();
    }

    fn move_column(&mut self, delta: isize) {
        let max = self.max_column();
        if let Some(hop) = self.state.current_hop_mut() {
            hop.column_index = hop.column_index.saturating_add_signed(delta).min(max);
        }
        self.ensure_cursor_visible();
    }

    fn set_row(&mut self, row: usize) {
        let max = self.max_row();
        if let Some(hop) = self.state.current_hop_mut() {
            hop.row_index = row.min(max);
        }
        self.ensure_cursor_visible();
    }

    fn set_column(&mut self, column: usize) {
        let max = self.max_column();
        if let Some(hop) = self.state.current_hop_mut() {
            hop.column_index = column.min(max);
        }
        self.ensure_cursor_visible();
    }

    /// Port of `ensureCellVisible`, in rows and columns instead of pixels.
    pub fn ensure_cursor_visible(&mut self) {
        let rows = self.visible_row_count();
        let width = self.viewport.width as usize;
        if width == 0 {
            return;
        }

        let layout = &self.layout;
        let Some(hop) = self.state.hops.last_mut() else {
            return;
        };

        if hop.row_index < hop.scroll_y {
            hop.scroll_y = hop.row_index;
        } else if hop.row_index >= hop.scroll_y + rows {
            hop.scroll_y = hop.row_index + 1 - rows;
        }

        hop.scroll_x = layout.scroll_to_show(hop.scroll_x, hop.column_index, width);
    }

    // -------------------------------------------------------------- commands

    fn variables(&self) -> CommandVariables {
        let mut variables = CommandVariables::new();

        // Registered by the data table in the original, so they only exist while
        // a table is on screen.
        let Some(table) = self.table.as_ref() else {
            return variables;
        };
        let (row, column_index) = self.cursor();

        variables.insert('%', format!("\"{}\"", table.name));

        if let Some(column) = table.column(column_index) {
            variables.insert('@', format!("\"{}\"", column.name));

            if let Some(cell) = table.cell(row, column_index) {
                variables.insert('&', cell.to_sql_value(column).unwrap_or_default());
            }
        }

        variables
    }

    pub fn trigger_command(&mut self, command_expression: &str) {
        let expanded = expand_variables(command_expression, &self.variables());
        self.pending_commands.extend(parse_command(&expanded));
        self.drain_pending();
    }

    /// Port of the `waitForQueries()` loop: piped commands run one at a time,
    /// each waiting for outstanding database work to land first.
    pub fn drain_pending(&mut self) {
        while !self.is_busy() {
            let Some(command) = self.pending_commands.pop_front() else {
                return;
            };
            self.execute_command(command);
        }
    }

    fn execute_command(&mut self, parsed: ParsedCommand) {
        let aliases = self.config.command_aliases.clone();

        let Some(command) = self.commands.get(&parsed.command_name, &aliases) else {
            self.messages
                .error(format!("Invalid command: \"{}\"", parsed.command_name));
            return;
        };

        let action = command.action;
        let args = match Commands::parse_args(command, &parsed.args) {
            Ok(args) => args,
            Err(error) => {
                self.messages.error(error);
                return;
            }
        };

        if let Err(error) = action(self, &args) {
            self.messages.error(error.to_string());
        }
    }

    // -------------------------------------------------------------- overlays

    pub fn open_picker(&mut self, action: PickerAction, items: Vec<PickerItem>) {
        if items.is_empty() {
            self.messages.info("Nothing to pick");
            return;
        }

        self.picker = Some(Picker::new(action, items));

        // Port of the picker's own `useRegisterKeybindCommandOnMount` calls
        self.register_scoped(vec![
            (
                Command::new("PickerClose", |app, _| {
                    app.close_picker();
                    Ok(())
                })
                .described("Close the picker dialog."),
                Keybind::new("PickerClose", "Escape").override_input(),
            ),
            (
                Command::new("PickerSelect", |app, _| {
                    app.accept_picker();
                    Ok(())
                })
                .described("Select the highlighted item in the picker."),
                Keybind::new("PickerSelect", "Enter").override_input(),
            ),
            (
                Command::new("PickerSelectNext", |app, _| {
                    if let Some(picker) = app.picker.as_mut() {
                        picker.select_next();
                    }
                    Ok(())
                })
                .described("Move to the next item in the picker."),
                Keybind::new("PickerSelectNext", "(Control + j) | ArrowDown").override_input(),
            ),
            (
                Command::new("PickerSelectPrev", |app, _| {
                    if let Some(picker) = app.picker.as_mut() {
                        picker.select_prev();
                    }
                    Ok(())
                })
                .described("Move to the previous item in the picker."),
                Keybind::new("PickerSelectPrev", "(Control + k) | ArrowUp").override_input(),
            ),
        ]);
    }

    pub fn close_picker(&mut self) {
        if self.picker.take().is_none() {
            return;
        }

        self.unregister_scoped(&[
            ("PickerClose", "Escape"),
            ("PickerSelect", "Enter"),
            ("PickerSelectNext", "(Control + j) | ArrowDown"),
            ("PickerSelectPrev", "(Control + k) | ArrowUp"),
        ]);
    }

    fn accept_picker(&mut self) {
        let Some(picker) = self.picker.as_mut() else {
            return;
        };
        let action = picker.action;
        let value = picker.selected_value();
        self.close_picker();

        let Some(value) = value else {
            self.messages.info("No table selected");
            return;
        };

        match action {
            PickerAction::PickTable => {
                let schema = self.schema();
                self.state
                    .add_hop(format!("SELECT * FROM \"{schema}\".\"{value}\" LIMIT 100;"));
                self.state.save();
                self.load_current_hop();
            }

            // Port of setSchemaAndClearHops: a new schema invalidates the hop
            // stack, which drops us back to picking a table.
            PickerAction::PickSchema => {
                self.state.schema = Some(value);
                self.state.clear_hops();
                self.table = None;
                self.state.save();
                self.load_tables();
            }

            PickerAction::PickDatabase => {
                let Some(current) = self.state.database_url.clone() else {
                    return;
                };
                match url::Url::parse(&current) {
                    Ok(mut url) => {
                        url.set_path(&value);
                        self.set_active_url(url.as_str());
                    }
                    Err(error) => self.messages.error(error.to_string()),
                }
            }

            PickerAction::PickUrl => self.set_active_url(&value),
        }
    }

    pub fn open_command_line(&mut self) {
        if self.command_line.is_some() {
            return;
        }

        self.messages.clear();
        self.command_line = Some(CommandLine::default());

        self.register_scoped(vec![
            (
                Command::new("CommandLineClose", |app, _| {
                    app.close_command_line();
                    Ok(())
                })
                .described("Close the command line."),
                Keybind::new("CommandLineClose", "Escape").override_input(),
            ),
            (
                Command::new("CommandLineClear", |app, _| {
                    if let Some(line) = app.command_line.as_mut() {
                        line.clear();
                    }
                    Ok(())
                })
                .described("Clear the command line input."),
                Keybind::new("CommandLineClear", "Control + c").override_input(),
            ),
            (
                Command::new("CommandAccept", |app, _| {
                    app.accept_command_line();
                    Ok(())
                })
                .described("Execute the current command."),
                Keybind::new("CommandAccept", "Enter").override_input(),
            ),
            (
                Command::new("CommandComplete", |app, _| {
                    app.complete_command_line();
                    Ok(())
                })
                .described("Autocomplete the current command."),
                Keybind::new("CommandComplete", "Tab").override_input(),
            ),
        ]);
    }

    pub fn close_command_line(&mut self) {
        if self.command_line.take().is_none() {
            return;
        }

        self.unregister_scoped(&[
            ("CommandLineClose", "Escape"),
            ("CommandLineClear", "Control + c"),
            ("CommandAccept", "Enter"),
            ("CommandComplete", "Tab"),
        ]);
    }

    fn complete_command_line(&mut self) {
        let aliases = self.config.command_aliases.clone();
        let Some(line) = self.command_line.as_mut() else {
            return;
        };

        let matches = line.matches(&self.commands, &aliases);
        if let [only] = matches.as_slice() {
            line.set(&format!("{only} "));
        }
    }

    fn accept_command_line(&mut self) {
        let Some(line) = self.command_line.as_ref() else {
            return;
        };
        let command = line.value().trim().to_string();

        self.close_command_line();

        if command.is_empty() {
            return;
        }

        self.state.command_history.retain(|c| c != &command);
        self.state.command_history.insert(0, command.clone());
        self.trigger_command(&command);
    }

    /// Registers a command together with its keybind, the pairing
    /// `useRegisterKeybindCommandOnMount` did.
    fn register_scoped(&mut self, entries: Vec<(Command, Keybind)>) {
        for (command, mut keybind) in entries {
            keybind.description = command.description.clone();
            if let Err(error) = self.keybinds.register(&keybind) {
                self.messages.error(error);
                continue;
            }
            self.commands.register(command);
        }
    }

    fn unregister_scoped(&mut self, entries: &[(&str, &str)]) {
        for (command, expression) in entries {
            self.keybinds.unregister(&Keybind::new(command, expression));
            self.commands.unregister(command);
        }
    }

    pub fn input_focused(&self) -> bool {
        self.command_line.is_some() || self.picker.is_some()
    }

    // ---------------------------------------------------- command definitions

    fn register_commands(&mut self) {
        let global: Vec<(Command, Option<&str>)> = vec![
            (
                Command::new("Quit", |app, _| {
                    app.should_quit = true;
                    Ok(())
                })
                .described("Quit tablezz."),
                Some("Control + q"),
            ),
            (
                Command::new("ReloadFull", |app, _| {
                    app.count = None;
                    app.load_current_hop();
                    app.messages.info("Reloaded all data");
                    Ok(())
                })
                .described("Reload all data from the database."),
                Some("Control + r"),
            ),
            (
                Command::new("ReloadTable", |app, _| {
                    app.reload_table();
                    app.messages.info("Reloaded table data");
                    Ok(())
                })
                .described("Reload the current table data."),
                Some("r"),
            ),
            (
                Command::new("CommandLineActivate", |app, _| {
                    app.open_command_line();
                    Ok(())
                })
                .described("Open the command line."),
                Some(":"),
            ),
            (
                Command::new("PickerOpen", |app, args| {
                    match args.first().and_then(ArgValue::as_str) {
                        Some("schemas") => app.load_schemas(),
                        Some("databases") => app.load_databases(),
                        Some("urls") => app.open_url_picker(),
                        _ => app.load_tables(),
                    }
                    Ok(())
                })
                .described("Open the picker to pick items")
                .args(vec![ArgSpec::one_of(
                    "<type>",
                    &["tables", "schemas", "databases", "urls"],
                )
                .with_default("tables")]),
                Some("Leader > Space"),
            ),
            (
                Command::new("SqlSelect", |app, args| {
                    let Some(sql) = args.first().and_then(ArgValue::as_str) else {
                        return Ok(());
                    };
                    app.state.add_hop(sql.to_string());
                    app.state.save();
                    app.load_current_hop();
                    Ok(())
                })
                .described("Run a custom SQL select query and display the results.")
                .args(vec![ArgSpec::string("<sql>")]),
                None,
            ),
            (
                Command::new("SqlExecute", |app, args| {
                    let Some(sql) = args.first().and_then(ArgValue::as_str) else {
                        return Ok(());
                    };
                    let Some(pool) = app.pool.clone() else {
                        return Ok(());
                    };
                    let sql = sql.to_string();
                    app.spawn(async move {
                        Msg::Executed(
                            db::raw_execute(&pool, &sql)
                                .await
                                .map_err(|e| e.to_string()),
                        )
                    });
                    Ok(())
                })
                .described("Execute a SQL statement without returning results.")
                .args(vec![ArgSpec::string("<sql>")]),
                None,
            ),
            (
                Command::new("GoBackward", |app, _| {
                    app.state.pop_hop();
                    app.state.save();
                    app.load_current_hop();
                    Ok(())
                })
                .described("Go back to the previous query."),
                Some("Control + o"),
            ),
            (
                Command::new("DatabaseUrlAdd", |app, args| {
                    if let Some(url) = args.first().and_then(ArgValue::as_str) {
                        let url = url.to_string();
                        app.set_active_url(&url);
                    }
                    Ok(())
                })
                .described("Set the database connection URL and save it.")
                .args(vec![ArgSpec::url("<url>")]),
                None,
            ),
            (
                Command::new("DatabaseUrlClear", |app, _| {
                    app.state.database_url = None;
                    app.pool = None;
                    app.table = None;
                    app.state.clear_hops();
                    app.state.save();
                    Ok(())
                })
                .described("Clear the current database connection URL."),
                None,
            ),
            (
                Command::new("DatabaseUrlRemove", |app, args| {
                    let Some(url) = args.first().and_then(ArgValue::as_str) else {
                        return Ok(());
                    };
                    app.state.saved_urls.retain(|u| u != url);
                    if app.state.database_url.as_deref() == Some(url) {
                        app.state.database_url = None;
                        app.pool = None;
                    }
                    app.state.save();
                    Ok(())
                })
                .described("Remove a saved database URL from the list.")
                .args(vec![ArgSpec::url("<url>")]),
                None,
            ),
        ];

        let navigation: Vec<(Command, Option<&str>)> = vec![
            (
                Command::new("MoveCellDown", |app, args| {
                    app.move_row(distance(args) as isize);
                    Ok(())
                })
                .described("Move the cursor down by one or more cells.")
                .args(vec![ArgSpec::number("<distance>").optional()]),
                Some("j"),
            ),
            (
                Command::new("MoveCellUp", |app, args| {
                    app.move_row(-(distance(args) as isize));
                    Ok(())
                })
                .described("Move the cursor up by one or more cells.")
                .args(vec![ArgSpec::number("<distance>").optional()]),
                Some("k"),
            ),
            (
                Command::new("MoveCellRight", |app, args| {
                    app.move_column(distance(args) as isize);
                    Ok(())
                })
                .described("Move the cursor right by one or more cells.")
                .args(vec![ArgSpec::number("<distance>").optional()]),
                Some("l"),
            ),
            (
                Command::new("MoveCellLeft", |app, args| {
                    app.move_column(-(distance(args) as isize));
                    Ok(())
                })
                .described("Move the cursor left by one or more cells.")
                .args(vec![ArgSpec::number("<distance>").optional()]),
                Some("h"),
            ),
            (
                Command::new("GoToTop", |app, _| {
                    app.set_row(0);
                    Ok(())
                })
                .described("Move to the first row of the table."),
                Some("g > g"),
            ),
            (
                Command::new("GoToBottom", |app, _| {
                    let max = app.max_row();
                    app.set_row(max);
                    Ok(())
                })
                .described("Move to the last row of the table."),
                Some("G"),
            ),
            (
                Command::new("GoToLeftEnd", |app, _| {
                    app.set_column(0);
                    Ok(())
                })
                .described("Move the cursor to the left end of the table."),
                Some("^"),
            ),
            (
                Command::new("GoToRightEnd", |app, _| {
                    let max = app.max_column();
                    app.set_column(max);
                    Ok(())
                })
                .described("Move the cursor to the right end of the table."),
                Some("$"),
            ),
            (
                Command::new("GoDownHalf", |app, _| {
                    let half = app.half_page() as isize;
                    app.move_row(half);
                    Ok(())
                })
                .described("Move down by half a page."),
                Some("Control + d"),
            ),
            (
                Command::new("GoUpHalf", |app, _| {
                    let half = app.half_page() as isize;
                    app.move_row(-half);
                    Ok(())
                })
                .described("Move up by half a page."),
                Some("Control + u"),
            ),
        ];

        for (command, keybind) in global.into_iter().chain(navigation) {
            if let Some(expression) = keybind {
                let mut keybind = Keybind::new(&command.command, expression);
                keybind.description = command.description.clone();
                if let Err(error) = self.keybinds.register(&keybind) {
                    self.messages.error(error);
                }
            }
            self.commands.register(command);
        }
    }
}

fn distance(args: &[ArgValue]) -> usize {
    args.first()
        .and_then(ArgValue::as_usize)
        .filter(|d| *d > 0)
        .unwrap_or(1)
}

/// Port of the `getDataType` fallback in `SqlQueryPage`: infer columns from the
/// shape of the first result row.
fn infer_structure(row: Option<&JsonRow>) -> Vec<ColumnInfo> {
    row.map(|row| {
        row.iter()
            .map(|(name, value)| ColumnInfo {
                column_name: name.clone(),
                data_type: match value {
                    JsonValue::Number(_) => "numeric".to_string(),
                    JsonValue::Bool(_) => "boolean".to_string(),
                    JsonValue::Object(_) | JsonValue::Array(_) => "jsonb".to_string(),
                    _ => "text".to_string(),
                },
                is_primary: false,
                is_nullable: true,
                column_default: None,
                foreign_key: None,
            })
            .collect()
    })
    .unwrap_or_default()
}

/// End to end check against a real database. Set `TABLEZZ_TEST_DATABASE_URL` to
/// run it, e.g.
/// `TABLEZZ_TEST_DATABASE_URL=postgres://postgres:pw@localhost:55432/tablezz cargo test`
#[cfg(test)]
mod tests {
    use super::*;
    use crate::keybinds::{KeyEvent, KeyOutcome};
    use crate::ui;
    use ratatui::backend::TestBackend;
    use ratatui::Terminal;
    use std::time::Duration;
    use tokio::sync::mpsc::UnboundedReceiver;

    async fn pump(
        app: &mut App,
        rx: &mut UnboundedReceiver<Msg>,
        what: &str,
        done: impl Fn(&App) -> bool,
    ) {
        for _ in 0..64 {
            if done(app) {
                return;
            }
            match tokio::time::timeout(Duration::from_secs(15), rx.recv()).await {
                Ok(Some(msg)) => {
                    app.on_msg(msg);
                    app.drain_pending();
                }
                _ => break,
            }
        }
        assert!(done(app), "timed out waiting for {what}");
    }

    fn press(app: &mut App, key: &str) {
        let event = KeyEvent {
            key: key.to_string(),
            ..Default::default()
        };
        if let KeyOutcome::Triggered(command) = app.keybinds.handle_key(&event, app.input_focused())
        {
            app.trigger_command(&command);
        }
    }

    fn screen(app: &mut App) -> String {
        let mut terminal = Terminal::new(TestBackend::new(120, 20)).unwrap();
        terminal.draw(|frame| ui::draw(frame, app)).unwrap();
        terminal
            .backend()
            .buffer()
            .content()
            .chunks(120)
            .map(|line| line.iter().map(|c| c.symbol()).collect::<String>())
            .collect::<Vec<_>>()
            .join("\n")
    }

    #[tokio::test]
    async fn connects_picks_a_table_and_renders_it() {
        let Ok(url) = std::env::var("TABLEZZ_TEST_DATABASE_URL") else {
            eprintln!("skipping: TABLEZZ_TEST_DATABASE_URL not set");
            return;
        };

        let home = std::env::temp_dir().join("tablezz-smoke-home");
        let _ = std::fs::remove_dir_all(&home);
        std::env::set_var("TABLEZZ_HOME", &home);

        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let mut app = App::new(tx);
        app.viewport = Rect::new(0, 0, 120, 19);

        app.set_active_url(&url);
        pump(&mut app, &mut rx, "the table picker", |app| {
            app.picker.is_some()
        })
        .await;

        let labels: Vec<String> = app
            .picker
            .as_ref()
            .unwrap()
            .items
            .iter()
            .map(|i| i.label.clone())
            .collect();
        assert!(
            labels.contains(&"users".to_string()),
            "picker had {labels:?}"
        );
        assert!(labels.contains(&"orgs".to_string()));

        // fuzzy search, then accept — the port of typing in the picker dialog
        app.picker.as_mut().unwrap().set_search_term("users".into());
        press(&mut app, "Enter");

        pump(&mut app, &mut rx, "table data", |app| app.table.is_some()).await;

        let table = app.table.as_ref().unwrap();
        assert_eq!(table.name, "users");
        assert_eq!(table.rows().len(), 42);
        assert_eq!(app.count, Some(42));

        let column_names: Vec<&str> = table.columns().iter().map(|c| c.name.as_str()).collect();
        assert_eq!(
            column_names,
            vec![
                "id",
                "name",
                "email",
                "org_id",
                "active",
                "tags",
                "meta",
                "created_at"
            ],
            "columns come from the catalog in declaration order"
        );

        let rendered = screen(&mut app);
        assert!(rendered.contains("user 1"), "screen was:\n{rendered}");
        assert!(rendered.contains("* # id"), "screen was:\n{rendered}");
        assert!(
            rendered.contains("users · 42/42 rows"),
            "screen was:\n{rendered}"
        );

        // nullable email column renders NULL as "null"
        assert!(rendered.contains("null"), "screen was:\n{rendered}");

        // --- navigation ---
        press(&mut app, "j");
        press(&mut app, "j");
        assert_eq!(app.cursor(), (2, 0));

        press(&mut app, "l");
        assert_eq!(app.cursor(), (2, 1));

        press(&mut app, "G");
        assert_eq!(app.cursor().0, 41, "G goes to the last row");
        // ...which had to scroll to stay visible
        assert!(app.state.current_hop().unwrap().scroll_y > 0);

        press(&mut app, "g");
        press(&mut app, "g");
        assert_eq!(app.cursor().0, 0, "g > g goes back to the top");
        assert_eq!(app.state.current_hop().unwrap().scroll_y, 0);

        press(&mut app, "$");
        assert_eq!(app.cursor().1, 7, "$ goes to the last column");
        assert!(app.state.current_hop().unwrap().scroll_x > 0);

        // --- command line ---
        press(&mut app, ":");
        assert!(app.command_line.is_some());
        app.command_line.as_mut().unwrap().set("MoveCellDo");
        assert_eq!(
            app.command_line
                .as_ref()
                .unwrap()
                .ghost_text(&app.commands, &app.config.command_aliases)
                .as_deref(),
            Some("wn <distance>")
        );
        app.command_line.as_mut().unwrap().set("MoveCellDown 5");
        press(&mut app, "Enter");
        assert!(app.command_line.is_none(), "accepting closes the prompt");
        assert_eq!(app.cursor().0, 5, "arguments are parsed and applied");

        // a hop into a related table, then back out again
        app.trigger_command(r#"SqlSelect "SELECT * FROM \"public\".\"orgs\"""#);
        pump(&mut app, &mut rx, "the hop query", |app| {
            app.table.as_ref().is_some_and(|t| t.name == "orgs")
        })
        .await;
        assert_eq!(app.state.hops.len(), 2);

        press(&mut app, "o"); // no binding, must not blow up
        app.trigger_command("GoBackward");
        pump(&mut app, &mut rx, "the previous hop", |app| {
            app.table.as_ref().is_some_and(|t| t.name == "users")
        })
        .await;
        assert_eq!(app.state.hops.len(), 1);

        // an invalid command reports instead of panicking
        app.trigger_command("NopeNotACommand");
        assert!(app
            .messages
            .current()
            .is_some_and(|(_, text)| text.contains("Invalid command")));

        let _ = std::fs::remove_dir_all(&home);
    }
}
