import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type ParentProps,
  useContext,
} from "solid-js";
import z from "zod";
import {
  useRegisterKeybindCommand,
  useRegisterKeybindCommandOnMount,
} from "@/keybinds/useRegisterKeybindCommand";
import { createCounterWithBoundaries } from "@/lib/counter";
import type { PostgresDataType } from "@/useTableStructure";
import { CellData } from "./CellData";

interface TableEditorContext {
  currentCell: Accessor<Cell>;
  getTable: Accessor<Table>;
  visualBlock: Accessor<VisualBlock | undefined>;
}

const TableEditorContext = createContext<TableEditorContext | null>(null);

export class Cell {
  readonly column: number;
  readonly row: number;
  readonly #data: CellData;

  constructor({
    column,
    row,
    data,
  }: { row: number; column: number; data: CellData }) {
    this.column = column;
    this.row = row;
    this.#data = data;
  }

  getData() {
    return this.#data;
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

class Row {
  #cells: Cell[];

  constructor(cells: Cell[]) {
    this.#cells = cells;
  }

  getCell(columnIndex: number) {
    return this.getCells().at(columnIndex);
  }

  getCells() {
    return this.#cells;
  }
}

class Column {
  #name: string;
  constructor(name: string) {
    this.#name = name;
  }

  getName() {
    return this.#name;
  }
}

class Table {
  #rows: Row[];
  #columns: Column[];

  constructor(rows: Row[], columns: Column[]) {
    this.#rows = rows;
    this.#columns = columns;
  }

  getColumn(columnIndex: number) {
    return this.getColumns().at(columnIndex);
  }

  getColumns() {
    return this.#columns;
  }

  getRow(index: number) {
    return this.getRows().at(index);
  }

  getRows() {
    return this.#rows;
  }

  getCell(row: number, column: number) {
    return this.getRow(row)?.getCell(column);
  }

  getCellOrThrow(row: number, column: number) {
    const cell = this.getCell(row, column);

    if (!cell) {
      throw new Error(`No cell found at index ${row}:${column}`);
    }

    return cell;
  }

  getAllCells() {
    return this.#rows.flatMap((r) => r.getCells());
  }
}

export function TableEditorProvider(
  props: ParentProps<{
    rows: unknown[];
    structure: {
      columnName: string;
      dataType: PostgresDataType;
    }[];
  }>,
) {
  const columns = () => props.structure.map((c) => new Column(c.columnName));

  const rows = () => {
    return props.rows.map((row, rowIndex) => {
      const cells = Object.entries(row as object)
        .values()
        .map(([name, value], column) => {
          const dataType = props.structure.find((s) => s.columnName === name);

          if (!dataType) {
            return;
          }

          return new Cell({
            column,
            row: rowIndex,
            data: CellData.fromPostgresDataType(dataType.dataType, value),
          });
        })
        .filter((v) => v !== undefined)
        .toArray();

      return new Row(cells);
    });
  };

  const getTable = createMemo(() => new Table(rows(), columns()));

  const [visualModeStartCell, setVisualModeStartCell] = createSignal<Cell>();
  const registerKeybindCommand = useRegisterKeybindCommand();

  const visibleRows = 10;

  const row = createCounterWithBoundaries({
    max: () => getTable().getRows().length - 1,
    min: 0,
  });

  const column = createCounterWithBoundaries({
    max: () => getTable().getColumns().length - 1,
    min: 0,
  });

  const currentCell = () =>
    getTable().getRow(row.value())?.getCell(column.value()) as Cell;

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
      setVisualModeStartCell(currentCell());

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
    command: "EditCell",
    action() {},
    keybindExpression: "c",
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
        getTable,
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
