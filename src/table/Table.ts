import type { Column } from "./Column";
import type { Row } from "./Row";

export class Table {
  #rows: Row[];
  #columns: Column[];
  readonly name: string;

  constructor({
    rows,
    columns,
    name,
  }: { rows: Row[]; columns: Column[]; name: string }) {
    this.#rows = rows;
    this.#columns = columns;
    this.name = name;
  }

  getColumnOrThrow(columnIndex: number) {
    const column = this.getColumns().at(columnIndex);

    if (!column) {
      throw new Error(`No column found as index: ${columnIndex}`);
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

  getRowOrThrow(index: number) {
    const row = this.getRow(index);
    if (!row) {
      throw new Error(`No row found at index: ${index}`);
    }
    return row;
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
