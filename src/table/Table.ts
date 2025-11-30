import type { Column } from "./Column";
import type { Row } from "./Row";

export class Table {
  #rows: Row[];
  #columns: Column[];

  constructor(rows: Row[], columns: Column[]) {
    this.#rows = rows;
    this.#columns = columns;
  }

  getColumnOrThrow(columnIndex: number) {
    const column = this.getColumns().at(columnIndex);
    if (!column) {
      throw new Error("No column found");
    }
    return column;
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
