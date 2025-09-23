import { useQuery } from "@tanstack/react-query";
import { useDatabase } from "./database/useDatabase";
import { useSchemaContext } from "./SchemaProvider";

export function useDatabaseSchema() {
  const { schemaName } = useSchemaContext();
  const database = useDatabase();
  return useQuery({
    queryFn: () =>
      database.select<{ table_name: string }[]>(
        `
SELECT table_name
FROM information_schema.tables
WHERE table_schema = '${schemaName}'
AND table_type = 'BASE TABLE';
`,
      ),
    queryKey: ["schema", schemaName],
  });
}
