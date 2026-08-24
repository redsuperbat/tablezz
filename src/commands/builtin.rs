//! Every command tablezz ships with. The originals were spread across the
//! components that registered them; grouped here by the scope they belong to,
//! since scope is now explicit instead of implied by a component's lifetime.

use crate::commands::{ArgSpec, ArgValue, Command};
use crate::keybinds::Keybind;

/// Commands that are always available, with their default keybind.
pub fn global() -> Vec<(Command, Option<&'static str>)> {
    let mut all = vec![
        (
            Command::new("Quit", |app, _| {
                app.should_quit = true;
                Ok(())
            })
            .described("Quit tablezz.")
            .alias("q"),
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
            Command::new("CommandLineClearHistory", |app, _| {
                app.state.command_history.clear();
                app.state.save();
                Ok(())
            })
            .described("Clear all command history."),
            None,
        ),
        (
            Command::new("KeybindHelpShow", |app, _| {
                app.toggle_help();
                Ok(())
            })
            .described("Show available keyboard shortcuts."),
            Some("?"),
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
                match args.first().and_then(ArgValue::as_str) {
                    Some(sql) => app.hop_to(sql.to_string()),
                    None => app.request_editor(
                        crate::app::EditorPurpose::SqlSelect,
                        String::new(),
                        ".sql",
                    ),
                }
                Ok(())
            })
            .described("Run a custom SQL select query and display the results.")
            .args(vec![ArgSpec::string("<sql>").optional()]),
            None,
        ),
        (
            Command::new("SqlExecute", |app, args| {
                match args.first().and_then(ArgValue::as_str) {
                    Some(sql) => app.raw_execute(sql.to_string(), None),
                    None => app.request_editor(
                        crate::app::EditorPurpose::SqlExecute,
                        String::new(),
                        ".sql",
                    ),
                }
                Ok(())
            })
            .described("Execute a SQL statement without returning results.")
            .args(vec![ArgSpec::string("<sql>").optional()]),
            None,
        ),
        (
            Command::new("TruncateTable", |app, args| {
                let Some(table) = args.first().and_then(ArgValue::as_str) else {
                    return Ok(());
                };
                let cascade = args.get(1).and_then(ArgValue::as_str).is_some();
                let sql = match cascade {
                    true => format!("TRUNCATE TABLE \"{table}\" CASCADE"),
                    false => format!("TRUNCATE TABLE \"{table}\""),
                };
                let cascaded = if cascade { " with cascade" } else { "" };
                app.raw_execute(sql, Some(format!("Truncated table \"{table}\"{cascaded}")));
                Ok(())
            })
            .described("Remove all rows from the current table")
            .args(vec![
                ArgSpec::string("<table-name>"),
                ArgSpec::one_of("[cascade]", &["cascade", "c"]).optional(),
            ]),
            None,
        ),
        (
            Command::new("Messages", |app, _| {
                app.hop_to(crate::app::MESSAGES_QUERY.to_string());
                Ok(())
            })
            .described("Show all message history"),
            None,
        ),
        (
            Command::new("MessagesClear", |app, _| {
                app.messages.clear_history();
                app.messages.info("Message history cleared");
                Ok(())
            })
            .described("Clear all message history"),
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
            Command::new("DatabaseUrls", |app, _| {
                app.hop_to(crate::app::URLS_QUERY.to_string());
                Ok(())
            })
            .described("List the saved database urls as an editable table")
            .alias("urls"),
            None,
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
                app.state.saved_urls.retain(|saved| saved != url);
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

    all.extend(navigation());
    all.extend(editing());
    all
}

fn navigation() -> Vec<(Command, Option<&'static str>)> {
    vec![
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
        (
            Command::new("GoToForeignKeyRelation", |app, _| {
                app.go_to_foreign_key_relation();
                Ok(())
            })
            .described("Move to the entry where the cursor is at"),
            Some("g > d"),
        ),
        (
            Command::new("GoToReferences", |app, _| {
                app.go_to_references();
                Ok(())
            })
            .described("Show tables that reference the current cell's key value"),
            Some("g > r"),
        ),
    ]
}

fn editing() -> Vec<(Command, Option<&'static str>)> {
    vec![
        (
            Command::new("WriteChanges", |app, _| {
                app.write_changes();
                Ok(())
            })
            .described("Write pending cell changes and row deletions to the database.")
            .alias("w"),
            Some("w"),
        ),
        (
            Command::new("Undo", |app, _| {
                app.undo();
                Ok(())
            })
            .described("Undo latest changes"),
            Some("u"),
        ),
        (
            Command::new("DeleteRow", |app, _| {
                app.delete_selected_rows();
                Ok(())
            })
            .described("Mark the selected rows for deletion."),
            Some("d > d"),
        ),
        (
            Command::new("OpenCellEditor", |app, _| {
                app.open_cell_editor();
                Ok(())
            })
            .described("Open the cell editor for the current selection."),
            Some("c"),
        ),
        (
            Command::new("SelectionCopyToClipboard", |app, _| {
                app.copy_selection();
                Ok(())
            })
            .described("Copy the selected cells to the clipboard."),
            Some("y"),
        ),
        (
            Command::new("SelectionOpen", |app, args| {
                let (row, column) = app.cursor();
                let column = args.first().and_then(ArgValue::as_usize).unwrap_or(column);
                let row = args.get(1).and_then(ArgValue::as_usize).unwrap_or(row);
                app.open_cell(row, column);
                Ok(())
            })
            .described("Open a cell for inline viewing.")
            .args(vec![
                ArgSpec::number("<column>").optional(),
                ArgSpec::number("<row>").optional(),
            ]),
            Some("K"),
        ),
    ]
}

