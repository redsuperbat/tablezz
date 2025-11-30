import type { JSXElement } from "solid-js";
import { Temporal } from "temporal-polyfill";
import type { PostgresDataType } from "@/useTableStructure";

export interface DataType {
  toString(data: unknown): string;
  display(data: unknown): JSXElement;
  isPrimary: boolean;
  fromString(value: string): unknown;
  toFileExtension?(): string;
}

class JsonCellData implements DataType {
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

  toFileExtension(): string {
    return ".json";
  }
}

class ZonedDateTimeCellData implements DataType {
  isPrimary = false;

  #toTemporal(data: unknown) {
    return Temporal.ZonedDateTime.from(
      `1970-01-01T${normalizeIsoDatetime(String(data))}`,
    );
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

class PlainDateTimeCellData implements DataType {
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

class PlainTimeCellData implements DataType {
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

class DefaultCellData implements DataType {
  isPrimary = false;

  constructor(isPrimary: boolean) {
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
  }
}
