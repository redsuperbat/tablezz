# Tablezz

Tablezz is a keyboard-centric PostgreSQL table viewer built with Tauri.

## Configuration

Configuration is stored in a JSON format at:

```
~/tablezz/config.json
```

The configuration file is watched for changes and automatically reloaded.

For more configuration options see [the definition file](./config/definition.md)

## Keybinds

Tablezz uses a powerful keybind expression system inspired by Vim. Keybinds can be customized in your configuration file.

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
- `Shift` - Shift key

Multiple modifiers can be chained: `Control + Meta + s`

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

Use `>` to create multi-key sequences (Vim-style):

```json
{
  "keybinds": {
    "g > g": "GoToTop",
    "d > d": "DeleteRow",
    "s > u": "SelectionUndo"
  }
}
```

While entering a sequence, available next keys are shown in the UI.

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

### Keybind Formats

Short form (command name only):

```json
{
  "keybinds": {
    "w": "WriteChanges",
    "y": "SelectionCopyToClipboard"
  }
}
```

Long form (with description):

```json
{
  "keybinds": {
    "Leader > d": {
      "command": "PickerOpen databases",
      "description": "Open database picker"
    }
  }
}
```

### Available Commands

#### Navigation

| Command                  | Default Keybind | Description                       |
| ------------------------ | --------------- | --------------------------------- |
| `MoveCellUp`             | `k`             | Move cursor up                    |
| `MoveCellDown`           | `j`             | Move cursor down                  |
| `MoveCellLeft`           | `h`             | Move cursor left                  |
| `MoveCellRight`          | `l`             | Move cursor right                 |
| `GoToTop`                | `g > g`         | Jump to first row                 |
| `GoToBottom`             | `G`             | Jump to last row                  |
| `GoToLeftEnd`            | `^`             | Jump to first column              |
| `GoToRightEnd`           | `$`             | Jump to last column               |
| `GoUpHalf`               | `Control + u`   | Page up (half screen)             |
| `GoDownHalf`             | `Control + d`   | Page down (half screen)           |
| `GoBackward`             | `Control + o`   | Go back in history                |
| `GoToForeignKeyRelation` | `g > d`         | Navigate to foreign key reference |

#### Editing

| Command          | Default Keybind | Description                       |
| ---------------- | --------------- | --------------------------------- |
| `WriteChanges`   | `w`             | Write pending changes to database |
| `OpenCellEditor` | `c`             | Open terminal editor for cell     |
| `SelectionOpen`  | `K`             | Open cell for inline viewing      |
| `DeleteRow`      | `d > d`         | Mark row(s) for deletion          |
| `Undo`           | `u`             | Undo latest changes               |
| `SelectionUndo`  | `s > u`         | Undo changes in selected cells    |

#### Visual Selection

| Command                    | Default Keybind | Description                 |
| -------------------------- | --------------- | --------------------------- |
| `VisualModeEnter`          | `v`             | Enter visual selection mode |
| `VisualModeExit`           | `Escape \| v`   | Exit visual selection mode  |
| `SelectionCopyToClipboard` | `y`             | Copy selected cells         |

#### Data Operations

| Command         | Default Keybind | Description                           |
| --------------- | --------------- | ------------------------------------- |
| `ReloadTable`   | `r`             | Reload current table                  |
| `ReloadFull`    | `Meta + r`      | Reload all data from database         |
| `SqlQuery`      | —               | Run SQL query and display results     |
| `SqlExecute`    | —               | Execute SQL without returning results |
| `TruncateTable` | —               | Remove all rows from table            |

#### Picker

| Command            | Default Keybind            | Description             |
| ------------------ | -------------------------- | ----------------------- |
| `PickerOpen`       | `Leader > Space`           | Open picker dialog      |
| `PickerSelect`     | `Enter`                    | Select highlighted item |
| `PickerSelectNext` | `Control + j \| ArrowDown` | Move to next item       |
| `PickerSelectPrev` | `Control + k \| ArrowUp`   | Move to previous item   |
| `PickerClose`      | `Escape`                   | Close picker            |

#### Command Line

| Command                     | Default Keybind   | Description                    |
| --------------------------- | ----------------- | ------------------------------ |
| `CommandLineActivate`       | `:`               | Open command line              |
| `CommandLineClose`          | `Escape`          | Close command line             |
| `CommandAccept`             | `Enter`           | Execute command                |
| `CommandShowAutocomplete`   | `Control + Space` | Show autocomplete              |
| `CommandAutocompleteAccept` | `Tab`             | Accept autocomplete suggestion |

#### Help

| Command               | Default Keybind | Description       |
| --------------------- | --------------- | ----------------- |
| `KeybindHelpShow`     | `?`             | Show keybind help |
| `KeybindHelpSearch`   | `/`             | Search keybinds   |
| `AllKeybindHelpClose` | `Escape`        | Close help dialog |

### Command Variables

Commands support variable substitution:

| Variable | Description            |
| -------- | ---------------------- |
| `%`      | Current table name     |
| `&`      | Current cell SQL value |
| `@`      | Current column name    |

### Example Configuration

```json
{
  "leaderKey": "Space",
  "keybinds": {
    "h": "MoveCellLeft",
    "j": "MoveCellDown",
    "k": "MoveCellUp",
    "l": "MoveCellRight",
    "g > g": "GoToTop",
    "G": "GoToBottom",
    "^": "GoToLeftEnd",
    "$": "GoToRightEnd",
    "Control + u": "GoUpHalf",
    "Control + d": "GoDownHalf",
    "v": "VisualModeEnter",
    "y": "SelectionCopyToClipboard",
    "d > d": "DeleteRow",
    "w": "WriteChanges",
    "u": "Undo",
    "c": "OpenCellEditor",
    "r": "ReloadTable",
    ":": "CommandLineActivate",
    "?": "KeybindHelpShow",
    "Leader > Space": "PickerOpen",
    "Leader > d": {
      "command": "PickerOpen databases",
      "description": "Switch database"
    }
  },
  "commandAliases": {
    "w": "WriteChanges",
    "d": "DeleteRow",
    "q": "PickerOpen"
  },
  "editor": "nvim",
  "terminalFont": "Fira Code"
}
```
