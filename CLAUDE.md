# Tablezz

Keyboard-centric PostgreSQL table viewer for the terminal. Single Rust binary:
ratatui frontend + sqlx talking to postgres in process.

This is a port of an earlier Tauri 2 + SolidJS build; the layering was kept
deliberately (keybind pipeline, command registry, table model, config file
format are all 1:1). `git log main` has the TypeScript original if you need to
compare behaviour.

## Quality gates

Run before declaring work complete:

- `cargo test` — unit tests are colocated in `#[cfg(test)] mod tests`
- `cargo fmt`
- `cargo clippy --all-targets`

The end to end test in `src/app.rs` needs a database and is skipped without
one:

```sh
docker run -d --name tablezz-test -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=tablezz -p 55432:5432 postgres:16-alpine
TABLEZZ_TEST_DATABASE_URL=postgres://postgres:pw@localhost:55432/tablezz cargo test
```

After adding or renaming a command, regenerate the docs:

```sh
cargo run -- --commands > config/commands.md
cargo run -- --config-schema > config/schema.json
```

## Layout

```
src/
  main.rs         # terminal adapter: event loop, crossterm -> KeyEvent mapping, doc generators
  app.rs          # App: the single owner of state; command definitions live here
  ui.rs           # what is drawn, in what order
  keybinds/       # tokenizer -> parser -> checker -> formatter + the stacked registry
  commands/       # registry, ArgSpec, command line, `|` parser, messages
  config.rs       # ~/tablezz/config.json, serde + notify watcher
  state.rs        # ~/tablezz/state.json: hop stack, saved urls, command history
  db/             # sqlx queries + postgres -> JSON decoding
  table/          # Table/Row/Column/Cell, datatypes, column layout, renderer, SQL extraction
  picker.rs       # fuzzy picker overlay (nucleo)
config/           # generated docs — do not hand-edit
```

## Conventions

### Commands and keybinds

Commands are the only way UI actions happen — keybinds trigger commands, the
command line triggers commands. An action is a plain function:

```rust
type Action = fn(&mut App, &[ArgValue]) -> anyhow::Result<()>;
```

Every command lives in `commands/builtin.rs`, grouped by scope. `global()` is
always registered; the other sets (`picker()`, `command_line()`,
`autocomplete()`, `help()`, `visual_enter()` / `visual_exit()`) are registered
by `App::register_all` when their overlay or mode opens and dropped by
`unregister_all` when it closes — the port of the original's `onMount` /
`onCleanup`, and what lets an overlay shadow `Escape` or `Enter` while it is up.
Add a command to the right set rather than registering it ad hoc.

Arguments are declared with `ArgSpec` (the replacement for `actionArgs: ZodType[]`).
The `title` doubles as the command line hint, so keep it in `<angle>` /
`[bracket]` form.

`Keybinds` holds two stacks: config file binds take precedence over binds
registered in code, and the top of each stack wins.

### Async work

Nothing blocks the event loop. A command that needs the database calls
`App::spawn`, which sends a `Msg` back to the loop; `App::on_msg` applies it.
`Query<T>` (Idle/Loading/Ready/Failed) is what the UI switches on. Piped
commands wait for outstanding work via `drain_pending`, the equivalent of the
original's `waitForQueries()`.

State that must survive a restart goes in `state.rs` and is saved explicitly —
there is no autosave.

The editor is the one thing the loop has to do synchronously: a command sets
`app.editor_request`, and `main.rs` drops the event stream, hands the terminal
over, runs `$EDITOR`, then feeds the result back through
`App::on_editor_result`. Dropping the stream matters — otherwise it eats the
editor's input.

### Rendering

`table/render.rs` writes into the ratatui `Buffer` directly rather than using
the `Table` widget, because cell level styling (cursor, dirty, deleted) and
horizontal column scrolling need per cell control. Column widths come from
`table/layout.rs`, which samples the first 50 rows.

Scrolling is per row and per whole column, not per pixel: `Hop.scroll_y` is the
first visible row, `Hop.scroll_x` the first visible column.

### Errors

User facing failures go to `app.messages` (shown in the status bar, kept in
history). `anyhow::Result` from an action is turned into a message
automatically. Reserve panics for genuine invariants.

## Known gaps

- `ToggleMaximize` is gone; a terminal has no window to maximize. `Quit`
  (`Control + q`) is new, and `ReloadFull` moved to `Control + r` because
  terminals rarely deliver `Meta`.
- Table queries have no `ORDER BY`, so after a write postgres may return rows
  in a different order and the cursor ends up on a different row. The original
  behaved the same way; adding a sort would be a behaviour change.
- Timestamps render the way `time`'s `Display` writes them
  (`2026-08-24 9:18:54.939428 +00:00:00`), matching the old backend.
