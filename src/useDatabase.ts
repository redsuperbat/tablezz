import { useSuspenseQuery } from "@tanstack/react-query";
import Database from "@tauri-apps/plugin-sql";
import { databaseCredentials } from "./databaseCredentials";

export function useDatabase() {
	const url = databaseCredentials.getOrThrow();

	const databaseQuery = useSuspenseQuery({
		queryFn: () => Database.load(url),
		queryKey: ["database", url],
	});

	return databaseQuery.data;
}
