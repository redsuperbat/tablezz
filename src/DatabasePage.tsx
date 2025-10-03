import { useCallback } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
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

  const handleClose = useCallback(
    () => showSqlEditor.set(false),
    [showSqlEditor.set],
  );

  return (
    <ResizablePanelGroup
      style={{ width: "100vw", height: "100vh" }}
      direction="vertical"
    >
      {showSqlEditor.value && (
        <>
          <ResizablePanel defaultSize={50}>
            <SqlEditor onClose={handleClose} />
          </ResizablePanel>
          <ResizableHandle />
        </>
      )}

      <ResizablePanel defaultSize={50}>
        {selectedTable && <Table tableName={selectedTable} />}
      </ResizablePanel>

      {showQueryHistory.value && (
        <>
          <ResizableHandle />
          <ResizablePanel defaultSize={50}>
            <QueryHistory />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
