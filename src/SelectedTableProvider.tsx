import { makePersisted } from "@solid-primitives/storage";
import {
  batch,
  createContext,
  createSignal,
  type ParentProps,
  Show,
  useContext,
} from "solid-js";
import { createWatcher } from "./commands/createWatcher";
import { useHopContext } from "./HopContext";
import { useSchemaContext } from "./SchemaProvider";
import { useSelectedSchemaTables } from "./useSelectedSchemaTables";

interface TableContext {
  selectedTable: () => string;
  setSelectedTable: (v: string) => void;
}

const TableContext = createContext<TableContext | null>(null);

export function SelectedTableProvider(props: ParentProps) {
  const { setPosition } = useHopContext();
  const [tableName, setTableName] = makePersisted(createSignal<string>(), {
    name: "selectedTable",
  });
  const { schema } = useSchemaContext();
  const allTables = useSelectedSchemaTables();
  const selectedTable = () => tableName() ?? allTables.data?.at(0)?.tableName;

  createWatcher(schema, () => setTableName(undefined), {
    // Do not run on initial render
    defer: true,
  });

  function setSelectedTable(tableName: string) {
    batch(() => {
      setPosition(undefined);
      setTableName(tableName);
    });
  }

  return (
    <Show fallback={null} when={selectedTable()}>
      {(selectedTable) => (
        <TableContext.Provider value={{ selectedTable, setSelectedTable }}>
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
