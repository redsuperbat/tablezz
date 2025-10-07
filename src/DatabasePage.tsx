import { createEffect, Show } from "solid-js";
import {
  Resizable,
  ResizableHandle,
  ResizablePanel,
} from "@/components/ui/resizable";
import { QueryHistory } from "./database/QueryHistoryProvider";
import { useRegisterKeybindToggle } from "./keybinds/useRegisterToggleKeybind";
import { useSelectedTableContext } from "./SelectedTableProvider";
import { SqlEditor } from "./sql-editor/SqlEditor";
import { Table } from "./table/Table";

export function DatabasePage() {
  const { selectedTable } = useSelectedTableContext();

  const showSqlEditor = useRegisterKeybindToggle({
    command: "ToggleSqlEditor",
    keybindExpression: "Leader + s",
    initialValue: false,
  });

  const showQueryHistory = useRegisterKeybindToggle({
    command: "ToggleQueryHistory",
    keybindExpression: "Leader + q",
    initialValue: false,
  });

  createEffect(() => {
    console.log(selectedTable());
  });

  return (
    <Resizable style={{ width: "100vw", height: "100vh" }}>
      <Show when={showSqlEditor.value()}>
        <ResizablePanel>
          <SqlEditor onClose={() => showSqlEditor.set(false)} />
        </ResizablePanel>
        <ResizableHandle />
      </Show>

      <ResizablePanel>
        <Show when={selectedTable()}>
          <Table tableName={selectedTable()} />
        </Show>
      </ResizablePanel>

      <Show when={showQueryHistory.value()}>
        <ResizablePanel>
          <QueryHistory />
        </ResizablePanel>
        <ResizableHandle />
      </Show>
    </Resizable>
  );
}
