import type { JSXElement } from "solid-js";
import type { PostgresDataType } from "@/useTableStructure";

export abstract class DataType {
  abstract toString(data: unknown): string;
  abstract display(data: unknown): JSXElement;
  abstract fromString(value: string): unknown;
  abstract toSqlValue(data: unknown): string;

  fileExtension(): string {
    return ".txt";
  }
}

class JsonDataType extends DataType {
  display(data: unknown) {
    return (
      <code>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </code>
    );
  }

  toString(data: unknown): string {
    return JSON.stringify(data);
  }

  fromString(value: string): unknown {
    return JSON.parse(value);
  }

  toSqlValue(data: unknown): string {
    return `'${JSON.stringify(data)}'`;
  }

  override fileExtension(): string {
    return ".json";
  }
}

class ArrayDataType extends DataType {
  #elementType: DataType;

  constructor(elementType: DataType) {
    super();
    this.#elementType = elementType;
  }

  display(data: unknown) {
    return (
      <code>
        <pre>{this.toString(data)}</pre>
      </code>
    );
  }

  toString(data: unknown): string {
    if (!Array.isArray(data)) {
      throw new Error("Expected array data");
    }
    return `{${data.map((d) => this.#elementType.toString(d)).join(",")}}`;
  }

  toSqlValue(data: unknown): string {
    if (!Array.isArray(data)) {
      throw new Error("Expected array data");
    }
    return `'{${data.map((d) => this.#elementType.toSqlValue(d)).join(",")}}'`;
  }

  fromString(value: string): unknown[] {
    if (value.startsWith("{") && value.endsWith("}")) {
      const inner = value.slice(1, -1);
      if (inner === "") return [];
      return inner.split(",").map((v) => this.#elementType.fromString(v));
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
  display(data: unknown): string {
    return this.toString(data);
  }

  toString(data: unknown): string {
    if (typeof data !== "number") {
      throw new Error(`Invalid data type for number: ${typeof data}`);
    }
    return data.toString();
  }

  fromString(value: string): unknown {
    return Number(value);
  }

  toSqlValue(data: unknown): string {
    return this.toString(data);
  }
}

class TextDataType extends DataType {
  display(data: unknown): string {
    return this.toString(data);
  }

  toString(data: unknown): string {
    if (typeof data !== "string") {
      throw new Error(`Invalid data type for text: ${typeof data}`);
    }
    return data;
  }

  fromString(value: string): unknown {
    return value;
  }

  toSqlValue(data: unknown): string {
    return `'${this.toString(data)}'`;
  }
}

class DefaultDataType extends DataType {
  display(data: unknown): string {
    return this.toString(data);
  }

  toString(data: unknown): string {
    return String(data);
  }

  fromString(value: string): unknown {
    return value;
  }

  toSqlValue(data: unknown): string {
    return this.toString(data);
  }
}

export function createDataType(
  type: PostgresDataType,
  isNullable: boolean,
): DataType {
  // Array data type
  if (type.endsWith("[]")) {
    const elementType = createDataType(type.slice(0, -2) as PostgresDataType);
    return new ArrayDataType(elementType);
  }

  switch (type) {
    case "json":
    case "jsonb":
      return new JsonDataType();

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
      return new TextDataType();

    case "integer":
    case "numeric":
    case "bigint":
    case "smallint":
      return new NumberDataType();

    default:
      return new DefaultDataType();
  }
}

export const NullType = new NullDataType();
