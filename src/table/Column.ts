import type { ForeignKey, PostgresDataType } from "@/useTableStructure";
import type { DataType } from "./DataType";

export class Column {
  readonly index: number;
  readonly name: string;
  readonly isPrimary: boolean;
  readonly isNullable: boolean;
  readonly foreignKey: ForeignKey | null;
  readonly rawType: PostgresDataType;
  #dataType: DataType;

  constructor(opts: {
    name: string;
    dataType: DataType;
    rawType: PostgresDataType;
    index: number;
    isPrimary: boolean;
    isNullable: boolean;
    foreignKey: ForeignKey | null;
  }) {
    this.isPrimary = opts.isPrimary;
    this.name = opts.name;
    this.#dataType = opts.dataType;
    this.rawType = opts.rawType;
    this.index = opts.index;
    this.isNullable = opts.isNullable;
    this.foreignKey = opts.foreignKey;
  }

  getDataType() {
    return this.#dataType;
  }
}
