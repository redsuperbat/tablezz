import { useQuery } from "@tanstack/solid-query";
import { useDatabase } from "./database/useDatabase";
import { useSchemaContext } from "./SchemaProvider";

export function useSelectedSchemaTables() {
  const { schema } = useSchemaContext();
  const database = useDatabase();
  return useQuery(() => ({
    queryFn: () =>
      database.select<{ tableName: string }[]>(
        `
SELECT table_name as "tableName"
FROM information_schema.tables
WHERE table_schema = '${schema}'
AND table_type = 'BASE TABLE';
`,
      ),
    queryKey: ["schema", schema],
  }));
}
