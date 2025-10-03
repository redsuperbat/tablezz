import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { useRegisterKeybindCommand } from "@/keybinds/useRegisterKeybindCommand";
import { wrapWithZero } from "@/lib/utils";
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
      setColumn((c) => wrapWithZero(c + 1, columnLength - 1));
    },
  });

  useRegisterKeybindCommand({
    command: "MoveCellLeft",
    keybindExpression: "h",
    action() {
      setColumn((c) => wrapWithZero(c - 1, columnLength - 1));
    },
  });

  useRegisterKeybindCommand({
    command: "MoveCellUp",
    keybindExpression: "k",
    action() {
      setRow((r) => wrapWithZero(r - 1, rowLength - 1));
    },
  });

  useRegisterKeybindCommand({
    command: "MoveCellDown",
    keybindExpression: "j",
    action() {
      setRow((r) => wrapWithZero(r + 1, rowLength - 1));
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
