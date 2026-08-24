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

Global commands are registered in `App::register_commands`. Commands scoped to
an overlay are registered when it opens and unregistered when it closes (see
`App::open_picker` / `open_command_line`) — that is the port of the original's
`onMount` / `onCleanup` registration, and it is what lets an overlay shadow
`Escape` or `Enter` while it is up.

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

## Not ported yet

The second pass of the port still owes: cell editing via `$EDITOR`, visual
selection mode, `WriteChanges` / `DeleteRow` / `Undo`, foreign key navigation
(`g > d`, `g > r`), the keybind help overlay, command line history search and
the autocomplete popup, the messages page, clipboard yank and `TruncateTable`.
The model layers those need are already ported, which is why `main.rs` carries
a crate level `#![allow(dead_code)]` — remove it as they get wired up.
