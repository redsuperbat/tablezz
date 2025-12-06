import type { DataTypeFactory } from "./DataType";

export class Column {
  readonly index: number;
  readonly name: string;
  readonly isPrimary: boolean;
  #dataTypeFactory: DataTypeFactory;

  constructor({
    name,
    index,
    dataTypeFactory,
    isPrimary,
  }: {
    name: string;
    dataTypeFactory: DataTypeFactory;
    index: number;
    isPrimary: boolean;
  }) {
    this.isPrimary = isPrimary;
    this.name = name;
    this.#dataTypeFactory = dataTypeFactory;
    this.index = index;
  }

  getDataType(data: unknown) {
    return this.#dataTypeFactory.make(data);
  }
}
