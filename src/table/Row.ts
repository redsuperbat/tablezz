import type { Cell } from "./Cell";

export class Row {
  #cells: Cell[];
  readonly index: number;

  constructor(cells: Cell[], index: number) {
    this.#cells = cells;
    this.index = index;
  }

  getPrimaryKey(): unknown | undefined {
    return this.#cells.find((c) => c.isPrimary)?.data;
  }

  getCell(columnIndex: number) {
    return this.getCells().at(columnIndex);
  }

  getCells() {
    return this.#cells;
  }
}