// --- scoped sets: registered while their overlay or mode is active ---

pub fn picker() -> Vec<(Command, Keybind)> {
    vec![
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
    ]
}

pub fn command_line() -> Vec<(Command, Keybind)> {
    vec![
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
            .described("Autocomplete the current command or show suggestions."),
            Keybind::new("CommandComplete", "Tab").override_input(),
        ),
        (
            Command::new("CommandShowAutocomplete", |app, _| {
                app.open_autocomplete();
                Ok(())
            })
            .described("Show the command autocomplete menu."),
            Keybind::new("CommandShowAutocomplete", "Control + Space").override_input(),
        ),
        (
            Command::new("CommandLinePreviousHistory", |app, _| {
                app.navigate_history(true);
                Ok(())
            })
            .described("Navigate to the previous command in history."),
            Keybind::new("CommandLinePreviousHistory", "ArrowUp | Control + k").override_input(),
        ),
        (
            Command::new("CommandLineNextHistory", |app, _| {
                app.navigate_history(false);
                Ok(())
            })
            .described("Navigate to the next command in history."),
            Keybind::new("CommandLineNextHistory", "ArrowDown | Control + j").override_input(),
        ),
    ]
}

pub fn autocomplete() -> Vec<(Command, Keybind)> {
    vec![
        (
            Command::new("CommandAutocompleteHide", |app, _| {
                app.close_autocomplete();
                Ok(())
            })
            .described("Hide the command autocomplete menu."),
            Keybind::new("CommandAutocompleteHide", "Escape").override_input(),
        ),
        (
            Command::new("CommandAutocompleteNext", |app, _| {
                app.autocomplete_next();
                Ok(())
            })
            .described("Select the next item in the autocomplete list."),
            Keybind::new("CommandAutocompleteNext", "Tab").override_input(),
        ),
        (
            Command::new("CommandCompletePrev", |app, _| {
                app.autocomplete_prev();
                Ok(())
            })
            .described("Select the previous item in the autocomplete list."),
            Keybind::new("CommandCompletePrev", "Control + Tab").override_input(),
        ),
        (
            Command::new("CommandAutocompleteAccept", |app, _| {
                app.accept_autocomplete();
                Ok(())
            })
            .described("Accept the selected autocomplete suggestion."),
            Keybind::new("CommandAutocompleteAccept", "Enter").override_input(),
        ),
    ]
}

pub fn help() -> Vec<(Command, Keybind)> {
    vec![
        (
            Command::new("AllKeybindHelpClose", |app, _| {
                app.close_help();
                Ok(())
            })
            .described("Close the keyboard shortcuts help."),
            Keybind::new("AllKeybindHelpClose", "Escape").override_input(),
        ),
        (
            Command::new("KeybindHelpSearch", |app, _| {
                app.start_help_search();
                Ok(())
            })
            .described("Search keybinds"),
            Keybind::new("KeybindHelpSearch", "/"),
        ),
    ]
}

pub fn help_search() -> Vec<(Command, Keybind)> {
    vec![(
        Command::new("KeybindHelpSearchStop", |app, _| {
            app.stop_help_search();
            Ok(())
        })
        .described("Stop searching"),
        Keybind::new("KeybindHelpSearchStop", "Escape").override_input(),
    )]
}

/// Registered only while the saved url list is on screen, so `e` does not
/// shadow anything anywhere else.
pub fn urls_page() -> Vec<(Command, Keybind)> {
    vec![(
        Command::new("DatabaseUrlEdit", |app, _| {
            app.open_cell_editor();
            Ok(())
        })
        .described("Edit the database url under the cursor."),
        Keybind::new("DatabaseUrlEdit", "e"),
    )]
}

/// Port of `useRegisterKeybindCommandOnConditional`: exactly one of these two is
/// registered at a time, so `v` enters visual mode and then leaves it.
pub fn visual_enter() -> Vec<(Command, Keybind)> {
    vec![(
        Command::new("VisualModeEnter", |app, _| {
            app.set_visual_mode(true);
            Ok(())
        })
        .described("Enter visual selection mode."),
        Keybind::new("VisualModeEnter", "v"),
    )]
}

pub fn visual_exit() -> Vec<(Command, Keybind)> {
    vec![(
        Command::new("VisualModeExit", |app, _| {
            app.set_visual_mode(false);
            Ok(())
        })
        .described("Exit visual selection mode."),
        Keybind::new("VisualModeExit", "Escape | v"),
    )]
}

fn distance(args: &[ArgValue]) -> usize {
    args.first()
        .and_then(ArgValue::as_usize)
        .filter(|distance| *distance > 0)
        .unwrap_or(1)
}
