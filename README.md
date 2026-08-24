# Tablezz

Tablezz is a keyboard-centric PostgreSQL table viewer for the terminal, built
with [ratatui](https://ratatui.rs).

## Installing

With nix flakes, either take the package straight from the input:

```nix
{
  inputs.tablezz.url = "github:redsuperbat/tablezz";

  outputs = {nixpkgs, tablezz, ...}: {
    # nixos, home-manager, anywhere a package list goes
    environment.systemPackages = [tablezz.packages.x86_64-linux.default];
  };
}
```

or add the overlay and use `pkgs.tablezz`:

```nix
{
  nixpkgs.overlays = [tablezz.overlays.default];
  environment.systemPackages = [pkgs.tablezz];
}
```

To try it without installing anything:

```sh
nix run github:redsuperbat/tablezz -- postgres://user:password@localhost/mydb
```

The flake covers `x86_64-linux`, `aarch64-linux`, `x86_64-darwin` and
`aarch64-darwin`. Windows is not a nix platform, so build it with cargo there:

```sh
cargo build --release
```

## Running

```sh
cargo run -- postgres://user:password@localhost/mydb
```

The connection url is remembered, so subsequent runs need no argument. You can
also add one from inside the app with `:DatabaseUrlAdd <url>`, and switch
between saved ones with `:PickerOpen urls`.

`cargo run -- --commands` prints the command reference, `--config-schema` the
JSON schema for the configuration file.

## Configuration

Configuration is stored in a JSON format at:

```
~/tablezz/config.json
```

The configuration file is watched for changes and automatically reloaded. Set
`TABLEZZ_HOME` to keep it (and the persisted session state) somewhere else.

| Option           | Default   | Description                                        |
| ---------------- | --------- | -------------------------------------------------- |
| `leaderKey`      | `Space`   | Prefix used by the `Leader` token in keybinds       |
| `keybinds`       | `{}`      | Keybind expression -> command                       |
| `commandAliases` | `{}`      | Short name -> command name                          |
| `editor`         | `nvim`    | Terminal editor invoked when editing cells          |

A JSON schema for editor completion lives in
[config/schema.json](./config/schema.json):

```json
{
  "$schema": "https://raw.githubusercontent.com/redsuperbat/tablezz/refs/heads/main/config/schema.json",
  "leaderKey": "Space",
  "keybinds": {
    "g > l": "GoToRightEnd",
    "Leader > d": {
      "command": "PickerOpen databases",
      "description": "Change database"
    }
  }
}
```

Session state (connection urls, the hop stack, command history) is kept
separately in `~/tablezz/state.json`.

## Keybinds

Tablezz uses a powerful keybind expression system inspired by Vim. Keybinds can be customized in your configuration file.

### Available Commands

For a complete auto-generated list of all commands with their arguments, default
keybinds and the scope they are active in, see
[config/commands.md](./config/commands.md).

### Syntax

Keybind expressions support the following operators:

| Operator | Description                                    | Example                    |
| -------- | ---------------------------------------------- | -------------------------- |
| `+`      | Combine modifier with key (simultaneous press) | `Control + a`              |
| `>`      | Sequence (press keys one after another)        | `g > g`                    |
| `\|`     | OR (alternative keys)                          | `Escape \| v`              |
| `()`     | Grouping for precedence                        | `(Control + k) \| ArrowUp` |

### Modifiers

Modifiers must be combined with keys using `+`:

- `Control` - Ctrl key
- `Alt` - Alt/Option key
- `Meta` - Cmd (Mac) / Windows key

Multiple modifiers can be chained: `Control + Meta + s`. Note that terminals
rarely deliver `Meta`, so prefer `Control` for terminal keybinds.

### Special Keys

Common named keys:

- `Enter`, `Tab`, `Backspace`, `Delete`, `Escape`, `Space`
- `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- `Home`, `End`, `PageUp`, `PageDown`
- `F1` through `F24`

### Leader Key

The leader key acts as a prefix to namespace keybinds and avoid conflicts. Default: `Space`

Use `Leader` in expressions to reference it:

```json
{
  "leaderKey": "Space",
  "keybinds": {
    "Leader > d": "PickerOpen databases",
    "Leader > Space": "PickerOpen"
  }
}
```

Pressing `Space` then `d` triggers `PickerOpen databases`.

You can change the leader key to any valid expression:

```json
{
  "leaderKey": "Control + Space"
}
```

### Key Sequences

Use `>` to create multi-key sequences:

```json
{
  "keybinds": {
    "g > g": "GoToTop",
    "d > d": "DeleteRow"
  }
}
```

While entering a sequence, available next keys are shown in the status bar.

### Alternative Bindings

Use `|` to allow multiple keys to trigger the same command:

```json
{
  "keybinds": {
    "Escape | v": "VisualModeExit",
    "(Control + j) | ArrowDown": "MoveCellDown",
    "(Control + k) | ArrowUp": "MoveCellUp"
  }
}
```

## Reading the table

Column headers carry one-character markers before the name, and a `?` after it
when the column is nullable:

| Marker | Meaning                                                              |
| ------ | -------------------------------------------------------------------- |
| `*`    | Primary key                                                          |
| `>`    | Foreign key                                                          |
| `#`    | Number — `integer`, `bigint`, `smallint`, `numeric`, `real`, ...      |
| `a`    | Text — `text`, `varchar`, `char`, `uuid`, `citext`                    |
| `t`    | Date or time — `date`, `time`, `timestamp`, with or without zone      |
| `b`    | Boolean                                                              |
| `{`    | `json` or `jsonb`                                                    |
| `[`    | Array                                                                |
| `~`    | `vector`                                                             |
| `?`    | Nullable                                                             |

Anything else — enums, domains, user-defined types — gets no type marker.
`* # id` is a primary key holding a number, `> # org_id?` a nullable foreign
key holding a number.

Cells are marked by state: the cursor is inverted, a visual selection has a
blue background with the anchor cell in cyan, edited cells are yellow until
written, and rows marked for deletion are struck through in red.

## Editing

Move the cursor with `hjkl`, enter visual mode with `v` to select a block, then:

| Key   | Does                                                        |
| ----- | ----------------------------------------------------------- |
| `c`   | Open the selection in `$EDITOR` (tab/newline delimited)      |
| `d d` | Mark the selected rows for deletion                          |
| `u`   | Undo the last change                                         |
| `w`   | Write pending changes to the database, in one transaction     |
| `y`   | Copy the selection to the clipboard                          |
| `K`   | Show the full value of the cell under the cursor             |

Edits are local until `w`; the status bar shows `[+n]` while changes are
pending, dirty cells are highlighted and rows marked for deletion are struck
through. Writing needs a primary key on the table.

`g d` follows the foreign key under the cursor, `g r` finds the tables that
reference it. `?` lists every keybind, and `/` searches that list.

## Command line

Press `:` to open the command line. `Tab` completes, `Enter` runs. Commands can
be chained with `|`, and arguments are parsed against the command's argument
spec.

Three variables are expanded inside a command, from the cell the cursor is on:

| Variable | Expands to             |
| -------- | ---------------------- |
| `%`      | The current table name |
| `@`      | The current column     |
| `&`      | The current cell value |

```
:SqlSelect `select * from % where @ = &`
```

Prefix a variable with `\` to write it literally.

## Aliases

`:q` and `:w` are built in, and `commandAliases` in the config file adds more:

```json
{
  "commandAliases": {
    "t": "TruncateTable",
    "reload": "ReloadFull"
  }
}
```

Aliases work everywhere a command name does, including the autocomplete list.
A config alias overrides a built-in one of the same name, and a real command
name always wins over both. [config/commands.md](./config/commands.md) lists
which commands ship with an alias.
