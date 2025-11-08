import { useQuery } from "@tanstack/solid-query";
import { useDatabase } from "./database/useDatabase";
import { useSchemaContext } from "./SchemaProvider";

export function useTableCount(tableName: () => string) {
  const database = useDatabase();
  const { schema } = useSchemaContext();

  const query = () => `SELECT COUNT(*) FROM "${schema()}"."${tableName()}";`;

  const result = useQuery(() => ({
    queryFn: () => database.select<[{ count: number }]>(query()),

    queryKey: ["table-content", query()],
  }));

  return () => result.data?.[0].count;
}
