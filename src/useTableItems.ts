import { useQuery } from "@tanstack/react-query";
import { useDatabase } from "./database/useDatabase";
import { useSchemaContext } from "./SchemaProvider";

export function useTableItems(tableName: string) {
  const database = useDatabase();
  const { schema } = useSchemaContext();

  return useQuery({
    queryFn: () =>
      database.select<object[]>(`SELECT * FROM ${schema}.${tableName};`),

    queryKey: ["table-content", tableName],
  });
}
