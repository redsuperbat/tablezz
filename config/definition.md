## Tablezz Configuration Type

`object` ([Tablezz Configuration](definition.md))

# Tablezz Configuration Properties

| Property                          | Type     | Required | Nullable       | Defined by                                                                                               |
| :-------------------------------- | :------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------- |
| [leaderKey](#leaderkey)           | `string` | Optional | cannot be null | [Tablezz Configuration](definition-properties-leader-key.md "undefined#/properties/leaderKey")           |
| [keybinds](#keybinds)             | `object` | Optional | cannot be null | [Tablezz Configuration](definition-properties-keybinds.md "undefined#/properties/keybinds")              |
| [commandAliases](#commandaliases) | `object` | Optional | cannot be null | [Tablezz Configuration](definition-properties-command-aliases.md "undefined#/properties/commandAliases") |
| [editor](#editor)                 | `string` | Optional | cannot be null | [Tablezz Configuration](definition-properties-editor.md "undefined#/properties/editor")                  |
| [terminalFont](#terminalfont)     | `string` | Optional | cannot be null | [Tablezz Configuration](definition-properties-terminal-font.md "undefined#/properties/terminalFont")     |

## leaderKey

The leader key

`leaderKey`

* is optional

* Type: `string` ([Leader Key](definition-properties-leader-key.md))

* cannot be null

* defined in: [Tablezz Configuration](definition-properties-leader-key.md "undefined#/properties/leaderKey")

### leaderKey Type

`string` ([Leader Key](definition-properties-leader-key.md))

### leaderKey Default Value

The default value is:

```json
"Space"
```

## keybinds

Configure custom keybinds which trigger predefined commands

`keybinds`

* is optional

* Type: `object` ([Keybinds](definition-properties-keybinds.md))

* cannot be null

* defined in: [Tablezz Configuration](definition-properties-keybinds.md "undefined#/properties/keybinds")

### keybinds Type

`object` ([Keybinds](definition-properties-keybinds.md))

### keybinds Default Value

The default value is:

```json
{}
```

## commandAliases

Specify aliases to alias long named commands

`commandAliases`

* is optional

* Type: `object` ([Command Aliases](definition-properties-command-aliases.md))

* cannot be null

* defined in: [Tablezz Configuration](definition-properties-command-aliases.md "undefined#/properties/commandAliases")

### commandAliases Type

`object` ([Command Aliases](definition-properties-command-aliases.md))

### commandAliases Default Value

The default value is:

```json
{}
```

## editor

The terminal editor which will be invoked when editing cells

`editor`

* is optional

* Type: `string` ([Editor](definition-properties-editor.md))

* cannot be null

* defined in: [Tablezz Configuration](definition-properties-editor.md "undefined#/properties/editor")

### editor Type

`string` ([Editor](definition-properties-editor.md))

### editor Default Value

The default value is:

```json
"nvim"
```

## terminalFont

Font family for the terminal editor

`terminalFont`

* is optional

* Type: `string` ([Terminal Font](definition-properties-terminal-font.md))

* cannot be null

* defined in: [Tablezz Configuration](definition-properties-terminal-font.md "undefined#/properties/terminalFont")

### terminalFont Type

`string` ([Terminal Font](definition-properties-terminal-font.md))

### terminalFont Default Value

The default value is:

```json
"Fira Code"
```
