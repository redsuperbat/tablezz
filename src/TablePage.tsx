import { Match, Show, Switch } from "solid-js";
import { QueryHistory } from "./database/QueryHistoryProvider";
import { useRegisterKeybindToggle } from "./keybinds/useRegisterKeybindToggle";
import { useSelectedTableContext } from "./SelectedTableProvider";
import { DataTable } from "./table/DataTable";
import { DataTableProvider } from "./table/DataTableProvider";
import { useTableRows } from "./useTableRows";
import { useTableStructure } from "./useTableStructure";

export function TablePage() {
  const { selectedTable } = useSelectedTableContext();

  const showQueryHistory = useRegisterKeybindToggle({
    command: "ToggleQueryHistory",
    description: "Show or hide the SQL query history panel.",
    keybindExpression: "Leader > q",
    initialValue: false,
  });

  const gridTemplateRows = () =>
    [selectedTable(), showQueryHistory.value()]
      .filter(Boolean)
      .map(() => "1fr")
      .join(" ");

  const structureQuery = useTableStructure(selectedTable);
  const structureData = () => structureQuery.data ?? [];
  const rowsQuery = useTableRows(selectedTable, structureData);

  function reload() {
    rowsQuery.refetch();
    structureQuery.refetch();
  }

  return (
    <div
      class="grid h-full overflow-hidden"
      style={{
        "grid-template-rows": gridTemplateRows(),
      }}
    >
      <Switch>
        <Match when={rowsQuery.error}>{(error) => error().message}</Match>
        <Match when={rowsQuery.data}>
          {(rows) => (
            <DataTableProvider
              reload={reload}
              structure={structureData()}
              rows={rows()}
              name={selectedTable()}
            >
              <DataTable reload={reload} />
            </DataTableProvider>
          )}
        </Match>
      </Switch>

      <Show when={showQueryHistory.value()}>
        <QueryHistory />
      </Show>
    </div>
  );
}
