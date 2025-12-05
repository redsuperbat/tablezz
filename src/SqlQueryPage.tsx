import { useQuery } from "@tanstack/solid-query";
import { Match, Switch } from "solid-js";
import { useDatabase } from "./database/useDatabase";
import { extractPrimaryTableFromSql } from "./lib/extractTablesFromSql";
import { DataTable } from "./table/DataTable";
import { DataTableProvider } from "./table/DataTableProvider";
import { useTableStructure } from "./useTableStructure";

export function SqlQueryPage(props: { query: string }) {
  const database = useDatabase();

  const rowsQuery = useQuery(() => ({
    queryFn: () => database.select<Record<string, unknown>[]>(props.query),
    queryKey: ["sql-query", props.query],
  }));

  const extractedTable = () => extractPrimaryTableFromSql(props.query);

  const tableName = () => extractedTable()?.table ?? "";

  const structureQuery = useTableStructure(tableName);

  // Use parsed table structure if available, otherwise fall back to inferring from result keys
  const structure = () => {
    const parsedStructure = structureQuery.data;

    if (parsedStructure && parsedStructure.length > 0) {
      return parsedStructure;
    }

    // Fallback: infer columns from query result
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
