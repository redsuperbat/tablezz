import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { useRegisterKeybindCommand } from "@/keybinds/useRegisterKeybindCommand";
import { useSelectedTableContext } from "@/SelectedTableProvider";
import { useTableRows } from "@/useTableRows";
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

  useRegisterKeybindCommand({
    command: "MoveCellRight",
    keybindExpression: "l",
    action() {
      if (column === columnLength - 1) {
        return setColumn(0);
      }
      setColumn((c) => c + 1);
    },
  });

  useRegisterKeybindCommand({
    command: "MoveCellLeft",
    keybindExpression: "h",
    action() {
      if (column === 0) {
        return setColumn(columnLength - 1);
      }
      setColumn((c) => c - 1);
    },
  });

  useRegisterKeybindCommand({
    command: "MoveCellUp",
    keybindExpression: "k",
    action() {
      if (row === 0) {
        return setRow(rowLength - 1);
      }
      setRow((r) => r - 1);
    },
  });

  useRegisterKeybindCommand({
    command: "MoveCellDown",
    keybindExpression: "j",
    action() {
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
