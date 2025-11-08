import {
  type Accessor,
  createContext,
  createSignal,
  type ParentProps,
  useContext,
} from "solid-js";
import z from "zod";
import {
  useRegisterKeybindCommand,
  useRegisterKeybindCommandOnMount,
} from "@/keybinds/useRegisterKeybindCommand";
import { createCounterWithBoundaries } from "@/lib/createCounterWithWrap";

interface TableEditorContext {
  currentCell: Accessor<Cell>;
  visualBlock: Accessor<VisualBlock | undefined>;
}

const TableEditorContext = createContext<TableEditorContext | null>(null);

export class Cell {
  readonly column: number;
  readonly row: number;

  constructor({ column, row }: { row: number; column: number }) {
    this.column = column;
    this.row = row;
  }

  equals(cell?: Cell) {
    if (!cell) return false;
    return cell.row === this.row && cell.column === this.column;
  }
}

export class VisualBlock {
  #start: Cell;
  #current: Cell;

  constructor(start: Cell, current: Cell) {
    this.#start = start;
    this.#current = current;
  }

  get start() {
    return this.#start;
  }

  isIntersectingWith(cell: Cell): boolean {
    const minRow = Math.min(this.#start.row, this.#current.row);
    const maxRow = Math.max(this.#start.row, this.#current.row);
    const minColumn = Math.min(this.#start.column, this.#current.column);
    const maxColumn = Math.max(this.#start.column, this.#current.column);

    return (
      cell.row >= minRow &&
      cell.row <= maxRow &&
      cell.column >= minColumn &&
      cell.column <= maxColumn
    );
  }
}

export function TableEditorProvider(props: ParentProps<{ rows: unknown[] }>) {
  const columnLength = () => Object.keys(props.rows.at(0) ?? {}).length;
  const rowLength = () => props.rows.length ?? 0;
  const [visualModeStartCell, setVisualModeStartCell] = createSignal<Cell>();
  const registerKeybindCommand = useRegisterKeybindCommand();

  const visibleRows = 10;

  const row = createCounterWithBoundaries({
    max: () => rowLength() - 1,
    min: 0,
  });

  const column = createCounterWithBoundaries({
    max: () => columnLength() - 1,
    min: 0,
  });

  const currentCell = () =>
    new Cell({ column: column.value(), row: row.value() });

  const visualBlock = () => {
    const start = visualModeStartCell();
    if (!start) {
      return;
    }

    return new VisualBlock(start, currentCell());
  };

  useRegisterKeybindCommandOnMount({
    command: "VisualModeEnter",
    keybindExpression: "v",
    action() {
      setVisualModeStartCell(
        new Cell({ column: column.value(), row: row.value() }),
      );

      const disposable = registerKeybindCommand({
        keybindExpression: "Escape | v",
        command: "VisualModeExit",
        action() {
          disposable.dispose();
          setVisualModeStartCell(undefined);
        },
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
    actionArgs: [z.coerce.number().optional().meta({ title: "<distance>" })],
    action(distance) {
      column.increment(distance);
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveCellLeft",
    keybindExpression: "h",
    actionArgs: [z.coerce.number().optional().meta({ title: "<distance>" })],
    action(distance) {
      column.decrement(distance);
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveCellUp",
    keybindExpression: "k",
    actionArgs: [z.coerce.number().optional().meta({ title: "<distance>" })],
    action(distance) {
      row.decrement(distance);
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveCellDown",
    keybindExpression: "j",
    actionArgs: [z.coerce.number().optional().meta({ title: "<distance>" })],
    action(distance) {
      row.increment(distance);
    },
  });

  return (
    <TableEditorContext.Provider
      value={{
        currentCell,
        visualBlock,
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
