import { useSuspenseQuery } from "@tanstack/react-query";
import Database from "@tauri-apps/plugin-sql";
import { useMemo } from "react";
import { useConfig } from "@/config/ConfigurationProvider";
import { useQueryHistory } from "./QueryHistoryProvider";

interface DatabaseConnection {
	select<T = unknown>(query: string, bindValues?: unknown[]): Promise<T>;
	execute(query: string, bindValues?: unknown[]): Promise<void>;
}

export function useDatabase(): DatabaseConnection {
	const config = useConfig();
	const queryHistory = useQueryHistory();

	const databaseQuery = useSuspenseQuery({
		queryFn: () => Database.load(config.get("databaseUrl")),
		queryKey: ["database", config.get("databaseUrl")],
	});

	return useMemo(
		() =>
			({
				async execute(query, bindValues) {
					queryHistory.addEntry({ query, createdAt: new Date() });
					await databaseQuery.data.execute(query, bindValues);
				},
				async select(query, bindValues) {
					queryHistory.addEntry({ query, createdAt: new Date() });
					return await databaseQuery.data.select(query, bindValues);
				},
			}) satisfies DatabaseConnection,
		[databaseQuery.data],
	);
}
