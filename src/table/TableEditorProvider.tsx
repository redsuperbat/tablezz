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
  readonly getColumn: () => Column;
  readonly getRow: () => Row;
  readonly getTable: () => Table;
  readonly #data: CellData;

  constructor({
    getColumn,
    getRow,
    getTable,
    data,
  }: {
    getRow: () => Row;
    getColumn: () => Column;
    getTable: () => Table;
    data: CellData;
  }) {
    this.getColumn = getColumn;
    this.getRow = getRow;
    this.getTable = getTable;
    this.#data = data;
  }

  getData() {
    return this.#data;
  }

  equals(cell?: Cell) {
    if (!cell) return false;

    return (
      cell.getRow().index === this.getRow().index &&
      cell.getColumn().index === this.getColumn().index
    );
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
    const startRowIndex = this.#start.getRow().index;
    const currentRowIndex = this.#current.getRow().index;
    const startColumnIndex = this.#start.getColumn().index;
    const currentColumnIndex = this.#current.getColumn().index;

    const minRow = Math.min(startRowIndex, currentRowIndex);
    const maxRow = Math.max(startRowIndex, currentRowIndex);
    const minColumn = Math.min(startColumnIndex, currentColumnIndex);
    const maxColumn = Math.max(startColumnIndex, currentColumnIndex);

    return (
      cell.getRow().index >= minRow &&
      cell.getRow().index <= maxRow &&
      cell.getColumn().index >= minColumn &&
      cell.getColumn().index <= maxColumn
    );
  }
}

class Row {
  #cells: Cell[];
  readonly index: number;

  constructor(cells: Cell[], index: number) {
    this.#cells = cells;
    this.index = index;
  }

  getCell(columnIndex: number) {
    return this.getCells().at(columnIndex);
  }

  getCells() {
    return this.#cells;
  }
}

class Column {
  readonly index: number;
  #name: string;
  #dataType: PostgresDataType;

  constructor({
    name,
    index,
    dataType,
  }: { name: string; dataType: PostgresDataType; index: number }) {
    this.#name = name;
    this.#dataType = dataType;
    this.index = index;
  }

  getDataType() {
    return this.#dataType;
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

  getCell({ row, column }: { row: number; column: number }) {
    return this.getRow(row)?.getCell(column);
  }

  getCellOrThrow({ row, column }: { row: number; column: number }) {
    const cell = this.getCell({ row, column });

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
  const columns = createMemo(() =>
    props.structure.map(
      (c, index) =>
        new Column({ name: c.columnName, dataType: c.dataType, index }),
    ),
  );

  const rows = createMemo((): Row[] => {
    return props.rows.map((row, rowIndex) => {
      const cells = Object.entries(row as object)
        .values()
        .map(([name, value], columnIndex) => {
          const dataType = props.structure.find((s) => s.columnName === name);

          if (!dataType) {
            return;
          }

          return new Cell({
            getColumn: () => columns().at(columnIndex) as Column,
            getRow: () => rows().at(rowIndex) as Row,
            data: CellData.fromPostgresDataType(dataType.dataType, value),
            getTable: () => getTable(),
          });
        })
        .filter((v) => v !== undefined)
        .toArray();

      return new Row(cells, rowIndex);
    });
  });

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
    actionArgs: [
      z.coerce
        .number()
        .default(() => currentCell().getColumn().index)
        .meta({ title: "<column>" }),
      z.coerce
        .number()
        .default(() => currentCell().getRow().index)
        .meta({ title: "<row>" }),
      z.string(),
    ],
    action(column, row, value) {
      const cell = getTable().getCellOrThrow({ column, row });
      cell.getData().tryUpdate?.(value);
    },
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
