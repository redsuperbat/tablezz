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

export type TableStructure = {
  columnName: string;
  dataType: PostgresDataType;
  isPrimary: boolean;
};

export function useTableStructure(tableName: () => string) {
  const { schema } = useSchemaContext();
  const database = useDatabase();

  const primaryKeysQuery = useQuery(() => ({
    queryFn: async () => {
      const response = await database.select<
        {
          column_name: string;
        }[]
      >(
        `
          SELECT c.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name) 
          JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
            AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
          WHERE constraint_type = 'PRIMARY KEY' and tc.table_name = '${tableName()}';`,
      );

      return response.map((r) => ({
        columnName: r.column_name,
      }));
    },

    queryKey: ["primary-keys", tableName()],
  }));

  return useQuery<TableStructure[]>(() => ({
    enabled: !!primaryKeysQuery.data,
    queryFn: async () => {
      const primaryKeys = primaryKeysQuery.data ?? [];
      const response = await database.select<
        { column_name: string; data_type: PostgresDataType }[]
      >(
        `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = '${schema()}' AND table_name = '${tableName()}';`,
      );

      return response.map((r) => {
        const isPrimary = primaryKeys.some(
          (k) => k.columnName === r.column_name,
        );

        return {
          columnName: r.column_name,
          dataType: r.data_type,
          isPrimary,
        };
      });
    },
    queryKey: ["table-structure", schema(), tableName(), primaryKeysQuery.data],
  }));
}
