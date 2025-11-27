import { useQuery } from "@tanstack/solid-query";
import { useDatabase } from "./database/useDatabase";
import { useSchemaContext } from "./SchemaProvider";

export type PostgresDataType =
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

export function useTableStructure(tableName: () => string) {
  const { schema } = useSchemaContext();
  const database = useDatabase();

  return useQuery(() => ({
    queryFn: async () => {
      const response = await database.select<
        {
          column_name: string;
          data_type: PostgresDataType;
        }[]
      >(
        `
SELECT
column_name,
data_type
FROM information_schema.columns
WHERE table_schema = '${schema()}' AND table_name = '${tableName()}';`,
      );

      return response.map((r) => ({
        columnName: r.column_name,
        dataType: r.data_type,
      }));
    },
    queryKey: ["table-structure", schema(), tableName()],
  }));
}
