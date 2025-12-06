import type { JSXElement } from "solid-js";
import type { PostgresDataType } from "@/useTableStructure";

export abstract class DataType {
  abstract toString(): string;
  abstract display(): JSXElement;
  abstract fromString(value: string): unknown;
  abstract toSqlValue(): string;

  fileExtension(): string {
    return ".txt";
  }
}

class JsonDataType extends DataType {
  #data: unknown;

  constructor(data: unknown) {
    super();
    this.#data = data;
  }

  display() {
    return (
      <code>
        <pre>{JSON.stringify(this.#data, null, 2)}</pre>
      </code>
    );
  }

  toString(): string {
    return JSON.stringify(this.#data);
  }

  fromString(value: string): unknown {
    return JSON.parse(value);
  }

  toSqlValue(): string {
    return `'${JSON.stringify(this.#data)}'`;
  }

  override fileExtension(): string {
    return ".json";
  }
}

class ArrayDataType extends DataType {
  #data: DataType[];

  constructor(data: DataType[]) {
    super();
    this.#data = data;
  }

  display() {
    return (
      <code>
        <pre>{this.toString()}</pre>
      </code>
    );
  }

  toString(): string {
    return `{${this.#data.map((d) => d.toString()).join(",")}}`;
  }

  toSqlValue(): string {
    return `{${this.#data.map((d) => d.toSqlValue()).join(",")}}`;
  }

  fromString(data: string): unknown[] {
    if (data.startsWith("{") && data.endsWith("}")) {
      const inner = data.slice(1, -1);
      if (inner === "") return [];
      return inner
        .split(",")
        .map((value, index) => this.#data[index]?.fromString(value));
    }

    throw new Error("Malformed array data");
  }
}

class NullDataType extends DataType {
  toSqlValue(): string {
    return "null";
  }

  display(): string {
    return "null";
  }

  toString(): string {
    return "null";
  }

  fromString(): unknown {
    return null;
  }
}

class NumberDataType extends DataType {
  #data: number;

  constructor(data: unknown) {
    super();
    if (typeof data !== "number") {
      throw new Error(`Invalid data type for text data ${typeof data}`);
    }
    this.#data = data;
  }

  display(): string {
    return this.toString();
  }

  toString(): string {
    return this.#data.toString();
  }

  fromString(data: string): unknown {
    return Number(data);
  }

  toSqlValue(): string {
    return this.toString();
  }
}

class TextDataType extends DataType {
  #data: string;

  constructor(data: unknown) {
    super();
    if (typeof data !== "string") {
      throw new Error(`Invalid data type for text data ${typeof data}`);
    }
    this.#data = data;
  }

  display(): string {
    return this.#data;
  }

  toString(): string {
    return this.#data;
  }

  fromString(data: string): unknown {
    return data;
  }

  toSqlValue(): string {
    return `'${this.#data}'`;
  }
}

class DefaultDataType extends DataType {
  #data: unknown;

  constructor(data: unknown) {
    super();
    this.#data = data;
  }

  display(): string {
    return this.toString();
  }

  toString(): string {
    return String(this.#data);
  }

  fromString(data: string): unknown {
    return data;
  }

  toSqlValue(): string {
    return this.toString();
  }
}

export class DataTypeFactory {
  #type: PostgresDataType;

  constructor(dataType: PostgresDataType) {
    this.#type = dataType;
  }

  make(data: unknown): DataType {
    if (data === null) {
      return new NullDataType();
    }

    // Array data type
    if (this.#type.endsWith("[]") && Array.isArray(data)) {
      const elementsDataTypeFactory = new DataTypeFactory(
        this.#type.slice(0, -2),
      );
      const dataTypes = data.map((d) => elementsDataTypeFactory.make(d));
      return new ArrayDataType(dataTypes);
    }

    switch (this.#type) {
      case "json":
      case "jsonb":
        return new JsonDataType(data);
      // Treat dates as text for now
      case "date":
      case "time":
      case "time without time zone":
      case "time with time zone":
      case "timestamp":
      case "timestamp without time zone":
      case "timestamp with time zone":
      case "uuid":
      case "text":
        return new TextDataType(data);

      case "integer":
      case "numeric":
      case "bigint":
      case "smallint":
        return new NumberDataType(data);

      default:
        return new DefaultDataType(data);
    }
  }
}
