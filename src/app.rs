//! The single owner of application state. This is where the SolidJS provider
//! tree ends up: every provider becomes a field, every `useQuery` becomes a
//! [`Query`] fed by a background task, every `onMount` registration becomes an
//! explicit register/unregister call.

use ratatui::layout::Rect;
use serde_json::Value as JsonValue;
use sqlx::PgPool;
use std::collections::VecDeque;
use tokio::sync::mpsc::UnboundedSender;

use crate::commands::builtin;
use crate::commands::command_line::CommandLine;
use crate::commands::messages::Messages;
use crate::commands::parse::{expand_variables, parse_command, CommandVariables, ParsedCommand};
use crate::commands::{Command, Commands};
use crate::config::{self, Configuration};
use crate::db::{self, ColumnInfo, JsonRow};
use crate::keybinds::{Keybind, Keybinds};
use crate::picker::{Picker, PickerAction, PickerItem};
use crate::state::PersistedState;
use crate::table::layout::ColumnLayout;
use crate::table::render::visible_rows;
use crate::table::selection::VisualSelection;
use crate::table::sql::extract_table_from_sql;
use crate::table::undo::{Change, UndoTree};
use crate::table::Table;

/// The hop query that shows the message log instead of a database table.
pub const MESSAGES_QUERY: &str = "__messages__";

/// Delimiters the cell editor round trips a selection through.
const COLUMN_DELIMITER: &str = "\u{1f}";
const ROW_DELIMITER: &str = "\u{1f}\n";

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
    References {
        target_column: String,
        filter_value: String,
        result: Result<Vec<db::TableReference>, String>,
    },
    Executed {
        message: Option<String>,
        result: Result<(), String>,
    },
    ConfigChanged,
}

/// What the content coming back from the editor is for — the enum that replaces
/// the promise the original `editor.open()` returned.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EditorPurpose {
    Cells,
    SqlSelect,
    SqlExecute,
}

pub struct EditorRequest {
    pub purpose: EditorPurpose,
    pub initial_content: String,
    pub extension: String,
}

/// Port of the keybind help panel's local state.
#[derive(Debug, Default)]
pub struct Help {
    pub search: String,
    pub searching: bool,
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
    /// The schema the loaded table came from, used when writing changes back.
    pub table_schema: String,
    pub layout: ColumnLayout,
    pub selection: VisualSelection,
    pub undo_tree: UndoTree,
    /// The cell whose full value is shown in a popup, if any.
    pub opened_cell: Option<(usize, usize)>,

    pub picker: Option<Picker>,
    pub command_line: Option<CommandLine>,
    /// Index of the highlighted autocomplete entry while the menu is open.
    pub autocomplete: Option<usize>,
    pub help: Option<Help>,
    /// Set by a command, picked up and run by the event loop.
    pub editor_request: Option<EditorRequest>,

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
            table_schema: "public".to_string(),
            layout: ColumnLayout::default(),
            selection: VisualSelection::default(),
            undo_tree: UndoTree::default(),
            opened_cell: None,
            picker: None,
            command_line: None,
            autocomplete: None,
            help: None,
            editor_request: None,
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

            Msg::References {
                target_column,
                filter_value,
                result,
            } => self.on_references(target_column, filter_value, result),

