import {
  createContext,
  createSignal,
  type ParentProps,
  Show,
  useContext,
} from "solid-js";
import { useSelectedSchemaTables } from "./useSelectedSchemaTables";

interface TableContext {
  selectedTable: () => string;
  setSelectedTable: (v: string) => void;
}

const TableContext = createContext<TableContext | null>(null);

export function SelectedTableProvider(props: ParentProps) {
  const [tableName, setTableName] = createSignal<string>();
  const allTables = useSelectedSchemaTables();
  const selectedTable = () => tableName() || allTables.data?.at(0)?.tableName;

  return (
    <Show fallback={null} when={selectedTable()}>
      <TableContext.Provider
        value={{
          selectedTable: selectedTable as () => string,
          setSelectedTable: setTableName,
        }}
      >
        {props.children}
      </TableContext.Provider>
    </Show>
  );
}

export function useSelectedTableContext() {
  const ctx = useContext(TableContext);

  if (!ctx) {
    throw new Error("no context found");
  }

  return ctx;
}
