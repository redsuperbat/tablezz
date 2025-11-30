import type { Column } from "./Column";
import type { Row } from "./Row";
import type { Table } from "./Table";

export class Cell {
  readonly getColumn: () => Column;
  readonly getRow: () => Row;
  readonly getTable: () => Table;
  readonly #data: unknown;

  constructor({
    getColumn,
    getRow,
    getTable,
    data,
  }: {
    getRow: () => Row;
    getColumn: () => Column;
    getTable: () => Table;
    data: unknown;
  }) {
    this.getColumn = getColumn;
    this.getRow = getRow;
    this.getTable = getTable;
    this.#data = data;
  }

  display() {
    return this.getColumn().getDataType().display(this.#data);
  }

  toString() {
    return this.getColumn().getDataType().toString(this.#data);
  }

  get data() {
    return this.#data;
  }

  isPrimary() {
    return this.getColumn().getDataType().isPrimary;
  }

  equals(cell?: Cell) {
    if (!cell) return false;

    return (
      cell.getRow().index === this.getRow().index &&
      cell.getColumn().index === this.getColumn().index
    );
  }
}
