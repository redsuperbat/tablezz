import {
  type Accessor,
  createContext,
  type ParentProps,
  useContext,
} from "solid-js";
import { useRegisterKeybindCommand } from "@/keybinds/useRegisterKeybindCommand";
import { createCounterWithWrap } from "@/lib/createCounterWithWrap";

interface TableEditorContext {
  column: Accessor<number>;
  row: Accessor<number>;
}

const TableEditorContext = createContext<TableEditorContext | null>(null);

export function TableEditorProvider(props: ParentProps<{ rows: unknown[] }>) {
  const columnLength = () => Object.keys(props.rows.at(0) ?? {}).length;
  const rowLength = () => props.rows.length ?? 0;

  const row = createCounterWithWrap(() => rowLength() - 1);
  const column = createCounterWithWrap(() => columnLength() - 1);

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

  return (
    <TableEditorContext.Provider
      value={{ row: row.value, column: column.value }}
    >
      {props.children}
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
