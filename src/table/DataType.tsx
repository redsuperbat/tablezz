import {
  Braces,
  Brackets,
  Calendar,
  CaseLower,
  Sigma,
  SplinePointer,
  ToggleLeft,
} from "lucide-solid";
import type { JSXElement } from "solid-js";
import { iife } from "@/lib/iife";
import type { PostgresDataType } from "@/useTableStructure";

export abstract class DataType {
  abstract toString(data: unknown): string;
  abstract cellRender(data: unknown): JSXElement;
  abstract fromString(value: string): unknown;
  abstract toSqlValue(data: unknown): string;

  icon(_className: string): JSXElement {
    return null;
  }

  fileExtension(): string {
    return ".txt";
  }
}

class JsonDataType extends DataType {
  cellRender(data: unknown): JSXElement {
    const str = JSON.stringify(data);
    return str.length > 1000 ? str.slice(0, 1000) : str;
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

  override icon(className: string): JSXElement {
    return <Braces class={className} />;
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

  cellRender(data: unknown): JSXElement {
    return this.toString(data);
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
    return `ARRAY[${data.map((d) => this.#elementType.toSqlValue(d)).join(",")}]`;
  }

  override icon(className: string): JSXElement {
    return (
      <>
        {this.#elementType.icon(className)}
        <Brackets class={className} />
      </>
    );
  }

  fromString(value: string): unknown[] {
    if (!value.startsWith("{") || !value.endsWith("}")) {
      throw new Error("Malformed array data, must start and end with {}");
    }

    const inner = value.slice(1, -1);
    if (inner === "") return [];

    return inner.split(",").map((v) => this.#elementType.fromString(v.trim()));
  }
}

class WithNull extends DataType {
  #inner: DataType;

  constructor(inner: DataType) {
    super();
    this.#inner = inner;
  }

  toSqlValue(value: unknown): string {
    if (value === null) {
      return "null";
    }

    return this.#inner.toSqlValue(value);
  }

  cellRender(value: unknown): JSXElement {
    if (value === null) {
      return "null";
    }

    return this.#inner.cellRender(value);
  }

  toString(value: unknown): string {
    if (value === null) {
      return "null";
    }

    return this.#inner.toString(value);
  }

  fromString(value: string): unknown {
    if (value === "null") {
      return null;
    }

    return this.#inner.fromString(value);
  }

  override icon(className: string): JSXElement {
    return this.#inner.icon(className);
  }

  override fileExtension(): string {
    return this.#inner.fileExtension();
  }
}

class NumberDataType extends DataType {
  #assertNumber(data: unknown): asserts data is number {
    if (typeof data !== "number") {
      throw new Error("Number data type was not of type number");
    }
  }

  cellRender(data: unknown): JSXElement {
    return this.toString(data);
  }

  toString(data: unknown): string {
    this.#assertNumber(data);
    return data.toString();
  }

  fromString(value: string): unknown {
    return Number(value);
  }

  override icon(className: string): JSXElement {
    return <Sigma class={className} />;
  }

  toSqlValue(data: unknown): string {
    return this.toString(data);
  }
}

class TextDataType extends DataType {
  #assertString(data: unknown): asserts data is string {
    if (typeof data !== "string") {
      throw new Error("Value is not string");
    }
  }

  #quote(data: string) {
    return `'${data}'`;
  }

  cellRender(data: unknown): JSXElement {
    this.#assertString(data);
    return data;
  }

  toString(data: unknown): string {
    this.#assertString(data);
    return this.#quote(data);
  }

  fromString(value: string): unknown {
    if (!value.endsWith("'") || !value.startsWith("'")) {
      throw new Error("Invalid string, must start or end with single quotes");
    }

    // remove quotes
    return value.slice(1, -1);
  }

  toSqlValue(data: unknown): string {
    this.#assertString(data);
    return this.#quote(data);
  }

  override icon(className: string): JSXElement {
    return <CaseLower class={className} />;
  }
}

// Treat the date data type as a textual format
// for now when serializing and editing
class DateDataType extends TextDataType {
  override icon(className: string): JSXElement {
    return <Calendar class={className} />;
  }
}

class VectorDataType extends DataType {
  #isTruncatedVector(
    data: unknown,
  ): data is { preview: number[]; length: number } {
    return (
      data !== null &&
      typeof data === "object" &&
      "preview" in data &&
      "length" in data
    );
  }

  cellRender(data: unknown): JSXElement {
    return this.toString(data);
  }

  toString(data: unknown): string {
    if (!this.#isTruncatedVector(data)) {
      throw new Error("Invalid vector data");
    }
    const previewStr = data.preview.join(", ");
    return `[${previewStr}] (${data.length})`;
  }

  fromString(): unknown {
    throw new Error("Editing vector data is not supported");
  }

  toSqlValue(): string {
    throw new Error("Editing vector data is not supported");
  }

  override icon(className: string): JSXElement {
    return <SplinePointer class={className} />;
  }
}

class DefaultDataType extends DataType {
  cellRender(data: unknown): JSXElement {
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

class BooleanDataType extends DefaultDataType {
  override icon(className: string): JSXElement {
    return <ToggleLeft class={className} />;
  }
}

export function createDataType(
  type: PostgresDataType,
  isNullable: boolean,
): DataType {
  const inner = iife(() => {
    if (type.endsWith("[]")) {
      const elementType = createDataType(
        type.slice(0, -2) as PostgresDataType,
        // We cannot have nullable elements in arrays
        false,
      );
      return new ArrayDataType(elementType);
    }

    switch (type) {
      case "json":
      case "jsonb":
        return new JsonDataType();

      case "date":
      case "time":
      case "time without time zone":
      case "time with time zone":
      case "timestamp(3)":
      case "timestamp(3) without time zone":
      case "timestamp(3) with time zone":
        return new DateDataType();

      case "uuid":
      case "text":
      case "varchar":
      case "character varying":
      case "char":
        return new TextDataType();

      case "decimal":
      case "integer":
      case "numeric":
      case "bigint":
      case "smallint":
        return new NumberDataType();

      case "vector":
        return new VectorDataType();
      case "boolean":
        return new BooleanDataType();

      default:
        return new DefaultDataType();
    }
  });

  if (isNullable) {
    return new WithNull(inner);
  }

  return inner;
}
