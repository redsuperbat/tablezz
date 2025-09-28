import { createContext, type ReactNode, useContext, useState } from "react";
import { useSelectedSchemaTables } from "./useSelectedSchemaTables";

interface TableContext {
  selectedTable: string;
  setSelectedTable: (v: string) => void;
}

const TableContext = createContext<TableContext | null>(null);

export function TableProvider({ children }: { children: ReactNode }) {
  const [tableName, setTableName] = useState<string>();
  const allTables = useSelectedSchemaTables();
  const selectedTable = tableName || allTables.data?.at(0)?.tableName;

  if (!selectedTable) return null;

  return (
    <TableContext.Provider
      value={{ selectedTable, setSelectedTable: setTableName }}
    >
      {children}
    </TableContext.Provider>
  );
}

export function useTableContext() {
  const ctx = useContext(TableContext);
  if (!ctx) {
    throw new Error("no context found");
  }
  return ctx;
}
