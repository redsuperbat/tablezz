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
          is_primary: boolean;
        }[]
      >(
        `
SELECT
  c.column_name,
  c.data_type,
  (tc.constraint_type = 'PRIMARY KEY') AS is_primary
FROM information_schema.columns c
LEFT JOIN information_schema.key_column_usage kcu
  ON c.table_name = kcu.table_name
  AND c.column_name = kcu.column_name
  AND c.table_schema = kcu.table_schema
LEFT JOIN information_schema.table_constraints tc
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
  AND tc.constraint_type = 'PRIMARY KEY'
WHERE c.table_schema = '${schema()}'
  AND c.table_name = '${tableName()}'
ORDER BY c.ordinal_position;
`,
      );

      return response.map((r) => ({
        columnName: r.column_name,
        dataType: r.data_type,
        isPrimary: r.is_primary,
      }));
    },
    queryKey: ["table-structure", schema(), tableName()],
  }));
}
