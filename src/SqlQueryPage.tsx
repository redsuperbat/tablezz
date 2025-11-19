import { useQuery } from "@tanstack/solid-query";
import { Match, Switch } from "solid-js";
import { useDatabase } from "./database/useDatabase";
import { Table } from "./table/Table";
import { TableEditorProvider } from "./table/TableEditorProvider";

export function SqlQueryPage(props: { query: string }) {
  const database = useDatabase();

  const rows = useQuery(() => ({
    queryFn: () => database.select<Record<string, unknown>[]>(props.query),

    queryKey: ["sql-query", props.query],
  }));

  const structure = () =>
    Object.keys(rows.data?.at(0) ?? {}).map((k) => ({
      columnName: k,
      dataType: "text" as const,
    }));

  const rowsWithStructure = () => {
    if (!rows.data) {
      return;
    }

    return [
      structure().reduce(
        (acc, curr) => {
          acc[curr.columnName] = curr.columnName;
          return acc;
        },
        {} as Record<string, unknown>,
      ),
      ...rows.data,
    ];
  };

  return (
    <div class="grid h-full overflow-hidden">
      <Switch>
        <Match when={rows.error}>{(error) => error().message}</Match>
        <Match when={rowsWithStructure()}>
          {(rows) => (
            <TableEditorProvider rows={rows()}>
              <Table
                rows={rows()}
                structure={(structure() ?? []).map((d) => ({
                  columnName: d.columnName,
                  dataType: d.dataType,
                }))}
              />
            </TableEditorProvider>
          )}
        </Match>
      </Switch>
    </div>
  );
}
