import { Match, Show, Switch } from "solid-js";
import { useCommandsContext } from "./commands/CommandsContext";
import { createWatcher } from "./commands/createWatcher";
import { QueryHistory } from "./database/QueryHistoryProvider";
import { useRegisterKeybindToggle } from "./keybinds/useRegisterKeybindToggle";
import { ReloadKeybind } from "./ReloadKeybind";
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
  const structureData = () => structure.data ?? [];

  const rowsWithStructure = () => {
    if (!rows.data) {
      return;
    }

    return [
      structureData().reduce(
        (acc, curr) => {
          acc[curr.column_name] = curr.column_name;
          return acc;
        },
        {} as Record<string, unknown>,
      ),
      ...rows.data,
    ];
  };

  createWatcher(count, ({ next }) =>
    commandContext.addCommandLineSuffix(
      <div class="text-zinc-500">
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
      <ReloadKeybind
        reload={() => {
          rows.refetch();
          structure.refetch();
        }}
      />
      <Switch>
        <Match when={rows.error}>{(error) => error().message}</Match>
        <Match when={rowsWithStructure()}>
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
