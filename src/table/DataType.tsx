import type { JSXElement } from "solid-js";
import { Temporal } from "temporal-polyfill";
import { iife } from "@/lib/iife";
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

class JsonCellData extends DataType {
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

class ArrayCellData extends DataType {
  #data: unknown[];

  constructor(data: unknown) {
    super();
    if (!Array.isArray(data)) {
      throw new Error("Array data type was not an array");
    }
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
    return `{${this.#data.join(",")}}`;
  }

  toSqlValue(): string {
    return `{${this.#data.join(",")}}`;
  }

  fromString(data: string): string[] {
    if (data.startsWith("{") && data.endsWith("}")) {
      const inner = data.slice(1, -1);
      if (inner === "") return [];
      return inner.split(",");
    }

    throw new Error("Malformed array data");
  }
}

class WithoutNullish extends DataType {
  #inner: DataType;
  #data: unknown;

  constructor(inner: DataType, data: unknown) {
    super();
    this.#inner = inner;
    this.#data = data;
  }

  toString(): string {
    if (this.#data == null) {
      return "null";
    }

    return this.#inner.toString();
  }

  display(): JSXElement {
    if (this.#data == null) {
      return null;
    }

    return this.#inner.display();
  }

  toSqlValue(): string {
    if (this.#data == null) {
      return "null";
    }

    return this.#inner.toSqlValue();
  }

  fromString(data: string): unknown {
    if (data === "null") {
      return null;
    }

    return this.#inner.fromString(data);
  }

  override fileExtension() {
    return this.#inner.fileExtension();
  }
}

class ZonedDateTimeCellData extends DataType {
  #data: Temporal.ZonedDateTime;

  constructor(data: unknown) {
    super();
    // Convert to ISO 8601 format
    const isoString = String(data)
      .replace(" ", "T")
      .replace(/([+-]\d{2}:\d{2}):\d{2}$/, "$1")
      .replace(/T(\d):/, "T0$1:") // Pad single-digit hours
      .replaceAll(" ", "");

    this.#data = Temporal.Instant.from(isoString).toZonedDateTimeISO("UTC");
  }

  toSqlValue(): string {
    return this.toString();
  }

  display(): string {
    return this.#data.toLocaleString();
  }

  toString(): string {
    return this.#data.toString();
  }

  fromString(data: string): unknown {
    return data;
  }
}

class PlainDateTimeCellData extends DataType {
  #data: Temporal.PlainDateTime;

  constructor(data: unknown) {
    super();
    this.#data = Temporal.PlainDateTime.from(normalizeIsoDatetime(String(data)));
  }

  display(): string {
    return this.#data.toLocaleString();
  }

  toString(): string {
    return this.#data.toString();
  }

  fromString(data: string): unknown {
    return data;
  }

  toSqlValue(): string {
    return this.toString();
  }
}

class PlainTimeCellData extends DataType {
  #data: Temporal.PlainTime;

  constructor(data: unknown) {
    super();
    this.#data = Temporal.PlainTime.from(String(data));
  }

  display(): string {
    return this.#data.toString();
  }

  toString(): string {
    return this.#data.toString();
  }

  fromString(data: string): unknown {
    return data;
  }

  toSqlValue(): string {
    return this.toString();
  }
}

class DefaultCellData extends DataType {
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

function normalizeIsoDatetime(s: string): string {
  // Replace Postgres space with T
  let out = s.replace(" ", "T");

  // Pad single-digit hour (T9: → T09:)
  out = out.replace(/T(\d)(:)/, (_, hour, colon) => `T0${hour}${colon}`);

  return out;
}

export class DataTypeFactory {
  #type: PostgresDataType;

  constructor(dataType: PostgresDataType) {
    this.#type = dataType;
  }

  make(data: unknown): DataType {
    const inner: DataType = iife(() => {
      switch (this.#type) {
        case "json":
        case "jsonb":
          return new JsonCellData(data);
        case "date":
        case "time":
        case "time without time zone":
          return new PlainTimeCellData(data);

        case "time with time zone":
          return new ZonedDateTimeCellData(data);

        case "timestamp":
        case "timestamp without time zone":
          return new PlainDateTimeCellData(data);

        case "timestamp with time zone":
          return new ZonedDateTimeCellData(data);

        case "ARRAY":
          return new ArrayCellData(data);

        default:
          return new DefaultCellData(data);
      }
    });

    return new WithoutNullish(inner, data);
  }
}
