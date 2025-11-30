import type { Cell } from "./Cell";
import type { Table } from "./Table";

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

  updateIntersectingCells(value: string) {
    if (!this.start) {
      this.current.updateData(value);
      return [this.current];
    }

    const cells: Cell[] = [];

    const startRow = Math.min(
      this.start.getRow().index,
      this.#current.getRow().index,
    );
    const startCol = Math.min(
      this.start.getColumn().index,
      this.#current.getColumn().index,
    );

    for (const [rowOffset, row] of value.split("\n").entries()) {
      for (const [colOffset, cellValue] of row.split("\t").entries()) {
        const cell = this.#table.getCellOrThrow({
          column: startCol + colOffset,
          row: startRow + rowOffset,
        });

        cell.updateData(cellValue);
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
