import { useQuery } from "@tanstack/react-query";
import { useDatabase } from "./database/useDatabase";
import { useSchemaContext } from "./SchemaProvider";

export function useSchemaStructure() {
  const { schema } = useSchemaContext();
  const database = useDatabase();
  return useQuery({
    queryFn: () =>
      database.select<{ table_name: string }[]>(
        `
SELECT table_name
FROM information_schema.tables
WHERE table_schema = '${schema}'
AND table_type = 'BASE TABLE';
`,
      ),
    queryKey: ["schema", schema],
  });
}
