import { useQuery } from "@tanstack/solid-query";
import {
  createContext,
  Match,
  type ParentProps,
  Switch,
  useContext,
} from "solid-js";
import { useConnectionCredentials } from "@/ConnectionCredentialsProvider";
import * as database from "./database";
import { useQueryHistory } from "./QueryHistoryProvider";

interface DatabaseConnectionContext {
  select<T = unknown>(query: string, bindValues?: unknown[]): Promise<T>;
  batchExecute(statements: string[]): Promise<void>;
  tableStructure(
    schema: string,
    tableName: string,
  ): Promise<database.TableStructure[]>;
  getTableReferences(
    schema: string,
    tableName: string,
  ): Promise<database.TableReference[]>;
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

  const connectionQuery = useQuery(() => ({
    queryFn: () => wrapWithError(database.connect(url())),
    queryKey: ["database", url()],
  }));

  return (
    <Switch>
      <Match when={connectionQuery.isPending}>
        <Center>Connecting to database...</Center>
      </Match>
      <Match when={connectionQuery.error}>
        {(error) => <Center>{error().message}</Center>}
      </Match>
      <Match when={connectionQuery.data}>
        {(connection) => (
          <DatabaseConnectionContext.Provider
            value={{
              tableStructure(schema, tableName) {
                return wrapWithError(
                  database.tableStructure(connection(), schema, tableName),
                );
              },
              batchExecute(statements) {
                queryHistory.addEntry({
                  query: statements.join(`\n`),
                  createdAt: new Date(),
                });
                return wrapWithError(
                  database.batchExecute(connection(), statements),
                );
              },
              select(query, bindValues) {
                queryHistory.addEntry({ query, createdAt: new Date() });
                return wrapWithError(
                  database.select(connection(), query, bindValues ?? []),
                );
              },
              getTableReferences(schema, tableName) {
                return wrapWithError(
                  database.getTableReferences(connection(), schema, tableName),
                );
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
    throw new Error("Could not find database connection context");
  }
  return ctx;
}
