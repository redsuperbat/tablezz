//! Terminal adapter: owns the event loop and translates crossterm key events
//! into the browser shaped events the keybind expressions are written against.

mod app;
mod commands;
mod config;
mod db;
mod editor;
mod keybinds;
mod picker;
mod state;
mod table;
mod ui;

use clap::Parser;
use crossterm::event::{Event, EventStream, KeyCode, KeyEventKind, KeyModifiers};
use crossterm::terminal::{
    disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen,
};
use futures::StreamExt;
use ratatui::DefaultTerminal;
use std::time::Duration;
use tokio::sync::mpsc;

use app::App;
use keybinds::{KeyEvent, KeyOutcome};

/// Keyboard-centric PostgreSQL table viewer.
#[derive(Parser)]
#[command(version)]
struct Cli {
    /// Database url to connect to, e.g. postgres://localhost/mydb
    /// (defaults to the last used url)
    #[arg(value_parser = valid_url)]
    url: Option<String>,

    /// Print the command reference as markdown and exit
    #[arg(long)]
    commands: bool,

    /// Print the JSON schema for the config file and exit
    #[arg(long)]
    config_schema: bool,
}

fn valid_url(raw: &str) -> Result<String, String> {
    db::credentials(raw).map(|_| raw.to_string())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    if cli.commands {
        print!("{}", commands_markdown());
        return Ok(());
    }

    if cli.config_schema {
        let schema = schemars::schema_for!(config::Configuration);
        println!("{}", serde_json::to_string_pretty(&schema)?);
        return Ok(());
    }

    let (tx, mut rx) = mpsc::unbounded_channel();
    let mut app = App::new(tx.clone());

    match cli.url {
        Some(url) => app.set_active_url(&url),
        None => app.connect(),
    }

    // Kept alive for the duration of the run so the config stays watched.
    let _watcher = config::watch(tx.clone());

    let mut terminal = ratatui::init();
    let mut events = EventStream::new();

    while !app.should_quit {
        terminal.draw(|frame| ui::draw(frame, &mut app))?;

        tokio::select! {
            event = events.next() => match event {
                Some(Ok(event)) => on_event(&mut app, event),
                Some(Err(error)) => return Err(error.into()),
                None => break,
            },
            msg = rx.recv() => match msg {
                Some(msg) => app.on_msg(msg),
                None => break,
            },
            // Redraw periodically so message toasts expire on time.
            _ = tokio::time::sleep(Duration::from_millis(250)) => {}
        }

        app.drain_pending();

        // A command asked for the editor. The event stream has to let go of
        // stdin first, or it would eat the editor's input.
        if let Some(request) = app.editor_request.take() {
            drop(events);

            let result = suspended(&mut terminal, || {
                editor::edit(
                    &app.config.editor,
                    &request.initial_content,
                    &request.extension,
                )
            });

            events = EventStream::new();

            match result {
                Ok(content) => app.on_editor_result(request.purpose, content),
                Err(error) => app.messages.error(error.to_string()),
            }
        }
    }

    ratatui::restore();
    app.state.save();
    Ok(())
}

/// One row of the command reference in `config/commands.md`.
struct CommandDoc {
    name: String,
    description: String,
    args: String,
    aliases: String,
    keybind: String,
    scope: &'static str,
}

impl CommandDoc {
    fn new(command: &commands::Command, keybind: Option<String>, scope: &'static str) -> Self {
        Self {
            name: command.command.clone(),
            description: command.description.clone().unwrap_or_default(),
            args: command.args_hint(),
            aliases: match command.aliases.as_slice() {
                [] => "-".to_string(),
                aliases => aliases
                    .iter()
                    .map(|alias| format!("`{alias}`"))
                    .collect::<Vec<_>>()
                    .join(", "),
            },
            keybind: keybind
                .map(|bind| format!("`{}`", bind.replace('|', "\\|")))
                .unwrap_or_else(|| "-".to_string()),
            scope,
        }
    }

    fn row(&self) -> String {
        format!(
            "| {} | {} | {} | {} | {} | {} |",
            self.name, self.description, self.args, self.aliases, self.keybind, self.scope
        )
    }
}

