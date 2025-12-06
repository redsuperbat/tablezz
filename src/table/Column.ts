import type { DataType } from "./DataType";

export class Column {
  readonly index: number;
  readonly name: string;
  readonly isPrimary: boolean;
  readonly isNullable: boolean;
  #dataType: DataType;

  constructor(opts: {
    name: string;
    dataType: DataType;
    index: number;
    isPrimary: boolean;
    isNullable: boolean;
  }) {
    this.isPrimary = opts.isPrimary;
    this.name = opts.name;
    this.#dataType = opts.dataType;
    this.index = opts.index;
    this.isNullable = opts.isNullable;
  }

  getDataType() {
    return this.#dataType;
  }
}
