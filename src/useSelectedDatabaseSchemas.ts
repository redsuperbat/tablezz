import { useQuery } from "@tanstack/solid-query";
import { useConnectionCredentials } from "./ConnectionCredentialsProvider";
import { useDatabase } from "./database/useDatabase";

export function useSelectedDatabaseSchemas() {
  const database = useDatabase();
  const { url } = useConnectionCredentials();

  return useQuery(() => ({
    queryFn: () =>
      database.select<{ schemaName: string }[]>(`
SELECT schema_name as "schemaName"
FROM information_schema.schemata;
`),
    queryKey: ["schema", url()],
  }));
}
