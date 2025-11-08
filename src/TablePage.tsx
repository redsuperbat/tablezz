import { Match, Show, Switch } from "solid-js";
import { useCommandsContext } from "./commands/CommandsContext";
import { createWatcher } from "./commands/createWatcher";
import { QueryHistory } from "./database/QueryHistoryProvider";
import { useRegisterKeybindToggle } from "./keybinds/useRegisterKeybindToggle";
import { useSelectedTableContext } from "./SelectedTableProvider";
import { Table } from "./table/Table";
import { TableEditorProvider } from "./table/TableEditorProvider";
import { useTableCount } from "./useTableCount";
import { useTableRows } from "./useTableRows";
import { useTableStructure } from "./useTableStructure";

export function TablePage() {
  const { selectedTable } = useSelectedTableContext();
  const commandContext = useCommandsContext();

  const showQueryHistory = useRegisterKeybindToggle({
    command: "ToggleQueryHistory",
    keybindExpression: "Leader > q",
    initialValue: false,
  });

  const gridTemplateRows = () =>
    [selectedTable(), showQueryHistory.value()]
      .filter(Boolean)
      .map(() => "1fr")
      .join(" ");

  const rows = useTableRows(selectedTable);
  const count = useTableCount(selectedTable);
  const structure = useTableStructure(selectedTable);

  createWatcher(count, ({ next }) =>
    commandContext.addCommandLineSuffix(
      <div>
        {rows.data?.length}/{next} rows
      </div>,
    ),
  );

  return (
    <div
      class="grid h-full overflow-hidden"
      style={{
        "grid-template-rows": gridTemplateRows(),
      }}
    >
      <Switch>
        <Match when={rows.error}>{(error) => error().message}</Match>
        <Match when={rows.data}>
          {(rows) => (
            <TableEditorProvider rows={rows()}>
              <Table
                rows={rows()}
                structure={(structure.data ?? []).map((d) => ({
                  columnName: d.column_name,
                  dataType: d.data_type,
                }))}
              />
            </TableEditorProvider>
          )}
        </Match>
      </Switch>

      <Show when={showQueryHistory.value()}>
        <QueryHistory />
      </Show>
    </div>
  );
}
