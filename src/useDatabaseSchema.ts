import { useQuery } from "@tanstack/react-query";
import { useSchemaContext } from "./SchemaProvider";
import { useDatabase } from "./useDatabase";

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
