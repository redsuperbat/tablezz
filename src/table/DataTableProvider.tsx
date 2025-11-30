import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type ParentProps,
  useContext,
} from "solid-js";
import z from "zod";
import { useRegisterCommand } from "@/commands/useRegisterCommand";
import {
  useRegisterKeybindCommand,
  useRegisterKeybindCommandOnMount,
} from "@/keybinds/useRegisterKeybindCommand";
import { createCounterWithBoundaries } from "@/lib/counter";
import type { PostgresDataType } from "@/useTableStructure";
import { Cell } from "./Cell";
import { Column } from "./Column";
import { DataType } from "./DataType";
import { Row } from "./Row";
import { Table } from "./Table";

interface TableEditorContext {
  currentCell: Accessor<Cell>;
  getTable: Accessor<Table>;
  visualSelection: Accessor<VisualSelection>;
}

const TableEditorContext = createContext<TableEditorContext | null>(null);

export class VisualSelection {
  #start?: Cell;
  #current: Cell;
  #table: Table;

  constructor({
    start,
    current,
    table,
  }: { start?: Cell; current: Cell; table: Table }) {
    this.#start = start;
    this.#current = current;
    this.#table = table;
  }

  get current() {
    return this.#current;
  }

  get start() {
    return this.#start;
  }

  getAllIntersectingCells(): Cell[] {
    if (!this.start) {
      return [this.#current];
    }

    return this.#table.getAllCells().filter((c) => this.isIntersectingWith(c));
  }

  updateIntersectingCells(value: string) {
    const cells: Cell[] = [];
    for (const [rowIndex, row] of value.split("\n").entries()) {
      for (const [columnIndex, value] of row.split("\t").entries()) {
        const cell = this.#table.getCellOrThrow({
          column: columnIndex,
          row: rowIndex,
        });

        cell.updateData(value);
        cells.push(cell);
      }
    }
    return cells;
  }

  intersectingCellsToString(): string {
    const intersectingCells = this.getAllIntersectingCells();

    const cellsByRow = Map.groupBy(intersectingCells, (c) => c.getRow().index);

    const sortedRows = Array.from(cellsByRow.entries()).sort(
      ([rowA], [rowB]) => rowA - rowB,
    );

    return sortedRows
      .map(([_, rowCells]) => {
        return rowCells
          .sort((a, b) => a.getRow().index - b.getRow().index)
          .map((c) => c.toString())
          .join("\t");
      })
      .join("\n");
  }

  isIntersectingWith(cell: Cell): boolean {
    if (!this.start) {
      return false;
    }

    const startRowIndex = this.start.getRow().index;
    const startColumnIndex = this.start.getColumn().index;

    const currentRowIndex = this.#current.getRow().index;
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

export function DataTableProvider(
  props: ParentProps<{
    rows: unknown[];
    name: string;
    structure: {
      columnName: string;
      dataType: PostgresDataType;
      isPrimary: boolean;
    }[];

    onEditSelection?(selection: VisualSelection): void;

    onPreparedStatementCreated?(data: {
      columnName: string;
      tableName: string;
      primaryKeyValue: unknown;
      primaryKeyColumnName: unknown;
      value: unknown;
    }): void;
  }>,
) {
  const registerCommand = useRegisterCommand();

  const columns = createMemo(() =>
    props.structure.map(
      (c, index) =>
        new Column({
          name: c.columnName,
          dataType: DataType.fromPostgresDataType({
            type: c.dataType,
            isPrimary: c.isPrimary,
          }),
          index,
        }),
    ),
  );

  const rows = createMemo((): Row[] => {
    return props.rows.map((row, rowIndex) => {
      const cells = Object.entries(row as object)
        .values()
        .map(([name, data], columnIndex) => {
          const dataType = props.structure.find((s) => s.columnName === name);

          if (!dataType) {
            return;
          }

          return new Cell({
            // We lazily self reference here for convenience
            // these functions never recurse indefinitely since there is
            // a cache layer handling base cases
            getTable: () => getTable(),
            getColumn: () => columns().at(columnIndex) as Column,
            getRow: () => rows().at(rowIndex) as Row,
            data,
          });
        })
        .filter((v) => v !== undefined)
        .toArray();

      return new Row(cells, rowIndex);
    });
  });

  const getTable = createMemo(
    () => new Table({ rows: rows(), columns: columns(), name: props.name }),
  );

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

  const visualSelection = createMemo(() => {
    return new VisualSelection({
      start: visualModeStartCell(),
      current: getTable().getRow(row.value())?.getCell(column.value()) as Cell,
      table: getTable(),
    });
  });

  const currentCell = () => visualSelection().current;

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
    command: "SelectionUndo",
    keybindExpression: "s > u",
    action() {
      visualSelection()
        .getAllIntersectingCells()
        .forEach((c) => c.undo());
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "SelectionReset",
    keybindExpression: "s > r",
    action() {
      visualSelection()
        .getAllIntersectingCells()
        .forEach((c) => c.reset());
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "OpenCellEditor",
    keybindExpression: "c",
    action() {
      props.onEditSelection?.(visualSelection());
    },
  });

  registerCommand({
    command: "EditCell",
    actionArgs: [
      z.coerce.number().meta({ title: "<column>" }),
      z.coerce.number().meta({ title: "<row>" }),
      z.string().meta({ title: "<value>" }),
    ],
    action(column, row, value) {
      const primaryKeyCell = getTable()
        .getRowOrThrow(row)
        .getCells()
        .find((c) => c.isPrimary());

      if (!primaryKeyCell) {
        throw new Error("Cannot update row without primary key");
      }

      const primaryKeyValue = primaryKeyCell.data;
      const primaryKeyColumnName = primaryKeyCell.getColumn().getName();
      const columnName = getTable().getColumnOrThrow(column).getName();

      props.onPreparedStatementCreated?.({
        tableName: props.name,
        columnName,
        primaryKeyValue,
        primaryKeyColumnName,
        value,
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
        visualSelection,
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
