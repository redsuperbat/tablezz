import { useQuery } from "@tanstack/react-query";
import { useDatabase } from "./database/useDatabase";
import { useSchemaContext } from "./SchemaProvider";

type PostgresDataType =
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
  | "ARRAY"
  | "USER-DEFINED";

type ColumnDefault = "now()" | null;

export function useTableStructure(tableName: string) {
  const { schemaName } = useSchemaContext();
  const database = useDatabase();
  return useQuery({
    queryFn: () =>
      database.select<
        {
          column_name: string;
          data_type: PostgresDataType;
          is_nullable: "YES" | "NO";
          column_default: ColumnDefault;
        }[]
      >(
        `
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = '${schemaName}' AND table_name = '${tableName}';`,
      ),
    queryKey: ["schema", schemaName, tableName],
  });
}
