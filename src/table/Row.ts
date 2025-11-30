import type { Cell } from "./Cell";

export class Row {
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
