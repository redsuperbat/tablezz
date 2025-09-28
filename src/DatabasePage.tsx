import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { QueryHistory } from "./database/QueryHistoryProvider";
import { useRegisterKeybindToggle } from "./keybinds/useRegisterToggleKeybind";
import { cn } from "./lib/utils";
import { useSelectedTableContext } from "./SelectedTableProvider";
import { Table } from "./table/Table";
import { useSelectedSchemaTables } from "./useSelectedSchemaTables";

function SchemaTable({ tableName }: { tableName: string }) {
  return <div>{tableName}</div>;
}

function Schema({
  onSelectTable,
  tableName,
}: {
  onSelectTable: (tableName: string) => void;
  tableName?: string;
}) {
  const databaseSchema = useSelectedSchemaTables();

  return (
    <div className="flex flex-col gap-2 items-start">
      {databaseSchema.data?.map((table) => (
        <button
          key={table.tableName}
          className={cn(
            "hover:underline cursor-pointer",
            table.tableName === tableName && "font-bold",
          )}
          onClick={() => onSelectTable(table.tableName)}
        >
          <SchemaTable tableName={table.tableName}></SchemaTable>
        </button>
      ))}
    </div>
  );
}

export function DatabasePage() {
  const { selectedTable, setSelectedTable } = useSelectedTableContext();

  const showQueryHistory = useRegisterKeybindToggle({
    name: "QueryHistoryToggle",
    keybindExpression: "Leader + q",
    initialValue: false,
  });

  const showSchemaSidebar = useRegisterKeybindToggle({
    name: "SchemaSidebarToggle",
    keybindExpression: "Leader + e",
    initialValue: false,
  });

  return (
    <ResizablePanelGroup
      direction="horizontal"
      style={{
        width: "100vw",
        height: "100vh",
      }}
    >
      {showSchemaSidebar && (
        <ResizablePanel defaultSize={20}>
          <div className="grid items-center">
            <Schema
              tableName={selectedTable}
              onSelectTable={setSelectedTable}
            />
          </div>
        </ResizablePanel>
      )}
      <ResizableHandle />
      <ResizablePanel defaultSize={80}>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={75}>
            {selectedTable && <Table tableName={selectedTable} />}
          </ResizablePanel>
          <ResizableHandle />
          {showQueryHistory && (
            <ResizablePanel defaultSize={25}>
              <QueryHistory />
            </ResizablePanel>
          )}
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
