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
    "d > d": "DeleteRow"
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

For a complete auto-generated list of all commands with source locations, see [config/commands.md](./config/commands.md).
