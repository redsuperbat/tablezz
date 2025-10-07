import { createContext, type ParentProps, useContext } from "solid-js";
import { useRegisterKeybindCommand } from "@/keybinds/useRegisterKeybindCommand";
import { useWrapWithZero } from "@/lib/useWrapWithZero";
import { useSelectedTableContext } from "@/SelectedTableProvider";
import { useTableRows } from "@/useTableRows";
import { useTableStructure } from "@/useTableStructure";

interface TableEditorContext {
  column: number;
  row: number;
}

const TableEditorContext = createContext<TableEditorContext | null>(null);

export function TableEditorProvider({ children }: ParentProps) {
  const { selectedTable } = useSelectedTableContext();
  const columnLength = useTableStructure(selectedTable).data?.length ?? 0;
  const rowLength = useTableRows(selectedTable).data?.length ?? 0;
  const row = useWrapWithZero(rowLength - 1);
  const column = useWrapWithZero(columnLength - 1);

  useRegisterKeybindCommand({
    command: "MoveCellRight",
    keybindExpression: "l",
    action() {
      column.increment();
    },
  });

  useRegisterKeybindCommand({
    command: "MoveCellLeft",
    keybindExpression: "h",
    action() {
      column.decrement();
    },
  });

  useRegisterKeybindCommand({
    command: "MoveCellUp",
    keybindExpression: "k",
    action() {
      row.decrement();
    },
  });

  useRegisterKeybindCommand({
    command: "MoveCellDown",
    keybindExpression: "j",
    action() {
      row.increment();
    },
  });

  const context = () => ({ row: row.value(), column: column.value() });

  return (
    <TableEditorContext.Provider value={context()}>
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
