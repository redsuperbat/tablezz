import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { QueryHistory } from "./database/QueryHistoryProvider";
import { useRegisterKeybindToggle } from "./keybinds/useRegisterToggleKeybind";
import { cn } from "./lib/utils";
import { useTableContext } from "./TableProvider";
import { useSelectedSchemaTables } from "./useSelectedSchemaTables";
import { useTableContent } from "./useTableContent";
import { useTableStructure } from "./useTableStructure";

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

function TableContent({ tableName }: { tableName: string }) {
  const content = useTableContent(tableName);
  const structure = useTableStructure(tableName);

  return (
    <div className="overflow-scroll h-full font-normal text-start">
      <table className="border-spacing-x-4 table-auto border-collapse border border-gray-300 w-full text-sm">
        <thead>
          <tr>
            {structure.data?.map((s) => (
              <th
                className="border border-gray-300 px-4 py-2"
                key={s.column_name}
              >
                {s.column_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.data?.map((row) => (
            <tr key={JSON.stringify(row)}>
              {structure.data?.map((s) => (
                <td
                  className={cn("border border-gray-300 px-4 py-2 text-sm")}
                  key={JSON.stringify(s) + JSON.stringify(row)}
                >
                  <div className="truncate max-w-40 ">
                    {row[s.column_name as keyof typeof row]}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DatabasePage() {
  const { tableName, setTableName } = useTableContext();

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
            <Schema tableName={tableName} onSelectTable={setTableName} />
          </div>
        </ResizablePanel>
      )}
      <ResizableHandle />
      <ResizablePanel defaultSize={80}>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={75}>
            {tableName && <TableContent tableName={tableName} />}
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
