import type { JSXElement } from "solid-js";
import { Temporal } from "temporal-polyfill";
import type { PostgresDataType } from "@/useTableStructure";

export interface DataType {
  toString(data: unknown): string;
  display(data: unknown): JSXElement;
  is?(data: unknown): boolean;
}

class JsonCellData implements DataType {
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
}

class ZonedDateTimeCellData implements DataType {
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
}

class PlainDateTimeCellData implements DataType {
  #toTemporal(data: unknown) {
    return Temporal.PlainDateTime.from(normalizeIsoDatetime(String(data)));
  }

  display(data: unknown): string {
    return this.#toTemporal(data).toLocaleString();
  }

  toString(data: unknown): string {
    return this.#toTemporal(data).toString();
  }
}

class PlainTimeCellData implements DataType {
  #toTemporal(data: unknown) {
    return Temporal.PlainTime.from(String(data));
  }

  display(data: unknown): string {
    return this.#toTemporal(data).toString();
  }

  toString(data: unknown): string {
    return this.display(data);
  }
}

class DefaultCellData implements DataType {
  display(data: unknown): string {
    return this.toString(data);
  }

  toString(data: unknown): string {
    return String(data);
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
  export function fromPostgresDataType(type: PostgresDataType): DataType {
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
        return new DefaultCellData();
    }
  }
}
