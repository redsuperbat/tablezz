import type { Cell } from "./Cell";

export class Row {
  #cells: Cell[];
  #deleted = false;
  #forceRerender?: () => void;
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

  get isDeleted() {
    return this.#deleted;
  }

  toggleDeleted() {
    this.#deleted = !this.#deleted;
    this.#forceRerender?.();
  }

  setForceRerender(fn: () => void) {
    this.#forceRerender = fn;
  }
}
