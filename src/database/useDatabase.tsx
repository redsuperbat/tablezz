import { useQuery } from "@tanstack/solid-query";
import Database from "@tauri-apps/plugin-sql";
import {
  createContext,
  Match,
  type ParentProps,
  Switch,
  useContext,
} from "solid-js";
import { useConnectionCredentials } from "@/ConnectionCredentialsProvider";
import { useQueryHistory } from "./QueryHistoryProvider";

interface DatabaseConnectionContext {
  select<T = unknown>(query: string, bindValues?: unknown[]): Promise<T>;
  execute(query: string, bindValues?: unknown[]): Promise<void>;
}

const DatabaseConnectionContext =
  createContext<DatabaseConnectionContext | null>(null);

async function wrapWithError<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    throw new Error(String(error), { cause: error });
  }
}

function Center(props: ParentProps) {
  return (
    <div class="grid h-screen w-screen place-items-center">
      {props.children}
    </div>
  );
}

export function DatabaseConnectionProvider(props: ParentProps) {
  const queryHistory = useQueryHistory();
  const { url } = useConnectionCredentials();

  const databaseQuery = useQuery(() => ({
    queryFn: () => wrapWithError(Database.load(url())),
    queryKey: ["database", url()],
  }));

  return (
    <Switch>
      <Match when={databaseQuery.isPending}>
        <Center>Connecting to database...</Center>
      </Match>
      <Match when={databaseQuery.error}>
        {(error) => <Center>{error().message}</Center>}
      </Match>
      <Match when={databaseQuery.data}>
        {(database) => (
          <DatabaseConnectionContext.Provider
            value={{
              async select(query, bindValues) {
                queryHistory?.addEntry({ query, createdAt: new Date() });
                return wrapWithError(database().select(query, bindValues));
              },
              async execute(query, bindValues) {
                queryHistory?.addEntry({ query, createdAt: new Date() });
                await wrapWithError(database().execute(query, bindValues));
              },
            }}
          >
            {props.children}
          </DatabaseConnectionContext.Provider>
        )}
      </Match>
    </Switch>
  );
}

export function useDatabase(): DatabaseConnectionContext {
  const ctx = useContext(DatabaseConnectionContext);
  if (!ctx) {
    throw new Error("bad");
  }
  return ctx;
}
