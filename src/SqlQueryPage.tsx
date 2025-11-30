import { useQuery } from "@tanstack/solid-query";
import { Match, Switch } from "solid-js";
import { useDatabase } from "./database/useDatabase";
import { Table } from "./table/Table";
import { TableEditorProvider } from "./table/TableEditorProvider";

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
    }));

  return (
    <div class="grid h-full overflow-hidden">
      <Switch>
        <Match when={rowsQuery.error}>{(error) => error().message}</Match>
        <Match when={rowsQuery.data}>
          {(rows) => (
            <TableEditorProvider structure={structure()} rows={rows()}>
              <Table reload={rowsQuery.refetch} />
            </TableEditorProvider>
          )}
        </Match>
      </Switch>
    </div>
  );
}
