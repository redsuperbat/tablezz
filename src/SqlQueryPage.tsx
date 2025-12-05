import { useQuery } from "@tanstack/solid-query";
import { Match, Switch } from "solid-js";
import { useDatabase } from "./database/useDatabase";
import { extractTableFromSql } from "./lib/extractTablesFromSql";
import { DataTable } from "./table/DataTable";
import { DataTableProvider } from "./table/DataTableProvider";
import { useTableStructure } from "./useTableStructure";

export function SqlQueryPage(props: { query: string }) {
  const database = useDatabase();

  const rowsQuery = useQuery(() => ({
    queryFn: () => database.select<Record<string, unknown>[]>(props.query),
    queryKey: ["sql-query", props.query],
  }));

  const extractedTable = () => extractTableFromSql(props.query);

  const tableName = () => extractedTable()?.table ?? "";

  const structureQuery = useTableStructure(tableName);

  const structure = () => {
    const parsedStructure = structureQuery.data;

    if (parsedStructure && parsedStructure.length > 0) {
      const columns = extractedTable()?.columns?.map((c) => c.name) ?? [];
      return parsedStructure.filter((s) => columns.includes(s.columnName));
    }

    // infer columns from query result if no parsed structure could be determined
    return Object.keys(rowsQuery.data?.at(0) ?? {}).map((k) => ({
      columnName: k,
      dataType: "text" as const,
      isPrimary: false,
    }));
  };

  return (
    <div class="grid h-full overflow-hidden">
      <Switch>
        <Match when={rowsQuery.error}>{(error) => error().message}</Match>
        <Match when={rowsQuery.data}>
          {(rows) => (
            <DataTableProvider
              reload={rowsQuery.refetch}
              structure={structure()}
              rows={rows()}
              name={tableName() || "Query Result"}
            >
              <DataTable reload={rowsQuery.refetch} />
            </DataTableProvider>
          )}
        </Match>
      </Switch>
    </div>
  );
}
