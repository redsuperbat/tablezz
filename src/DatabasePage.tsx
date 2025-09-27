import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { QueryHistory } from "./database/QueryHistoryProvider";
import { useRegisterKeybindToggle } from "./keybinds/useRegisterToggleKeybind";
import { cn } from "./lib/utils";
import { TableContent } from "./TableContent";
import { useTableContext } from "./TableProvider";
import { useSelectedSchemaTables } from "./useSelectedSchemaTables";

function Table({ tableName }: { tableName: string }) {
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
          <Table tableName={table.tableName}></Table>
        </button>
      ))}
    </div>
  );
}

export function DatabasePage() {
  const allTables = useSelectedSchemaTables();
  const { tableName, setTableName } = useTableContext();
  const selectedTable = tableName || allTables.data?.at(0)?.tableName;

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
            <Schema tableName={selectedTable} onSelectTable={setTableName} />
          </div>
        </ResizablePanel>
      )}
      <ResizableHandle />
      <ResizablePanel defaultSize={80}>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={75}>
            {selectedTable && <TableContent tableName={selectedTable} />}
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
