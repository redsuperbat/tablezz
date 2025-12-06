import { useQuery } from "@tanstack/solid-query";
import { invoke } from "@tauri-apps/api/core";
import { useConnectionCredentials } from "./ConnectionCredentialsProvider";
import { useSchemaContext } from "./SchemaProvider";

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

export type TableStructure = {
  columnName: string;
  dataType: PostgresDataType;
  isPrimary: boolean;
  isNullable: boolean;
};

export function useTableStructure(tableName: () => string) {
  const { schema } = useSchemaContext();
  const { url } = useConnectionCredentials();

  return useQuery<TableStructure[]>(() => ({
    queryFn: async () => {
      const result = await invoke<
        {
          columnName: string;
          dataType: PostgresDataType;
          isPrimary: boolean;
          isNullable: boolean;
        }[]
      >("table_structure", {
        db: url(),
        schema: schema(),
        tableName: tableName(),
      });

      return result;
    },
    queryKey: ["table-structure", schema(), tableName(), url()],
  }));
}