/// The command reference in `config/commands.md`. Built from the definitions
/// rather than the live registry, so the commands that only exist while an
/// overlay is open are documented too.
fn commands_markdown() -> String {
    use commands::builtin;

    let mut docs: Vec<CommandDoc> = builtin::global()
        .iter()
        .map(|(command, keybind)| CommandDoc::new(command, keybind.map(str::to_string), "always"))
        .collect();

    for (scope, entries) in [
        ("visual mode", builtin::visual_enter()),
        ("visual mode", builtin::visual_exit()),
        ("picker", builtin::picker()),
        ("command line", builtin::command_line()),
        ("autocomplete", builtin::autocomplete()),
        ("help", builtin::help()),
        ("help search", builtin::help_search()),
    ] {
        docs.extend(entries.iter().map(|(command, keybind)| {
            CommandDoc::new(command, Some(keybind.keybind_expression.clone()), scope)
        }));
    }

    let mut rows: Vec<String> = docs.iter().map(CommandDoc::row).collect();
    rows.sort();

    let mut out = String::new();
    out.push_str("# Commands\n\n");
    out.push_str("This file is auto-generated by `tablezz --commands`. Do not edit manually.\n\n");
    out.push_str("`Scope` is when the command exists: `always`, or only while that overlay or mode is open.\n");
    out.push_str("`Aliases` work anywhere a command name does; `commandAliases` in the config file adds more, and overrides these.\n\n");
    out.push_str("| Command | Description | Arguments | Aliases | Keybind | Scope |\n|---|---|---|---|---|---|\n");
    out.push_str(&rows.join("\n"));
    out.push('\n');
    out
}

/// Hand the real terminal back for as long as `body` runs.
fn suspended<T>(
    terminal: &mut DefaultTerminal,
    body: impl FnOnce() -> anyhow::Result<T>,
) -> anyhow::Result<T> {
    disable_raw_mode()?;
    crossterm::execute!(std::io::stdout(), LeaveAlternateScreen)?;

    let result = body();

    enable_raw_mode()?;
    crossterm::execute!(std::io::stdout(), EnterAlternateScreen)?;
    terminal.clear()?;

    result
}

fn on_event(app: &mut App, event: Event) {
    let Event::Key(key) = event else { return };

    if key.kind != KeyEventKind::Press {
        return;
    }

    let Some(mapped) = to_key_event(&key) else {
        return;
    };

    match app.keybinds.handle_key(&mapped, app.input_focused()) {
        KeyOutcome::Triggered(command) => app.trigger_command(&command),
        KeyOutcome::Consumed => {}
        // Nothing claimed the key, so a focused text input gets it — the
        // equivalent of the browser letting the event reach the <input>.
        KeyOutcome::Ignored => feed_input(app, &key),
    }
}

/// Map a crossterm key to the `KeyboardEvent` shape (`key` + `code`) the
/// keybind checker compares against.
fn to_key_event(key: &crossterm::event::KeyEvent) -> Option<KeyEvent> {
    let named = |name: &str| Some((name.to_string(), name.to_string()));

    let (key_name, code) = match key.code {
        KeyCode::Char(' ') => Some((" ".to_string(), "Space".to_string())),
        KeyCode::Char(char) => Some((char.to_string(), String::new())),
        KeyCode::Enter => named("Enter"),
        KeyCode::Tab | KeyCode::BackTab => named("Tab"),
        KeyCode::Backspace => named("Backspace"),
        KeyCode::Delete => named("Delete"),
        KeyCode::Insert => named("Insert"),
        KeyCode::Esc => named("Escape"),
        KeyCode::Up => named("ArrowUp"),
        KeyCode::Down => named("ArrowDown"),
        KeyCode::Left => named("ArrowLeft"),
        KeyCode::Right => named("ArrowRight"),
        KeyCode::Home => named("Home"),
        KeyCode::End => named("End"),
        KeyCode::PageUp => named("PageUp"),
        KeyCode::PageDown => named("PageDown"),
        KeyCode::F(n) => Some((format!("F{n}"), format!("F{n}"))),
        _ => None,
    }?;

    Some(KeyEvent {
        ctrl_key: key.modifiers.contains(KeyModifiers::CONTROL),
        alt_key: key.modifiers.contains(KeyModifiers::ALT),
        meta_key: key.modifiers.contains(KeyModifiers::SUPER),
        key: key_name,
        code,
    })
}

fn feed_input(app: &mut App, key: &crossterm::event::KeyEvent) {
    // Control/Alt chords are keybind territory, never text.
    let is_text = !key
        .modifiers
        .intersects(KeyModifiers::CONTROL | KeyModifiers::ALT | KeyModifiers::SUPER);

    if let Some(line) = app.command_line.as_mut() {
        match key.code {
            KeyCode::Char(char) if is_text => line.insert(char),
            KeyCode::Backspace => line.backspace(),
            KeyCode::Delete => line.delete(),
            KeyCode::Left => line.move_left(),
            KeyCode::Right => line.move_right(),
            KeyCode::Home => line.move_home(),
            KeyCode::End => line.move_end(),
            _ => {}
        }
        return;
    }

    if let Some(picker) = app.picker.as_mut() {
        let mut term = picker.search_term.clone();
        match key.code {
            KeyCode::Char(char) if is_text => term.push(char),
            KeyCode::Backspace => {
                term.pop();
            }
            _ => return,
        }
        picker.set_search_term(term);
        return;
    }

    if let Some(help) = app.help.as_mut().filter(|help| help.searching) {
        match key.code {
            KeyCode::Char(char) if is_text => help.search.push(char),
            KeyCode::Backspace => {
                help.search.pop();
            }
            _ => {}
        }
    }
}
