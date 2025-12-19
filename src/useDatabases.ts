import { useQuery } from "@tanstack/solid-query";
import { useDatabase } from "./database/useDatabase";

export function useDatabases() {
  const database = useDatabase();

  return useQuery(() => ({
    queryFn: () =>
      database.select<{ databaseName: string }[]>(`
SELECT datname as "databaseName"
FROM pg_database
WHERE datistemplate = false
ORDER BY datname;
`),
    queryKey: ["databases"],
  }));
}
