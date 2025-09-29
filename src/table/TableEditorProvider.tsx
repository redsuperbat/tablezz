import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { useRegisterKeybind } from "@/keybinds/useRegisterKeybind";
import { useSelectedTableContext } from "@/SelectedTableProvider";
import { useTableRows } from "@/useTableItems";
import { useTableStructure } from "@/useTableStructure";

interface TableEditorContext {
  column: number;
  row: number;
}

const TableEditorContext = createContext<TableEditorContext | null>(null);

export function TableEditorProvider({ children }: { children: ReactNode }) {
  const { selectedTable } = useSelectedTableContext();
  const columnLength = useTableStructure(selectedTable).data?.length ?? 0;
  const rowLength = useTableRows(selectedTable).data?.length ?? 0;
  const [row, setRow] = useState<number>(0);
  const [column, setColumn] = useState<number>(0);

  useRegisterKeybind({
    name: "MoveCellRight",
    keybindExpression: "l",
    onTrigger() {
      if (column === columnLength - 1) {
        return setColumn(0);
      }
      setColumn((c) => c + 1);
    },
  });

  useRegisterKeybind({
    name: "MoveCellLeft",
    keybindExpression: "h",
    onTrigger() {
      if (column === 0) {
        return setColumn(columnLength - 1);
      }
      setColumn((c) => c - 1);
    },
  });

  useRegisterKeybind({
    name: "MoveCellUp",
    keybindExpression: "k",
    onTrigger() {
      if (row === 0) {
        return setRow(rowLength - 1);
      }
      setRow((r) => r - 1);
    },
  });

  useRegisterKeybind({
    name: "MoveCellDown",
    keybindExpression: "j",
    onTrigger() {
      if (row === rowLength - 1) {
        return setRow(0);
      }
      setRow((c) => c + 1);
    },
  });

  const context = useMemo(() => ({ row, column }), [row, column]);

  return (
    <TableEditorContext.Provider value={context}>
      {children}
    </TableEditorContext.Provider>
  );
}

export function useTableEditorContext() {
  const ctx = useContext(TableEditorContext);
  if (!ctx) {
    throw new Error("no context found");
  }
  return ctx;
}
