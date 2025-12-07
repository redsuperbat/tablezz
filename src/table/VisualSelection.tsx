import type { Cell } from "./Cell";
import type { Table } from "./Table";

export class VisualSelection {
  #start?: Cell;
  #current: Cell;
  #table: Table;
  #onExit: () => void;
  #onEnter: () => void;

  constructor(opts: {
    start: Cell | undefined;
    current: Cell;
    table: Table;
    onExit: () => void;
    onEnter: () => void;
  }) {
    this.#start = opts.start;
    this.#current = opts.current;
    this.#table = opts.table;
    this.#onExit = opts.onExit;
    this.#onEnter = opts.onEnter;
  }

  exit() {
    if (this.isSelecting) {
      this.#onExit();
    }
  }

  enter() {
    this.#onEnter();
  }

  get isSelecting() {
    return !!this.start;
  }

  get current() {
    return this.#current;
  }

  get start() {
    return this.#start;
  }

  getAllIntersectingCells(): Cell[] {
    if (!this.start) {
      return [this.current];
    }

    return this.#table.getAllCells().filter((c) => this.isIntersectingWith(c));
  }

  updateIntersectingCells({
    stringifiedCells,
    columnDelimiter,
    rowDelimiter,
  }: {
    stringifiedCells: string;
    rowDelimiter: string;
    columnDelimiter: string;
  }) {
    if (!this.start) {
      this.current.updateData(stringifiedCells);
      return [this.current];
    }

    const startRow = Math.min(
      this.start.getRow().index,
      this.#current.getRow().index,
    );
    const startCol = Math.min(
      this.start.getColumn().index,
      this.#current.getColumn().index,
    );

    const rows = stringifiedCells.split(rowDelimiter).entries();

    for (const [rowOffset, row] of rows) {
      const columns = row.split(columnDelimiter).entries();

      for (const [colOffset, cellValue] of columns) {
        const cell = this.#table.getCellOrThrow({
          column: startCol + colOffset,
          row: startRow + rowOffset,
        });

        cell.updateData(cellValue);
      }
    }
  }

  intersectingCellsToString({
    rowDelimiter,
    columnDelimiter,
  }: {
    rowDelimiter: string;
    columnDelimiter: string;
  }): string {
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
          .join(columnDelimiter);
      })
      .join(rowDelimiter);
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
