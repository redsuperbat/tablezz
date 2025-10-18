import {
  createContext,
  createSignal,
  type ParentProps,
  Show,
  useContext,
} from "solid-js";
import { createWatcher } from "./commands/createWatcher";
import { useSchemaContext } from "./SchemaProvider";
import { useSelectedSchemaTables } from "./useSelectedSchemaTables";

interface TableContext {
  selectedTable: () => string;
  setSelectedTable: (v: string) => void;
}

const TableContext = createContext<TableContext | null>(null);

export function SelectedTableProvider(props: ParentProps) {
  const [tableName, setTableName] = createSignal<string>();
  const { schema } = useSchemaContext();
  const allTables = useSelectedSchemaTables();
  const selectedTable = () => tableName() || allTables.data?.at(0)?.tableName;

  // If the schema changes, we want to reset the selected table too
  createWatcher(schema, () => setTableName(undefined));

  return (
    <Show fallback={null} when={selectedTable()}>
      {(selectedTable) => (
        <TableContext.Provider
          value={{ selectedTable, setSelectedTable: setTableName }}
        >
          {props.children}
        </TableContext.Provider>
      )}
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
