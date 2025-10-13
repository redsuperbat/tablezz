import { Match, Show, Switch } from "solid-js";
import { QueryHistory } from "./database/QueryHistoryProvider";
import { useRegisterKeybindToggle } from "./keybinds/useRegisterToggleKeybind";
import { useSelectedTableContext } from "./SelectedTableProvider";
import { Table } from "./table/Table";
import { TableEditorProvider } from "./table/TableEditorProvider";
import { useTableRows } from "./useTableRows";

export function TablePage() {
  const { selectedTable } = useSelectedTableContext();

  const showQueryHistory = useRegisterKeybindToggle({
    command: "ToggleQueryHistory",
    keybindExpression: "Leader + q",
    initialValue: false,
  });

  const gridTemplateRows = () =>
    [selectedTable(), showQueryHistory.value()]
      .filter(Boolean)
      .map(() => "1fr")
      .join(" ");

  const rows = useTableRows(selectedTable);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "grid",
        "grid-template-rows": gridTemplateRows(),
      }}
    >
      <Switch>
        <Match when={rows.error}>{(error) => error().message}</Match>
        <Match when={rows.data}>
          {(rows) => (
            <TableEditorProvider rows={rows()}>
              <Table rows={rows()} />
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
