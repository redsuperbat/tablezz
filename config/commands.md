# Commands

This file is auto-generated. Do not edit manually.

| Command | Description | Keybind | Source |
|---------|-------------|---------|--------|
| AllKeybindHelpClose | Close the keyboard shortcuts help. | `Escape` | [src/keybinds/AllKeybindsHelp.tsx:10](https://github.com/redsuperbat/tablezz/blob/main/src/keybinds/AllKeybindsHelp.tsx#L10) |
| CommandAccept | Execute the current command. | `Enter` | [src/commands/CommandLine.tsx:356](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L356) |
| CommandAutocompleteAccept | Accept the selected autocomplete suggestion. | `Enter` | [src/commands/CommandLine.tsx:76](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L76) |
| CommandAutocompleteHide | Hide the command autocomplete menu. | `Escape` | [src/commands/CommandLine.tsx:41](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L41) |
| CommandAutocompleteNext | Select the next item in the autocomplete list. | `Tab` | [src/commands/CommandLine.tsx:49](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L49) |
| CommandComplete | Autocomplete the current command or show suggestions. | `Tab` | [src/commands/CommandLine.tsx:174](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L174) |
| CommandCompletePrev | Select the previous item in the autocomplete list. | `Control + Tab` | [src/commands/CommandLine.tsx:66](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L66) |
| CommandLineActivate | Open the command line. | `:` | [src/commands/CommandLine.tsx:405](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L405) |
| CommandLineClear | Clear the command line input. | `Control + c` | [src/commands/CommandLine.tsx:294](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L294) |
| CommandLineClearHistory | Clear all command history. | - | [src/commands/CommandLine.tsx:305](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L305) |
| CommandLineClose | Close the command line. | `Escape` | [src/commands/CommandLine.tsx:286](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L286) |
| CommandLineNextHistory | Navigate to the next command in history. | `ArrowDown \| Control + j` | [src/commands/CommandLine.tsx:336](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L336) |
| CommandLinePreviousHistory | Navigate to the previous command in history. | `ArrowUp \| Control + k` | [src/commands/CommandLine.tsx:346](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L346) |
| CommandShowAutocomplete | Show the command autocomplete menu. | `Control + Space` | [src/commands/CommandLine.tsx:164](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L164) |
| DatabaseUrlAdd | Set the database connection URL and save it. | - | [src/ConnectionCredentialsProvider.tsx:71](https://github.com/redsuperbat/tablezz/blob/main/src/ConnectionCredentialsProvider.tsx#L71) |
| DatabaseUrlClear | Clear the current database connection URL. | - | [src/ConnectionCredentialsProvider.tsx:80](https://github.com/redsuperbat/tablezz/blob/main/src/ConnectionCredentialsProvider.tsx#L80) |
| DatabaseUrlRemove | Remove a saved database URL from the list. | - | [src/ConnectionCredentialsProvider.tsx:88](https://github.com/redsuperbat/tablezz/blob/main/src/ConnectionCredentialsProvider.tsx#L88) |
| DeleteRow | Mark the selected rows for deletion. | `d > d` | [src/table/DataTableProvider.tsx:554](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L554) |
| GoBackward |  | `Control + o` | [src/table/DataTableProvider.tsx:336](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L336) |
| GoDownHalf | Move down by half a page. | `Control + d` | [src/table/DataTableProvider.tsx:471](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L471) |
| GoToBottom | Move to the last row of the table. | `G` | [src/table/DataTableProvider.tsx:464](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L464) |
| GoToForeignKeyRelation | Move to the entry where the cursor is at | `g > d` | [src/table/DataTableProvider.tsx:344](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L344) |
| GoToLeftEnd | Move the cursor to the left end of the table. | `^` | [src/table/DataTableProvider.tsx:496](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L496) |
| GoToReferences | Show tables that reference the current cell's key value | `g > r` | [src/table/DataTableProvider.tsx:369](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L369) |
| GoToRightEnd | Move the cursor to the right end of the table. | `$` | [src/table/DataTableProvider.tsx:505](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L505) |
| GoToTop | Move to the first row of the table. | `g > g` | [src/table/DataTableProvider.tsx:489](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L489) |
| GoUpHalf | Move up by half a page. | `Control + u` | [src/table/DataTableProvider.tsx:480](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L480) |
| KeybindHelpSearch | Search keybinds | `/` | [src/keybinds/KeybindHelp.tsx:98](https://github.com/redsuperbat/tablezz/blob/main/src/keybinds/KeybindHelp.tsx#L98) |
| KeybindHelpSearchStop | Stop searching | `Escape` | [src/keybinds/KeybindHelp.tsx:24](https://github.com/redsuperbat/tablezz/blob/main/src/keybinds/KeybindHelp.tsx#L24) |
| KeybindHelpShow | Show available keyboard shortcuts. | `?` | [src/keybinds/AllKeybindsHelp.tsx:22](https://github.com/redsuperbat/tablezz/blob/main/src/keybinds/AllKeybindsHelp.tsx#L22) |
| Messages | Show all message history | - | [src/commands/CommandLine.tsx:411](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L411) |
| MessagesClear | Clear all message history | - | [src/commands/CommandLine.tsx:419](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L419) |
| MoveCellDown | Move the cursor down by one or more cells. | `j` | [src/table/DataTableProvider.tsx:544](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L544) |
| MoveCellLeft | Move the cursor left by one or more cells. | `h` | [src/table/DataTableProvider.tsx:524](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L524) |
| MoveCellRight | Move the cursor right by one or more cells. | `l` | [src/table/DataTableProvider.tsx:514](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L514) |
| MoveCellUp | Move the cursor up by one or more cells. | `k` | [src/table/DataTableProvider.tsx:534](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L534) |
| OpenCellEditor | Open the cell editor for the current selection. | `c` | [src/table/DataTableProvider.tsx:294](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L294) |
| PickerClose | Close the picker dialog. | `Escape` | [src/picker/usePicker.tsx:109](https://github.com/redsuperbat/tablezz/blob/main/src/picker/usePicker.tsx#L109) |
| PickerOpen | Open the picker to pick items | `Leader > Space` | [src/Picker.tsx:23](https://github.com/redsuperbat/tablezz/blob/main/src/Picker.tsx#L23) |
| PickerSelect | Select the highlighted item in the picker. | `Enter` | [src/picker/usePicker.tsx:140](https://github.com/redsuperbat/tablezz/blob/main/src/picker/usePicker.tsx#L140) |
| PickerSelectNext | Move to the next item in the picker. | `(Control + j) \| ArrowDown` | [src/picker/usePicker.tsx:162](https://github.com/redsuperbat/tablezz/blob/main/src/picker/usePicker.tsx#L162) |
| PickerSelectPrev | Move to the previous item in the picker. | `(Control + k) \| ArrowUp` | [src/picker/usePicker.tsx:152](https://github.com/redsuperbat/tablezz/blob/main/src/picker/usePicker.tsx#L152) |
| ReloadFull | Reload all data from the database. | `Meta + r` | [src/GlobalKeybinds.tsx:25](https://github.com/redsuperbat/tablezz/blob/main/src/GlobalKeybinds.tsx#L25) |
| ReloadTable | Reload the current table data. | `r` | [src/table/DataTable.tsx:160](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTable.tsx#L160) |
| SelectionCopyToClipboard | Copy the selected cells to the clipboard. | `y` | [src/table/DataTable.tsx:170](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTable.tsx#L170) |
| SelectionOpen | Open a cell for inline viewing. | `K` | [src/table/DataTable.tsx:185](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTable.tsx#L185) |
| SqlExecute | Execute a SQL statement without returning results. | - | [src/GlobalKeybinds.tsx:35](https://github.com/redsuperbat/tablezz/blob/main/src/GlobalKeybinds.tsx#L35) |
| SqlSelect | Run a custom SQL select query and display the results. | - | [src/table/DataTableProvider.tsx:138](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L138) |
| ToggleMaximize | Toggle maximize window. | `Meta + Enter` | [src/GlobalKeybinds.tsx:15](https://github.com/redsuperbat/tablezz/blob/main/src/GlobalKeybinds.tsx#L15) |
| TruncateTable | Remove all rows from the current table | - | [src/table/DataTableProvider.tsx:577](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L577) |
| Undo | Undo latest changes | `u` | [src/table/DataTableProvider.tsx:283](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L283) |
| VisualModeEnter | Enter visual selection mode. | `v` | [src/table/DataTableProvider.tsx:189](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L189) |
| VisualModeExit | Exit visual selection mode. | `Escape \| v` | [src/table/DataTableProvider.tsx:189](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L189) |
| WriteChanges | Write pending cell changes and row deletions to the database. | `w` | [src/table/DataTableProvider.tsx:209](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L209) |
