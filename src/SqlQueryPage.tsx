import { useQuery } from "@tanstack/solid-query";
import { Match, Switch } from "solid-js";
import { useDatabase } from "./database/useDatabase";
import { DataTable } from "./table/DataTable";
import { DataTableProvider } from "./table/DataTableProvider";

export function SqlQueryPage(props: { query: string }) {
  const database = useDatabase();

  const rowsQuery = useQuery(() => ({
    queryFn: () => database.select<Record<string, unknown>[]>(props.query),
    queryKey: ["sql-query", props.query],
  }));

  const structure = () =>
    Object.keys(rowsQuery.data?.at(0) ?? {}).map((k) => ({
      columnName: k,
      dataType: "text" as const,
      isPrimary: false,
    }));

  return (
    <div class="grid h-full overflow-hidden">
      <Switch>
        <Match when={rowsQuery.error}>{(error) => error().message}</Match>
        <Match when={rowsQuery.data}>
          {(rows) => (
            <DataTableProvider
              structure={structure()}
              rows={rows()}
              name="Unknown"
            >
              <DataTable reload={rowsQuery.refetch} />
            </DataTableProvider>
          )}
        </Match>
      </Switch>
    </div>
  );
}
