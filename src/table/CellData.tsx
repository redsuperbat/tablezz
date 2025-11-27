import type { JSXElement } from "solid-js";
import type { PostgresDataType } from "@/useTableStructure";

export interface CellData {
  display(): string;
  displayExpanded(): JSXElement;
}

class JsonCellData implements CellData {
  #data: unknown;

  constructor(data: unknown) {
    this.#data = data;
  }

  displayExpanded() {
    return (
      <code>
        <pre>{JSON.stringify(this.#data, null, 2)}</pre>
      </code>
    );
  }

  display(): string {
    return JSON.stringify(this.#data);
  }
}

class DefaultCellData implements CellData {
  #data: unknown;

  constructor(data: unknown) {
    this.#data = data;
  }

  displayExpanded(): string {
    return this.display();
  }

  display(): string {
    return String(this.#data);
  }
}

export namespace CellData {
  export function fromPostgresDataType(
    type: PostgresDataType,
    data: unknown,
  ): CellData {
    switch (type) {
      case "json":
      case "jsonb":
        return new JsonCellData(data);
      default:
        return new DefaultCellData(data);
    }
  }
}
