import { useSuspenseQuery } from "@tanstack/react-query";
import Database from "@tauri-apps/plugin-sql";
import { useMemo } from "react";
import { useConnectionCredentials } from "@/ConnectionCredentialsProvider";
import { useQueryHistory } from "./QueryHistoryProvider";

interface DatabaseConnection {
  select<T = unknown>(query: string, bindValues?: unknown[]): Promise<T>;
  execute(query: string, bindValues?: unknown[]): Promise<void>;
}

export function useDatabase(): DatabaseConnection {
  const queryHistory = useQueryHistory();
  const { databaseUrlRaw } = useConnectionCredentials();

  const databaseQuery = useSuspenseQuery({
    queryFn: () => Database.load(databaseUrlRaw),
    queryKey: ["database", databaseUrlRaw],
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
    [databaseQuery.data, queryHistory.addEntry],
  );
}
