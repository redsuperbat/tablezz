import { useQuery } from "@tanstack/react-query";
import { useDatabase } from "./database/useDatabase";

export function useSelectedDatabaseSchemas() {
  const database = useDatabase();

  return useQuery({
    queryFn: () =>
      database.select<{ schemaName: string }[]>(`
SELECT schema_name as "schemaName"
FROM information_schema.schemata;
`),
    queryKey: ["schema"],
  });
}
