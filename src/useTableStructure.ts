import { useQuery } from "@tanstack/solid-query";
import { useConnectionCredentials } from "./ConnectionCredentialsProvider";
import { useDatabase } from "./database/useDatabase";
import { useSchemaContext } from "./SchemaProvider";

export function useTableStructure(tableName: () => string) {
  const { schema } = useSchemaContext();
  const { url } = useConnectionCredentials();
  const database = useDatabase();

  return useQuery(() => ({
    queryFn: () => database.tableStructure(schema(), tableName()),
    queryKey: ["table-structure", schema(), tableName(), url()],
    staleTime: Infinity,
  }));
}
