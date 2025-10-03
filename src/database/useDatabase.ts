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
    queryFn: () =>
      Database.load(databaseUrlRaw).catch((e) => {
        // For some reason the tauri sql sdk throws strings 🤷
        throw new Error(String(e), { cause: e });
      }),
    queryKey: ["database", databaseUrlRaw],
  });

  return useMemo(
    (): DatabaseConnection => ({
      async execute(query, bindValues) {
        try {
          queryHistory.addEntry({ query, createdAt: new Date() });
          await databaseQuery.data.execute(query, bindValues);
        } catch (error) {
          throw new Error(String(error), { cause: error });
        }
      },
      async select(query, bindValues) {
        try {
          queryHistory.addEntry({ query, createdAt: new Date() });
          return await databaseQuery.data.select(query, bindValues);
        } catch (error) {
          throw new Error(String(error), { cause: error });
        }
      },
    }),
    [databaseQuery.data, queryHistory.addEntry],
  );
}
