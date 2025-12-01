import type { JSXElement } from "solid-js";
import { Temporal } from "temporal-polyfill";
import type { PostgresDataType } from "@/useTableStructure";

export abstract class DataType {
  abstract isPrimary: boolean;

  abstract toString(data: unknown): string;
  abstract display(data: unknown): JSXElement;
  abstract fromString(value: string): unknown;

  toFileExtension(): string {
    return ".txt";
  }
}

class JsonCellData extends DataType {
  isPrimary = false;

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

  override toFileExtension(): string {
    return ".json";
  }
}

class WithoutNullish extends DataType {
  isPrimary = false;
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

  fromString(value: string): unknown {
    if (value === "null") {
      return null;
    }

    return this.#inner.fromString(value);
  }

  override toFileExtension() {
    return this.#inner.toFileExtension();
  }
}

class ZonedDateTimeCellData extends DataType {
  isPrimary = false;

  #toTemporal(data: unknown) {
    // Convert to ISO 8601 format
    const isoString = String(data)
      .replace(" ", "T")
      .replace(/([+-]\d{2}:\d{2}):\d{2}$/, "$1")
      .replaceAll(" ", "");

    return Temporal.Instant.from(isoString).toZonedDateTimeISO("UTC");
  }

  display(data: unknown): string {
    return this.#toTemporal(data).toLocaleString();
  }

  toString(data: unknown): string {
    return this.#toTemporal(data).toString();
  }

  fromString(value: string): unknown {
    return value;
  }
}

class PlainDateTimeCellData extends DataType {
  isPrimary = false;

  #toTemporal(data: unknown) {
    return Temporal.PlainDateTime.from(normalizeIsoDatetime(String(data)));
  }

  display(data: unknown): string {
    return this.#toTemporal(data).toLocaleString();
  }

  toString(data: unknown): string {
    return this.#toTemporal(data).toString();
  }

  fromString(value: string): unknown {
    return value;
  }
}

class PlainTimeCellData extends DataType {
  isPrimary = false;

  #toTemporal(data: unknown) {
    return Temporal.PlainTime.from(String(data));
  }

  display(data: unknown): string {
    return this.#toTemporal(data).toString();
  }

  toString(data: unknown): string {
    return this.display(data);
  }

  fromString(value: string): unknown {
    return value;
  }
}

class DefaultCellData extends DataType {
  isPrimary: boolean;

  constructor(isPrimary: boolean) {
    super();
    this.isPrimary = isPrimary;
  }

  display(data: unknown): string {
    return this.toString(data);
  }

  toString(data: unknown): string {
    return String(data);
  }

  fromString(value: string): unknown {
    return value;
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
    console.log({ type });
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
        case "timestamp without time zone": {
          return new PlainDateTimeCellData();
        }

        case "timestamp with time zone": {
          return new ZonedDateTimeCellData();
        }
        default:
          return new DefaultCellData(isPrimary);
      }
    };

    return new WithoutNullish(inner());
  }
}
