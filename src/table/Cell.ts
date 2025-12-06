import type { Column } from "./Column";
import type { Row } from "./Row";
import type { Table } from "./Table";

export class Cell {
  readonly getColumn: () => Column;
  readonly getRow: () => Row;
  readonly getTable: () => Table;

  #data: unknown[];
  #forceRerender?: () => void;
  #isDirty = false;

  constructor(opts: {
    getRow: () => Row;
    getColumn: () => Column;
    getTable: () => Table;
    data: unknown;
  }) {
    this.getColumn = opts.getColumn;
    this.getRow = opts.getRow;
    this.getTable = opts.getTable;
    this.#data = [opts.data];
  }

  get #dataType() {
    return this.getColumn().getDataType(this.data);
  }

  getDataTypeWithValue(value: unknown) {
    return this.getColumn().getDataType(value);
  }

  setRenderer(renderer: () => void) {
    this.#forceRerender = renderer;
  }

  updateData(value: string) {
    if (this.toString() === value) {
      return;
    }

    this.#data.push(this.#dataType.fromString(value));
    this.#isDirty = true;
    this.#forceRerender?.();
  }

  undo() {
    if (this.#data.length === 1) {
      return;
    }

    this.#data.pop();
    this.#isDirty = this.#data.length !== 1;
    this.#forceRerender?.();
  }

  reset() {
    this.#data = [this.#data.at(0)];
    this.#isDirty = false;
    this.#forceRerender?.();
  }

  get isDirty() {
    return this.#isDirty;
  }

  display() {
    return this.#dataType.display();
  }

  toString() {
    return this.#dataType.toString();
  }

  toSqlValue() {
    return this.#dataType.toSqlValue();
  }

  /**
   * Returns the original unmodified value of the cell
   **/
  get originalData() {
    return this.#data.at(0);
  }

  /**
   * Returns the current (potentially modified value)
   * of the cell
   **/
  get data() {
    return this.#data.at(-1);
  }

  isPrimary() {
    return this.getColumn().isPrimary;
  }

  equals(cell?: Cell) {
    if (!cell) return false;

    return (
      cell.getRow().index === this.getRow().index &&
      cell.getColumn().index === this.getColumn().index
    );
  }
}
