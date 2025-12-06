import type { JSXElement } from "solid-js";
import { Temporal } from "temporal-polyfill";
import type { PostgresDataType } from "@/useTableStructure";

export abstract class DataType {
  abstract toString(data: unknown): string;
  abstract display(data: unknown): JSXElement;
  abstract fromString(data: string): unknown;
  abstract toSqlValue(data: unknown): string;

  fileExtension(): string {
    return ".txt";
  }

  isPrimary(): boolean {
    return false;
  }
}

class JsonCellData extends DataType {
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

  fromString(data: string): unknown {
    return JSON.parse(data);
  }

  toSqlValue(data: unknown): string {
    return JSON.stringify(data);
  }

  override fileExtension(): string {
    return ".json";
  }
}

class ArrayCellData extends DataType {
  display(data: unknown) {
    if (!Array.isArray(data)) {
      return String(data);
    }

    return (
      <code>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </code>
    );
  }

  toString(data: unknown): string {
    if (!Array.isArray(data)) {
      return String(data);
    }

    return `{${data.join(",")}}`;
  }

  toSqlValue(data: unknown): string {
    if (!Array.isArray(data)) {
      return String(data);
    }
    return `{${data.join(",")}}`;
  }

  fromString(data: string): unknown {
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

  constructor(inner: DataType) {
    super();
    this.#inner = inner;
  }

  toString(data: unknown): string {
    if (data == null) {
      return "null";
    }

    return this.#inner.toString(data);
  }

  display(data: unknown): JSXElement {
    if (data == null) {
      return null;
    }

    return this.#inner.display(data);
  }

  toSqlValue(data: unknown): string {
    if (data == null) {
      return "null";
    }

    return this.#inner.toSqlValue(data);
  }

  fromString(data: string): unknown {
    if (data === "null") {
      return null;
    }

    return this.#inner.fromString(data);
  }

  override isPrimary(): boolean {
    return this.#inner.isPrimary();
  }

  override fileExtension() {
    return this.#inner.fileExtension();
  }
}

class ZonedDateTimeCellData extends DataType {
  #toTemporal(data: unknown) {
    // Convert to ISO 8601 format
    const isoString = String(data)
      .replace(" ", "T")
      .replace(/([+-]\d{2}:\d{2}):\d{2}$/, "$1")
      .replace(/T(\d):/, "T0$1:") // Pad single-digit hours
      .replaceAll(" ", "");

    return Temporal.Instant.from(isoString).toZonedDateTimeISO("UTC");
  }

  toSqlValue(data: unknown): string {
    return this.toString(data);
  }

  display(data: unknown): string {
    return this.#toTemporal(data).toLocaleString();
  }

  toString(data: unknown): string {
    return this.#toTemporal(data).toString();
  }

  fromString(data: string): unknown {
    return data;
  }
}

class PlainDateTimeCellData extends DataType {
  #toTemporal(data: unknown) {
    return Temporal.PlainDateTime.from(normalizeIsoDatetime(String(data)));
  }

  display(data: unknown): string {
    return this.#toTemporal(data).toLocaleString();
  }

  toString(data: unknown): string {
    return this.#toTemporal(data).toString();
  }

  fromString(data: string): unknown {
    return data;
  }

  toSqlValue(data: unknown): string {
    return this.toString(data);
  }
}

class PlainTimeCellData extends DataType {
  #toTemporal(data: unknown) {
    return Temporal.PlainTime.from(String(data));
  }

  display(data: unknown): string {
    return this.#toTemporal(data).toString();
  }

  toString(data: unknown): string {
    return this.display(data);
  }

  fromString(data: string): unknown {
    return data;
  }

  toSqlValue(data: unknown): string {
    return this.toString(data);
  }
}

class DefaultCellData extends DataType {
  #isPrimary: boolean;

  constructor(isPrimary: boolean) {
    super();
    this.#isPrimary = isPrimary;
  }

  override isPrimary(): boolean {
    return this.#isPrimary;
  }

  display(data: unknown): string {
    return this.toString(data);
  }

  toString(data: unknown): string {
    return String(data);
  }

  fromString(data: string): unknown {
    return data;
  }

  toSqlValue(data: unknown): string {
    return this.toString(data);
  }
}

function normalizeIsoDatetime(s: string): string {
  // Replace Postgres space with T
  let out = s.replace(" ", "T");

  // Pad single-digit hour (T9: → T09:)
  out = out.replace(/T(\d)(:)/, (_, hour, colon) => `T0${hour}${colon}`);

  return out;
}

export namespace DataType {
  export function fromPostgresDataType({
    type,
    isPrimary,
  }: {
    type: PostgresDataType;
    isPrimary: boolean;
  }): DataType {
    const inner = () => {
      switch (type) {
        case "json":
        case "jsonb":
          return new JsonCellData();
        case "date":
        case "time":
        case "time without time zone":
          return new PlainTimeCellData();

        case "time with time zone":
          return new ZonedDateTimeCellData();

        case "timestamp":
        case "timestamp without time zone":
          return new PlainDateTimeCellData();

        case "timestamp with time zone":
          return new ZonedDateTimeCellData();

        case "ARRAY":
          return new ArrayCellData();

        default:
          return new DefaultCellData(isPrimary);
      }
    };

    return new WithoutNullish(inner());
  }
}
