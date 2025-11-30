import type { DataType } from "./DataType";

export class Column {
  readonly index: number;
  #name: string;
  #dataType: DataType;

  constructor({
    name,
    index,
    dataType,
  }: { name: string; dataType: DataType; index: number }) {
    this.#name = name;
    this.#dataType = dataType;
    this.index = index;
  }

  getDataType() {
    return this.#dataType;
  }

  getName() {
    return this.#name;
  }
}
