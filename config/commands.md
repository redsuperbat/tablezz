# Commands

This file is auto-generated. Do not edit manually.

| Command | Description | Keybind | Source |
|---------|-------------|---------|--------|
| AllKeybindHelpClose | Close the keyboard shortcuts help. | `Escape` | [src/keybinds/AllKeybindsHelp.tsx:10](https://github.com/redsuperbat/tablezz/blob/main/src/keybinds/AllKeybindsHelp.tsx#L10) |
| CommandAccept | Execute the current command. | `Enter` | [src/commands/CommandLine.tsx:283](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L283) |
| CommandAutocompleteAccept | Accept the selected autocomplete suggestion. | `Enter` | [src/commands/CommandLine.tsx:76](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L76) |
| CommandAutocompleteHide | Hide the command autocomplete menu. | `Escape` | [src/commands/CommandLine.tsx:41](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L41) |
| CommandAutocompleteNext | Select the next item in the autocomplete list. | `Tab` | [src/commands/CommandLine.tsx:49](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L49) |
| CommandComplete | Autocomplete the current command or show suggestions. | `Tab` | [src/commands/CommandLine.tsx:173](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L173) |
| CommandCompletePrev | Select the previous item in the autocomplete list. | `Control + Tab` | [src/commands/CommandLine.tsx:66](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L66) |
| CommandLineActivate | Open the command line. | `:` | [src/commands/CommandLine.tsx:323](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L323) |
| CommandLineClearHistory | Clear all command history. | - | [src/commands/CommandLine.tsx:245](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L245) |
| CommandLineClose | Close the command line. | `Escape` | [src/commands/CommandLine.tsx:237](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L237) |
| CommandLineNextHistory | Navigate to the next command in history. | `ArrowDown \| Control + j` | [src/commands/CommandLine.tsx:253](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L253) |
| CommandLinePreviousHistory | Navigate to the previous command in history. | `ArrowUp \| Control + k` | [src/commands/CommandLine.tsx:268](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L268) |
| CommandShowAutocomplete | Show the command autocomplete menu. | `Control + Space` | [src/commands/CommandLine.tsx:163](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L163) |
| DatabaseUrlAdd | Set the database connection URL and save it. | - | [src/ConnectionCredentialsProvider.tsx:67](https://github.com/redsuperbat/tablezz/blob/main/src/ConnectionCredentialsProvider.tsx#L67) |
| DatabaseUrlClear | Clear the current database connection URL. | - | [src/ConnectionCredentialsProvider.tsx:76](https://github.com/redsuperbat/tablezz/blob/main/src/ConnectionCredentialsProvider.tsx#L76) |
| DatabaseUrlRemove | Remove a saved database URL from the list. | - | [src/ConnectionCredentialsProvider.tsx:84](https://github.com/redsuperbat/tablezz/blob/main/src/ConnectionCredentialsProvider.tsx#L84) |
| DeleteRow | Mark the selected rows for deletion. | `d > d` | [src/table/DataTableProvider.tsx:560](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L560) |
| GoBackward |  | `Control + o` | [src/table/DataTableProvider.tsx:342](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L342) |
| GoDownHalf | Move down by half a page. | `Control + d` | [src/table/DataTableProvider.tsx:477](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L477) |
| GoToBottom | Move to the last row of the table. | `G` | [src/table/DataTableProvider.tsx:470](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L470) |
| GoToForeignKeyRelation | Move to the entry where the cursor is at | `g > d` | [src/table/DataTableProvider.tsx:350](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L350) |
| GoToLeftEnd | Move the cursor to the left end of the table. | `^` | [src/table/DataTableProvider.tsx:502](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L502) |
| GoToReferences | Show tables that reference the current cell's key value | `g > r` | [src/table/DataTableProvider.tsx:375](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L375) |
| GoToRightEnd | Move the cursor to the right end of the table. | `$` | [src/table/DataTableProvider.tsx:511](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L511) |
| GoToTop | Move to the first row of the table. | `g > g` | [src/table/DataTableProvider.tsx:495](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L495) |
| GoUpHalf | Move up by half a page. | `Control + u` | [src/table/DataTableProvider.tsx:486](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L486) |
| KeybindHelpSearch | Search keybinds | `/` | [src/keybinds/KeybindHelp.tsx:98](https://github.com/redsuperbat/tablezz/blob/main/src/keybinds/KeybindHelp.tsx#L98) |
| KeybindHelpSearchStop | Stop searching | `Escape` | [src/keybinds/KeybindHelp.tsx:24](https://github.com/redsuperbat/tablezz/blob/main/src/keybinds/KeybindHelp.tsx#L24) |
| KeybindHelpShow | Show available keyboard shortcuts. | `?` | [src/keybinds/AllKeybindsHelp.tsx:22](https://github.com/redsuperbat/tablezz/blob/main/src/keybinds/AllKeybindsHelp.tsx#L22) |
| Messages | Show all message history | - | [src/commands/CommandLine.tsx:329](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L329) |
| MessagesClear | Clear all message history | - | [src/commands/CommandLine.tsx:337](https://github.com/redsuperbat/tablezz/blob/main/src/commands/CommandLine.tsx#L337) |
| MoveCellDown | Move the cursor down by one or more cells. | `j` | [src/table/DataTableProvider.tsx:550](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L550) |
| MoveCellLeft | Move the cursor left by one or more cells. | `h` | [src/table/DataTableProvider.tsx:530](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L530) |
| MoveCellRight | Move the cursor right by one or more cells. | `l` | [src/table/DataTableProvider.tsx:520](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L520) |
| MoveCellUp | Move the cursor up by one or more cells. | `k` | [src/table/DataTableProvider.tsx:540](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L540) |
| OpenCellEditor | Open the cell editor for the current selection. | `c` | [src/table/DataTableProvider.tsx:300](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L300) |
| PickerClose | Close the picker dialog. | `Escape` | [src/picker/usePicker.tsx:106](https://github.com/redsuperbat/tablezz/blob/main/src/picker/usePicker.tsx#L106) |
| PickerOpen | Open the picker to pick items | `Leader > Space` | [src/Picker.tsx:23](https://github.com/redsuperbat/tablezz/blob/main/src/Picker.tsx#L23) |
| PickerSelect | Select the highlighted item in the picker. | `Enter` | [src/picker/usePicker.tsx:137](https://github.com/redsuperbat/tablezz/blob/main/src/picker/usePicker.tsx#L137) |
| PickerSelectNext | Move to the next item in the picker. | `(Control + j) \| ArrowDown` | [src/picker/usePicker.tsx:159](https://github.com/redsuperbat/tablezz/blob/main/src/picker/usePicker.tsx#L159) |
| PickerSelectPrev | Move to the previous item in the picker. | `(Control + k) \| ArrowUp` | [src/picker/usePicker.tsx:149](https://github.com/redsuperbat/tablezz/blob/main/src/picker/usePicker.tsx#L149) |
| ReloadFull | Reload all data from the database. | `Meta + r` | [src/GlobalKeybinds.tsx:25](https://github.com/redsuperbat/tablezz/blob/main/src/GlobalKeybinds.tsx#L25) |
| ReloadTable | Reload the current table data. | `r` | [src/table/DataTable.tsx:108](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTable.tsx#L108) |
| SelectionCopyToClipboard | Copy the selected cells to the clipboard. | `y` | [src/table/DataTable.tsx:118](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTable.tsx#L118) |
| SelectionOpen | Open a cell for inline viewing. | `K` | [src/table/DataTable.tsx:134](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTable.tsx#L134) |
| SqlExecute | Execute a SQL statement without returning results. | - | [src/GlobalKeybinds.tsx:35](https://github.com/redsuperbat/tablezz/blob/main/src/GlobalKeybinds.tsx#L35) |
| SqlSelect | Run a custom SQL select query and display the results. | - | [src/table/DataTableProvider.tsx:144](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L144) |
| ToggleMaximize | Toggle maximize window. | `Meta + Enter` | [src/GlobalKeybinds.tsx:15](https://github.com/redsuperbat/tablezz/blob/main/src/GlobalKeybinds.tsx#L15) |
| TruncateTable | Remove all rows from the current table | - | [src/table/DataTableProvider.tsx:583](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L583) |
| Undo | Undo latest changes | `u` | [src/table/DataTableProvider.tsx:289](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L289) |
| VisualModeEnter | Enter visual selection mode. | `v` | [src/table/DataTableProvider.tsx:195](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L195) |
| VisualModeExit | Exit visual selection mode. | `Escape \| v` | [src/table/DataTableProvider.tsx:195](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L195) |
| WriteChanges | Write pending cell changes and row deletions to the database. | `w` | [src/table/DataTableProvider.tsx:215](https://github.com/redsuperbat/tablezz/blob/main/src/table/DataTableProvider.tsx#L215) |
