import type { ForeignKey } from "@/database/database";
import type { DataType } from "./DataType";

export class Column {
  readonly index: number;
  readonly name: string;
  readonly isPrimary: boolean;
  readonly isNullable: boolean;
  readonly columnDefault: string | null;
  readonly foreignKey: ForeignKey | null;
  #dataType: DataType;

  constructor(opts: {
    name: string;
    dataType: DataType;
    index: number;
    isPrimary: boolean;
    isNullable: boolean;
    columnDefault: string | null;
    foreignKey: ForeignKey | null;
  }) {
    this.isPrimary = opts.isPrimary;
    this.name = opts.name;
    this.#dataType = opts.dataType;
    this.index = opts.index;
    this.isNullable = opts.isNullable;
    this.columnDefault = opts.columnDefault;
    this.foreignKey = opts.foreignKey;
  }

  getDataType() {
    return this.#dataType;
  }
}
