import {
  type Accessor,
  createContext,
  createSignal,
  type ParentProps,
  useContext,
} from "solid-js";
import { useRegisterKeybindCommandOnMount } from "@/keybinds/useRegisterKeybindCommand";
import { createCounterWithBoundaries } from "@/lib/createCounterWithWrap";

interface TableEditorContext {
  column: Accessor<number>;
  row: Accessor<number>;
  visualModePoint: Accessor<Point | undefined>;
}

const TableEditorContext = createContext<TableEditorContext | null>(null);

type Point = {
  column: number;
  row: number;
};

export function TableEditorProvider(props: ParentProps<{ rows: unknown[] }>) {
  const columnLength = () => Object.keys(props.rows.at(0) ?? {}).length;
  const rowLength = () => props.rows.length ?? 0;
  const [visualModePoint, setVisualModePoint] = createSignal<Point>();

  const visibleRows = 10;

  const row = createCounterWithBoundaries({
    max: () => rowLength() - 1,
    min: 0,
  });

  const column = createCounterWithBoundaries({
    max: () => columnLength() - 1,
    min: 0,
  });

  useRegisterKeybindCommandOnMount({
    command: "VisualMode",
    keybindExpression: "v",
    action() {
      setVisualModePoint({
        column: column.value(),
        row: row.value(),
      });
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveToTop",
    keybindExpression: "G",
    action: row.setToMax,
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveDownHalf",
    keybindExpression: "Control + d",
    action() {
      row.increment(visibleRows);
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveUpHalf",
    keybindExpression: "Control + u",
    action() {
      row.decrement(visibleRows);
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveToBottom",
    keybindExpression: "g",
    action: row.reset,
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveCellRight",
    keybindExpression: "l",
    action() {
      column.increment();
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveCellLeft",
    keybindExpression: "h",
    action() {
      column.decrement();
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveCellUp",
    keybindExpression: "k",
    action() {
      row.decrement();
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveCellDown",
    keybindExpression: "j",
    action() {
      row.increment();
    },
  });

  return (
    <TableEditorContext.Provider
      value={{
        row: row.value,
        column: column.value,
        visualModePoint,
      }}
    >
      {props.children}
    </TableEditorContext.Provider>
  );
}

export function useTableEditorContext() {
  const ctx = useContext(TableEditorContext);

  if (!ctx) {
    throw new Error("No table editor context found");
  }

  return ctx;
}
