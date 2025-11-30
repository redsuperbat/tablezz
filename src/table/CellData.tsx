import type { JSXElement } from "solid-js";
import { Temporal } from "temporal-polyfill";
import type { PostgresDataType } from "@/useTableStructure";

export interface CellData {
  toString(): string;
  display(): JSXElement;
}

class JsonCellData implements CellData {
  #data: unknown;

  constructor(data: unknown) {
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
}

class ZonedDateTimeCellData implements CellData {
  #data: Temporal.ZonedDateTime;

  constructor(data: Temporal.ZonedDateTime) {
    this.#data = data;
  }

  display(): string {
    return this.toString();
  }

  toString(): string {
    return this.#data.toString();
  }
}

class PlainDateTimeCellData implements CellData {
  #data: Temporal.PlainDateTime;

  constructor(data: Temporal.PlainDateTime) {
    this.#data = data;
  }

  display(): string {
    return this.#data.toLocaleString();
  }

  toString(): string {
    return this.#data.toString();
  }
}

class PlainTimeCellData implements CellData {
  #data: Temporal.PlainTime;

  constructor(data: Temporal.PlainTime) {
    this.#data = data;
  }

  display(): string {
    return this.#data.toLocaleString();
  }

  toString(): string {
    return this.#data.toString();
  }
}

class DefaultCellData implements CellData {
  #data: unknown;

  constructor(data: unknown) {
    this.#data = data;
  }

  display(): string {
    return this.toString();
  }

  toString(): string {
    return String(this.#data);
  }
}

function normalizeIsoDatetime(s: string): string {
  // Replace Postgres space with T
  let out = s.replace(" ", "T");

  // Pad single-digit hour (T9: → T09:)
  out = out.replace(/T(\d)(:)/, (_, hour, colon) => `T0${hour}${colon}`);

  return out;
}

export namespace CellData {
  export function fromPostgresDataType(
    type: PostgresDataType,
    data: unknown,
  ): CellData {
    const stringData = String(data);
    switch (type) {
      case "json":
      case "jsonb":
        return new JsonCellData(data);
      case "date":
      case "time":
      case "time without time zone":
        return new PlainTimeCellData(Temporal.PlainTime.from(stringData));

      case "time with time zone":
        // Example: "17:32:10.123456-07:00"
        // Temporal doesn't have a PlainTime with TZ,
        // so interpret as a UTC ZonedDateTime on arbitrary date
        return new ZonedDateTimeCellData(
          Temporal.ZonedDateTime.from(`1970-01-01T${stringData}`),
        );

      case "timestamp":
      case "timestamp without time zone": {
        const dataString = normalizeIsoDatetime(stringData);
        // "YYYY-MM-DD HH:MM:SS[.fraction]"
        // Convert space → T so Temporal accepts it
        return new PlainDateTimeCellData(
          Temporal.PlainDateTime.from(dataString),
        );
      }

      case "timestamp with time zone": {
        const dataString = normalizeIsoDatetime(stringData);
        // "YYYY-MM-DD HH:MM:SS[.fraction]+/-HH[:MM]"
        // Replace space → T and parse as actual ZonedDateTime
        return new ZonedDateTimeCellData(
          Temporal.ZonedDateTime.from(dataString),
        );
      }
      default:
        return new DefaultCellData(data);
    }
  }
}