            Msg::Executed { message, result } => match result {
                Ok(()) => {
                    if let Some(message) = message {
                        self.messages.info(message);
                    }
                    self.reload_table();
                }
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
        let Some(hop) = self.state.current_hop() else {
            return;
        };

        let query = hop.query.clone();

        // The message log is a table like any other, it just needs no database
        if query == MESSAGES_QUERY {
            self.loaded_key = Some(query);
            self.rows = Query::Ready(self.message_rows());
            self.structure = Query::Ready(messages_structure());
            self.count = None;
            self.try_build_table();
            return;
        }

        let Some(pool) = self.pool.clone() else {
            return;
        };

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

    /// Port of the second half of `GoToReferences`: one match navigates, several
    /// go through the picker.
    fn on_references(
        &mut self,
        target_column: String,
        filter_value: String,
        result: Result<Vec<db::TableReference>, String>,
    ) {
        let references = match result {
            Ok(references) => references,
            Err(error) => return self.messages.error(error),
        };

        let schema = self.table_schema.clone();
        let relevant: Vec<db::TableReference> = references
            .into_iter()
            .filter(|reference| reference.target_column == target_column)
            .collect();

        let query = |reference: &db::TableReference| {
            format!(
                "SELECT * FROM \"{schema}\".\"{}\" WHERE \"{}\" = {filter_value}",
                reference.source_table, reference.source_column
            )
        };

        match relevant.as_slice() {
            [] => self.messages.info("No references found"),
            [only] => self.hop_to(query(only)),
            many => {
                let items = many
                    .iter()
                    .map(|reference| PickerItem {
                        label: format!("{}.{}", reference.source_table, reference.source_column),
                        value: query(reference),
                        icon: Some('↳'),
                    })
                    .collect();
                self.open_picker(PickerAction::HopToQuery, items);
            }
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

        let is_messages = hop.query == MESSAGES_QUERY;
        let extracted = extract_table_from_sql(&hop.query);
        let table_name = match extracted.as_ref().map(|e| e.table.clone()) {
            Some(name) => name,
            None if is_messages => "messages".to_string(),
            None => String::new(),
        };
        let schema = extracted
            .as_ref()
            .and_then(|e| e.schema.clone())
            .unwrap_or_else(|| self.schema());

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
        self.table_schema = schema;

        // Fresh data means the recorded edits no longer point anywhere.
        self.undo_tree.clear();
        self.exit_visual_mode();
        self.opened_cell = None;
        self.clamp_cursor();
    }

    /// Port of `MessagesPage`: the message log rendered as a table.
    fn message_rows(&self) -> Vec<JsonRow> {
        self.messages
            .history()
            .iter()
            .map(|message| {
                [
                    (
                        "time".to_string(),
                        JsonValue::String(format_time(message.timestamp)),
                    ),
                    (
                        "type".to_string(),
                        JsonValue::String(message.kind.as_str().to_string()),
                    ),
                    (
                        "message".to_string(),
                        JsonValue::String(message.text.clone()),
                    ),
                ]
                .into_iter()
                .collect()
            })
            .collect()
    }

    // ---------------------------------------------------------------- cursor

    pub fn max_row(&self) -> usize {
        self.table
            .as_ref()
            .map(|t| t.rows().len().saturating_sub(1))
            .unwrap_or(0)
    }

    pub fn max_column(&self) -> usize {
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

    /// Port of the effects that dismissed the cell popup when the cursor moved.
    fn after_cursor_move(&mut self) {
        self.opened_cell = None;
        self.ensure_cursor_visible();
    }

    pub fn move_row(&mut self, delta: isize) {
        let max = self.max_row();
        if let Some(hop) = self.state.current_hop_mut() {
            hop.row_index = hop.row_index.saturating_add_signed(delta).min(max);
        }
        self.after_cursor_move();
    }

    pub fn move_column(&mut self, delta: isize) {
        let max = self.max_column();
        if let Some(hop) = self.state.current_hop_mut() {
            hop.column_index = hop.column_index.saturating_add_signed(delta).min(max);
        }
        self.after_cursor_move();
    }

    pub fn set_row(&mut self, row: usize) {
        let max = self.max_row();
        if let Some(hop) = self.state.current_hop_mut() {
            hop.row_index = row.min(max);
        }
        self.after_cursor_move();
    }

    pub fn set_column(&mut self, column: usize) {
        let max = self.max_column();
        if let Some(hop) = self.state.current_hop_mut() {
            hop.column_index = column.min(max);
        }
        self.after_cursor_move();
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
        self.register_all(builtin::picker());
    }

    pub fn close_picker(&mut self) {
        if self.picker.take().is_none() {
            return;
        }
        self.unregister_all(builtin::picker());
    }

    pub fn accept_picker(&mut self) {
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
                self.hop_to(format!("SELECT * FROM \"{schema}\".\"{value}\" LIMIT 100;"));
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
            PickerAction::HopToQuery => self.hop_to(value),
        }
    }

    pub fn open_command_line(&mut self) {
        if self.command_line.is_some() {
            return;
        }

        self.messages.clear();
        self.command_line = Some(CommandLine::default());
        self.register_all(builtin::command_line());
    }

    pub fn close_command_line(&mut self) {
        self.close_autocomplete();

        if self.command_line.take().is_none() {
            return;
        }
        self.unregister_all(builtin::command_line());
    }

    pub fn complete_command_line(&mut self) {
        let matches = self.autocomplete_matches();

        match matches.as_slice() {
            [only] => {
                if let Some(line) = self.command_line.as_mut() {
                    line.set(&format!("{only} "));
                }
            }
            [_, _, ..] => self.open_autocomplete(),
            [] => {}
        }
    }

    pub fn accept_command_line(&mut self) {
        let Some(line) = self.command_line.as_ref() else {
            return;
        };
        let command = line.value().trim().to_string();

        self.close_command_line();

        if command.is_empty() {
            return;
        }

        self.state.command_history.retain(|entry| entry != &command);
        self.state.command_history.insert(0, command.clone());
        self.state.save();
        self.trigger_command(&command);
    }

    /// Port of `navigateHistory`: the first press turns what is typed into a
    /// filter over the history, later presses walk the matches.
    pub fn navigate_history(&mut self, backwards: bool) {
        let history = self.state.command_history.clone();
        let Some(line) = self.command_line.as_mut() else {
            return;
        };

        line.navigate_history(&history, backwards);
    }

    // --- autocomplete popup ---

    pub fn autocomplete_matches(&self) -> Vec<String> {
        self.command_line
            .as_ref()
            .map(|line| line.matches(&self.commands, &self.config.command_aliases))
            .unwrap_or_default()
    }

    pub fn open_autocomplete(&mut self) {
        if self.autocomplete.is_some() || self.command_line.is_none() {
            return;
        }

        self.autocomplete = Some(0);
        self.register_all(builtin::autocomplete());
    }

    pub fn close_autocomplete(&mut self) {
        if self.autocomplete.take().is_none() {
            return;
        }
        self.unregister_all(builtin::autocomplete());
    }

    pub fn autocomplete_selected(&self) -> usize {
        let len = self.autocomplete_matches().len();
        match (self.autocomplete, len) {
            (Some(selected), len) if len > 0 => selected.min(len - 1),
            _ => 0,
        }
    }

    pub fn autocomplete_next(&mut self) {
        let matches = self.autocomplete_matches();

        // A single candidate needs no menu, just take it
        if let [only] = matches.as_slice() {
            let only = only.clone();
            return self.accept_completion(&only);
        }

        if !matches.is_empty() {
            self.autocomplete = Some((self.autocomplete_selected() + 1) % matches.len());
        }
    }

    pub fn autocomplete_prev(&mut self) {
        let len = self.autocomplete_matches().len();
        if len > 0 {
            self.autocomplete = Some((self.autocomplete_selected() + len - 1) % len);
        }
    }

    pub fn accept_autocomplete(&mut self) {
        let Some(name) = self
            .autocomplete_matches()
            .get(self.autocomplete_selected())
            .cloned()
        else {
            return;
        };

        self.accept_completion(&name);
    }

    fn accept_completion(&mut self, name: &str) {
        if let Some(line) = self.command_line.as_mut() {
            line.set(name);
        }
        self.close_autocomplete();
    }

    // --- keybind help ---

    pub fn toggle_help(&mut self) {
        match self.help.is_some() {
            true => self.close_help(),
            false => {
                self.help = Some(Help::default());
                self.register_all(builtin::help());
            }
        }
    }

    pub fn close_help(&mut self) {
        if self.help.take().is_none() {
            return;
        }
        self.unregister_all(builtin::help());
    }

    pub fn start_help_search(&mut self) {
        let Some(help) = self.help.as_mut() else {
            return;
        };
        if help.searching {
            return;
        }

        help.searching = true;
        self.register_all(builtin::help_search());
    }

    pub fn stop_help_search(&mut self) {
        let Some(help) = self.help.as_mut() else {
            return;
        };
        if !help.searching {
            return;
        }

        help.searching = false;
        help.search.clear();
        self.unregister_all(builtin::help_search());
    }

    // --- visual mode ---

    pub fn set_visual_mode(&mut self, on: bool) {
        match on {
            true => {
                self.selection.start = Some(self.cursor());
                self.unregister_all(builtin::visual_enter());
                self.register_all(builtin::visual_exit());
            }
            false => {
                self.selection.exit();
                self.unregister_all(builtin::visual_exit());
                self.register_all(builtin::visual_enter());
            }
        }
    }

    /// Port of `VisualSelection.exit()`: only does something while selecting.
    fn exit_visual_mode(&mut self) {
        if self.selection.is_selecting() {
            self.set_visual_mode(false);
        }
    }

    fn register_all(&mut self, entries: Vec<(Command, Keybind)>) {
        for (command, mut keybind) in entries {
            keybind.description = command.description.clone();
            if let Err(error) = self.keybinds.register(&keybind) {
                self.messages.error(error);
                continue;
            }
            self.commands.register(command);
        }
    }

    fn unregister_all(&mut self, entries: Vec<(Command, Keybind)>) {
        for (command, keybind) in entries {
            self.keybinds.unregister(&keybind);
            self.commands.unregister(&command.command);
        }
    }

    pub fn input_focused(&self) -> bool {
        self.command_line.is_some()
            || self.picker.is_some()
            || self.help.as_ref().is_some_and(|help| help.searching)
    }

    // --------------------------------------------------------------- editing

    /// Port of `WriteChanges`: one transaction of UPDATEs and DELETEs built from
    /// the dirty cells and the rows marked for deletion.
    pub fn write_changes(&mut self) {
        let Some(table) = self.table.as_ref() else {
            return;
        };
        let schema = self.table_schema.clone();
        let name = table.name.clone();

        let mut statements: Vec<String> = Vec::new();
        let mut errors: Vec<String> = Vec::new();

        for (row, column) in table.dirty_cells() {
            let (Some(column_ref), Some(cell)) = (table.column(column), table.cell(row, column))
            else {
                continue;
            };

            match (table.primary_key(row), cell.to_sql_value(column_ref)) {
                (Ok(keys), Ok(value)) if !keys.is_empty() => statements.push(format!(
                    "UPDATE \"{schema}\".\"{name}\" SET \"{}\" = {value} WHERE {}",
                    column_ref.name,
                    where_clause(&keys)
                )),
                (Ok(_), Ok(_)) => {
                    errors.push(format!("Can't update, no primary key in table \"{name}\""))
                }
                (Err(error), _) | (_, Err(error)) => errors.push(error),
            }
        }

        for row in table.deleted_rows() {
            match table.primary_key(row) {
                Ok(keys) if !keys.is_empty() => statements.push(format!(
                    "DELETE FROM \"{schema}\".\"{name}\" WHERE {}",
                    where_clause(&keys)
                )),
                Ok(_) => errors.push(format!(
                    "Can't delete row, no primary key in table \"{name}\""
                )),
                Err(error) => errors.push(error),
            }
        }

        for error in errors {
            self.messages.error(error);
        }

        if statements.is_empty() {
            return;
        }

        let Some(pool) = self.pool.clone() else {
            return;
        };

        self.spawn(async move {
            Msg::Executed {
                message: Some("Successfully updated".to_string()),
                result: db::batch_execute(&pool, statements)
                    .await
                    .map_err(|e| e.to_string()),
            }
        });
    }

    pub fn undo(&mut self) {
        if let Some(table) = self.table.as_mut() {
            self.undo_tree.undo(table);
        }
    }

    pub fn delete_selected_rows(&mut self) {
        let cursor = self.cursor();
        let selection = self.selection;

        let Some(table) = self.table.as_mut() else {
            return;
        };
        let rows = selection.rows(cursor, table);

        let already_deleted = rows
            .iter()
            .all(|row| table.row(*row).is_some_and(|row| row.is_deleted()));

        if !already_deleted {
            for row in &rows {
                if let Some(row) = table.row_mut(*row) {
                    row.mark_for_deletion();
                }
            }
            self.undo_tree.add(Change::RowDeletions(rows));
        }

        self.exit_visual_mode();
    }

    pub fn copy_selection(&mut self) {
        let cursor = self.cursor();
        let selection = self.selection;

        let Some(table) = self.table.as_ref() else {
            return;
        };
        let text = selection.to_delimited(cursor, table, "\t", "\n");

        match arboard::Clipboard::new().and_then(|mut clipboard| clipboard.set_text(text)) {
            Ok(()) => self.messages.info("Copied to clipboard"),
            Err(error) => self.messages.error(error.to_string()),
        }

        self.exit_visual_mode();
    }

    /// Port of `SelectionOpen`: show a cell's full value in a popup.
    pub fn open_cell(&mut self, row: usize, column: usize) {
        let exists = self
            .table
            .as_ref()
            .is_some_and(|table| table.cell(row, column).is_some());

        self.opened_cell = exists.then_some((row, column));
    }

    // ------------------------------------------------------- foreign keys

    pub fn go_to_foreign_key_relation(&mut self) {
        let (row, column) = self.cursor();
        let schema = self.table_schema.clone();

        let query = {
            let Some(table) = self.table.as_ref() else {
                return;
            };
            let (Some(column_ref), Some(cell)) = (table.column(column), table.cell(row, column))
            else {
                return;
            };
            let Some(foreign_key) = column_ref.foreign_key.as_ref() else {
                return;
            };

            cell.to_sql_value(column_ref).map(|value| {
                format!(
                    "SELECT * FROM \"{schema}\".\"{}\" WHERE \"{}\" = {value}",
                    foreign_key.table, foreign_key.column
                )
            })
        };

        match query {
            Ok(query) => self.hop_to(query),
            Err(error) => self.messages.error(error),
        }
    }

    pub fn go_to_references(&mut self) {
        let (row, column) = self.cursor();
        let schema = self.table_schema.clone();

        let target = {
            let Some(table) = self.table.as_ref() else {
                return;
            };
            let (Some(column_ref), Some(cell)) = (table.column(column), table.cell(row, column))
            else {
                return;
            };

            // A column can be both a primary and a foreign key; the foreign key
            // wins, since that is the table the value really belongs to.
            let (target_table, target_column) = match column_ref.foreign_key.as_ref() {
                Some(foreign_key) => (foreign_key.table.clone(), foreign_key.column.clone()),
                None if column_ref.is_primary => (table.name.clone(), column_ref.name.clone()),
                None => return,
            };

            cell.to_sql_value(column_ref)
                .map(|filter_value| (target_table, target_column, filter_value))
        };

        let (target_table, target_column, filter_value) = match target {
            Ok(target) => target,
            Err(error) => return self.messages.error(error),
        };

        let Some(pool) = self.pool.clone() else {
            return;
        };

        self.spawn(async move {
            Msg::References {
                target_column,
                filter_value,
                result: db::get_table_references(&pool, &schema, &target_table)
                    .await
                    .map_err(|e| e.to_string()),
            }
        });
    }

    // -------------------------------------------------------------- editor

    pub fn request_editor(
        &mut self,
        purpose: EditorPurpose,
        initial_content: String,
        extension: &str,
    ) {
        self.editor_request = Some(EditorRequest {
            purpose,
            initial_content,
            extension: extension.to_string(),
        });
    }

    pub fn open_cell_editor(&mut self) {
        let cursor = self.cursor();
        let selection = self.selection;

        let Some(table) = self.table.as_ref() else {
            return;
        };
        let cells = selection.cells(cursor, table);

        let extension = match cells.as_slice() {
            [(_, column)] => table
                .column(*column)
                .map(|column| column.data_type().file_extension())
                .unwrap_or(".txt"),
            _ => ".txt",
        };

        let content = selection.to_delimited(cursor, table, COLUMN_DELIMITER, ROW_DELIMITER);
        self.request_editor(EditorPurpose::Cells, content, extension);
    }

    pub fn on_editor_result(&mut self, purpose: EditorPurpose, content: String) {
        // Editors add a trailing newline, which would otherwise be written into
        // the row after the selection.
        let content = content.trim_end().to_string();

        match purpose {
            EditorPurpose::Cells => {
                let cursor = self.cursor();
                let selection = self.selection;

                let result = match self.table.as_mut() {
                    Some(table) => selection.update_cells(
                        cursor,
                        table,
                        &content,
                        COLUMN_DELIMITER,
                        ROW_DELIMITER,
                    ),
                    None => return,
                };

                match result {
                    Ok(updated) if !updated.is_empty() => {
                        self.undo_tree.add(Change::CellEdits(updated))
                    }
                    Ok(_) => {}
                    Err(error) => self.messages.error(error),
                }

                self.exit_visual_mode();
            }

            EditorPurpose::SqlSelect if !content.is_empty() => self.hop_to(content),
            EditorPurpose::SqlExecute if !content.is_empty() => self.raw_execute(content, None),
            _ => {}
        }
    }

    // ------------------------------------------------------------ plumbing

    pub fn hop_to(&mut self, query: String) {
        self.state.add_hop(query);
        self.state.save();
        self.load_current_hop();
    }

    pub fn raw_execute(&mut self, sql: String, message: Option<String>) {
        let Some(pool) = self.pool.clone() else {
            return;
        };

        self.spawn(async move {
            Msg::Executed {
                message,
                result: db::raw_execute(&pool, &sql)
                    .await
                    .map_err(|e| e.to_string()),
            }
        });
    }

    fn register_commands(&mut self) {
        for (command, expression) in builtin::global() {
            if let Some(expression) = expression {
                let mut keybind = Keybind::new(&command.command, expression);
                keybind.description = command.description.clone();
                if let Err(error) = self.keybinds.register(&keybind) {
                    self.messages.error(error);
                }
            }
            self.commands.register(command);
        }

        self.register_all(builtin::visual_enter());
    }
}

fn where_clause(keys: &[(String, String)]) -> String {
    keys.iter()
        .map(|(column, value)| format!("\"{column}\" = {value}"))
        .collect::<Vec<_>>()
        .join(" AND ")
}

fn messages_structure() -> Vec<ColumnInfo> {
    ["time", "type", "message"]
        .iter()
        .map(|name| ColumnInfo {
            column_name: name.to_string(),
            data_type: "text".to_string(),
            is_primary: false,
            is_nullable: false,
            foreign_key: None,
        })
        .collect()
}

fn format_time(at: time::OffsetDateTime) -> String {
    format!("{:02}:{:02}:{:02}", at.hour(), at.minute(), at.second())
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
    use ratatui::layout::Rect;
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

    /// Let outstanding database work finish, so queued piped commands run.
    /// `drain_pending` deliberately holds them back while anything is in
    /// flight.
    async fn settle(app: &mut App, rx: &mut UnboundedReceiver<Msg>) {
        while app.is_busy() {
            match tokio::time::timeout(Duration::from_secs(15), rx.recv()).await {
                Ok(Some(msg)) => {
                    app.on_msg(msg);
                    app.drain_pending();
                }
                _ => break,
            }
        }
        app.drain_pending();
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

        // a viewport too narrow for every column, so scrolling is forced
        // regardless of how wide the data happens to render
        app.viewport = Rect::new(0, 0, 40, 19);
        press(&mut app, "$");
        assert_eq!(app.cursor().1, 7, "$ goes to the last column");
        assert!(app.state.current_hop().unwrap().scroll_x > 0);

        press(&mut app, "^");
        assert_eq!(app.state.current_hop().unwrap().scroll_x, 0);
        app.viewport = Rect::new(0, 0, 120, 19);

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

        // --- visual mode swaps its own keybinds ---
        press(&mut app, "g");
        press(&mut app, "g");
        press(&mut app, "^");
        press(&mut app, "v");
        assert_eq!(app.selection.start, Some((0, 0)));
        press(&mut app, "j");
        press(&mut app, "j");
        assert_eq!(
            app.selection
                .cells(app.cursor(), app.table.as_ref().unwrap())
                .len(),
            3
        );
        // a live message owns the status line, so clear it to see the mode
        app.messages.clear();
        assert!(screen(&mut app).contains("-- VISUAL --"));

        press(&mut app, "v"); // the same key now exits
        assert!(!app.selection.is_selecting());

        // --- marking rows for deletion, and taking it back ---
        press(&mut app, "v");
        press(&mut app, "j");
        press(&mut app, "d");
        press(&mut app, "d");
        assert_eq!(app.table.as_ref().unwrap().deleted_rows().len(), 2);
        assert!(!app.selection.is_selecting(), "deleting leaves visual mode");
        assert!(
            screen(&mut app).contains("[+2]"),
            "pending changes are counted"
        );

        press(&mut app, "u");
        assert!(app.table.as_ref().unwrap().deleted_rows().is_empty());

        // --- editing a cell and writing it back ---
        app.trigger_command("GoToTop | GoToLeftEnd");
        press(&mut app, "l"); // the name column
        assert_eq!(app.cursor(), (0, 1));
        press(&mut app, "c");

        // the row order is not fixed and the test is run repeatedly, so work
        // from whatever the cell holds now
        let original = app.table.as_ref().unwrap().cell_display(0, 1);
        let edited = format!("{original}'s");

        let request = app.editor_request.take().expect("the editor was asked for");
        assert_eq!(request.purpose, EditorPurpose::Cells);
        assert_eq!(request.initial_content, original);
        assert_eq!(request.extension, ".txt");

        // an apostrophe is the case the original built broken SQL for, and the
        // trailing newline is what an editor leaves behind
        app.on_editor_result(EditorPurpose::Cells, format!("{edited}\n"));
        assert_eq!(app.table.as_ref().unwrap().dirty_cells(), vec![(0, 1)]);
        assert_eq!(app.table.as_ref().unwrap().cell_display(0, 1), edited);

        press(&mut app, "w");
        pump(&mut app, &mut rx, "the write to land", |app| {
            app.messages
                .history()
                .iter()
                .any(|m| m.text.contains("Successfully updated"))
        })
        .await;
        // the reloaded table has the new value and no pending edits
        pump(&mut app, &mut rx, "the reload", |app| {
            app.table.as_ref().is_some_and(|table| {
                table.dirty_cells().is_empty()
                    && (0..table.rows().len()).any(|row| table.cell_display(row, 1) == edited)
            })
        })
        .await;
        settle(&mut app, &mut rx).await;

        // --- foreign keys ---
        app.trigger_command("GoToTop | GoToLeftEnd | MoveCellRight 3");
        assert_eq!(app.cursor(), (0, 3), "org_id");

        press(&mut app, "g");
        press(&mut app, "d");
        pump(&mut app, &mut rx, "the foreign key hop", |app| {
            app.table.as_ref().is_some_and(|t| t.name == "orgs")
        })
        .await;
        settle(&mut app, &mut rx).await;
        assert_eq!(app.table.as_ref().unwrap().rows().len(), 1);
        assert_eq!(app.count, Some(2), "the count follows the hop's table");
        assert!(screen(&mut app).contains("orgs · 1/2 rows"));

        // orgs.id is referenced by users.org_id, so this is a single match
        press(&mut app, "g");
        press(&mut app, "r");
        pump(&mut app, &mut rx, "the references hop", |app| {
            app.table.as_ref().is_some_and(|t| t.name == "users")
        })
        .await;
        settle(&mut app, &mut rx).await;
        assert!(app.table.as_ref().unwrap().rows().len() > 1);

        // --- the message log is a table too ---
        app.trigger_command("Messages");
        assert_eq!(app.table.as_ref().unwrap().name, "messages");
        assert!(app.table.as_ref().unwrap().rows().len() > 1);
        assert!(screen(&mut app).contains("Successfully updated"));
        app.trigger_command("GoBackward");
        pump(&mut app, &mut rx, "the hop back", |app| {
            app.table.as_ref().is_some_and(|t| t.name == "users")
        })
        .await;
        settle(&mut app, &mut rx).await;

        // --- help overlay ---
        press(&mut app, "?");
        let rendered = screen(&mut app);
        // full command names, not clipped by the column split
        for command in [
            "WriteChanges",
            "MoveCellDown",
            "GoToForeignKeyRelation",
            "SelectionCopyToClipboard",
            "CommandLineActivate",
            "OpenCellEditor",
        ] {
            assert!(rendered.contains(command), "{command} in:\n{rendered}");
        }

        press(&mut app, "/");
        assert!(app.input_focused(), "the search box takes the keys");
        app.help.as_mut().unwrap().search = "Write".to_string();
        assert!(screen(&mut app).contains("WriteChanges"));
        press(&mut app, "Escape"); // stops the search
        assert!(app.help.is_some());
        press(&mut app, "Escape"); // closes the panel
        assert!(app.help.is_none());

        // --- autocomplete ---
        press(&mut app, ":");
        app.command_line.as_mut().unwrap().set("Go");
        press(&mut app, "Tab");
        assert!(app.autocomplete.is_some(), "several matches open the menu");
        let rendered = screen(&mut app);
        assert!(rendered.contains("GoToTop"), "screen was:\n{rendered}");

        press(&mut app, "Tab"); // moves the selection while the menu is up
        press(&mut app, "Enter"); // accepts it instead of running the command
        assert!(app.autocomplete.is_none());
        assert!(app.command_line.is_some(), "the prompt stays open");
        assert!(app.command_line.as_ref().unwrap().value().starts_with("Go"));
        press(&mut app, "Escape");
        assert!(app.command_line.is_none());

        let _ = std::fs::remove_dir_all(&home);
    }
}
