import { invoke } from "@tauri-apps/api/core";

export interface Connection {
  readonly url: string;
}

export async function connect(url: string): Promise<Connection> {
  return { url: await invoke<string>("load", { databaseUrl: url }) };
}

export async function select<T = unknown>(
  connection: Connection,
  query: string,
  values: unknown[] = [],
): Promise<T> {
  return invoke<T>("select", { databaseUrl: connection.url, query, values });
}

export type PostgresPrimitiveTypes =
  | "smallint"
  | "integer"
  | "bigint"
  | "decimal"
  | "numeric"
  | "real"
  | "double precision"
  | "serial"
  | "bigserial"
  | "smallserial"
  | "money"
  | "character varying"
  | "varchar"
  | "character"
  | "char"
  | "text"
  | "citext"
  | "uuid"
  | "bytea"
  | "bit"
  | "bit varying"
  | "boolean"
  | "date"
  | "time"
  | "time without time zone"
  | "time with time zone"
  | "timestamp"
  | "timestamp without time zone"
  | "timestamp with time zone"
  | "interval"
  | "json"
  | "jsonb"
  | "xml"
  | "inet"
  | "cidr"
  | "macaddr"
  | "macaddr8"
  | "point"
  | "line"
  | "lseg"
  | "box"
  | "path"
  | "polygon"
  | "circle"
  | "tsvector"
  | "tsquery"
  | "USER-DEFINED";

export type PostgresDataType =
  | PostgresPrimitiveTypes
  | `${PostgresPrimitiveTypes}[]`
  | (string & {});

export type ForeignKey = {
  table: string;
  column: string;
};

export type TableStructure = {
  columnName: string;
  dataType: PostgresDataType;
  isPrimary: boolean;
  isNullable: boolean;
  foreignKey: ForeignKey | null;
};

export async function tableStructure(
  connection: Connection,
  schema: string,
  tableName: string,
): Promise<TableStructure[]> {
  return await invoke<TableStructure[]>("table_structure", {
    databaseUrl: connection.url,
    schema,
    tableName,
  });
}

/**
 * Execute multiple statements in a transaction
 */
export async function batchExecute(
  connection: Connection,
  statements: string[],
): Promise<void> {
  await invoke("batch_execute", {
    databaseUrl: connection.url,
    statements,
  });
}
