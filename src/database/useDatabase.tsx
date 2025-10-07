import { useQuery } from "@tanstack/solid-query";
import Database from "@tauri-apps/plugin-sql";
import { createContext, type ParentProps, Show, useContext } from "solid-js";
import { useConnectionCredentials } from "@/ConnectionCredentialsProvider";
import { useQueryHistory } from "./QueryHistoryProvider";

interface DatabaseConnectionContext {
  select<T = unknown>(query: string, bindValues?: unknown[]): Promise<T>;
  execute(query: string, bindValues?: unknown[]): Promise<void>;
}

const DatabaseConnectionContext =
  createContext<DatabaseConnectionContext | null>(null);

export function DatabaseConnectionProvider(props: ParentProps) {
  const queryHistory = useQueryHistory();
  const { databaseUrlRaw } = useConnectionCredentials();

  const databaseQuery = useQuery(() => ({
    queryFn: () =>
      Database.load(databaseUrlRaw).catch((e) => {
        // For some reason the tauri sql sdk throws strings 🤷
        throw new Error(String(e), { cause: e });
      }),
    queryKey: ["database", databaseUrlRaw],
  }));

  return (
    <Show when={databaseQuery.data} fallback={"Loading..."}>
      <DatabaseConnectionContext.Provider
        value={{
          async select(query, bindValues) {
            if (!databaseQuery.data) {
              throw new Error("Internal tablezz error");
            }

            try {
              queryHistory.addEntry({ query, createdAt: new Date() });
              return await databaseQuery.data?.select(query, bindValues);
            } catch (error) {
              throw new Error(String(error), { cause: error });
            }
          },
          async execute(query, bindValues) {
            try {
              queryHistory.addEntry({ query, createdAt: new Date() });
              await databaseQuery.data?.execute(query, bindValues);
            } catch (error) {
              throw new Error(String(error), { cause: error });
            }
          },
        }}
      >
        {props.children}
      </DatabaseConnectionContext.Provider>
    </Show>
  );
}

export function useDatabase(): DatabaseConnectionContext {
  const ctx = useContext(DatabaseConnectionContext);
  if (!ctx) {
    throw new Error("bad");
  }
  return ctx;
}
