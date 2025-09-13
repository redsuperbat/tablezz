import { useQuery } from "@tanstack/react-query";
import { useDatabase } from "./useDatabase";

export function useTableContent(tableName: string) {
	const database = useDatabase();

	return useQuery({
		queryFn: () =>
			database.select<object[]>(`
SELECT * FROM ${tableName};
`),

		queryKey: ["table-content", tableName],
	});
}
