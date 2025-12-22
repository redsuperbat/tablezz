import { useQuery } from "@tanstack/solid-query";
import { Match, onMount, Switch } from "solid-js";
import { message } from "./commands/Messages";
import { useDatabase } from "./database/useDatabase";
import { useHopContext } from "./HopContext";
import { extractTableFromSql } from "./lib/extractTablesFromSql";
import { LoadingSpinner } from "./SuspenseBoundary";
import { DataTable } from "./table/DataTable";
import { DataTableProvider } from "./table/DataTableProvider";
import { type PostgresDataType, useTableStructure } from "./useTableStructure";

function PopCurrentHop(props: { errorMessage: string }) {
  const hopContext = useHopContext();

  onMount(() => {
    message.error(props.errorMessage);
    hopContext.pop();
  });

  return null;
}

export function SqlQueryPage(props: {
  query: string;
  initialRowIndex: number | undefined;
  initialColumnIndex: number | undefined;
}) {
  const database = useDatabase();

  const rowsQuery = useQuery(() => ({
    queryFn: () => database.select<Record<string, unknown>[]>(props.query),
    queryKey: ["sql-query", props.query],
  }));

  const extractedTable = () => extractTableFromSql(props.query);

  const tableName = () => extractedTable()?.table ?? "";
  const schemaName = () => extractedTable()?.schema ?? "";

  const structureQuery = useTableStructure(tableName);

  const structure = () => {
    const parsedStructure = structureQuery.data;

    if (parsedStructure && parsedStructure.length > 0) {
      const columns = extractedTable()?.columns?.map((c) => c.name);
      // null/undefined columns means SELECT * - return all columns
      if (!columns) {
        return parsedStructure;
      }
      return parsedStructure.filter((s) => columns.includes(s.columnName));
    }

    const getDataType = (data: unknown): PostgresDataType => {
      switch (typeof data) {
        case "string":
          return "text";
        case "number":
          return "integer";
        case "bigint":
          return "bigint";
        case "boolean":
          return "boolean";
        case "symbol":
        case "undefined":
        case "object":
        case "function":
          return "text";
      }
    };

    // infer columns from query result if no parsed structure could be determined
    return Object.entries(rowsQuery.data?.at(0) ?? {}).map(([key, data]) => ({
      columnName: key,
      dataType: getDataType(data),
      isPrimary: false,
      foreignKey: null,
      isNullable: true,
    }));
  };

  const isLoading = () => rowsQuery.isLoading || structureQuery.isLoading;
  const error = () => rowsQuery.error || structureQuery.error;

  return (
    <div class="grid h-full overflow-hidden">
      <Switch>
        <Match when={error()}>
          {(error) => <PopCurrentHop errorMessage={error().message} />}
        </Match>
        <Match when={isLoading()}>
          <LoadingSpinner />
        </Match>
        <Match keyed when={rowsQuery.data}>
          {(rows) => (
            <DataTableProvider
              reload={rowsQuery.refetch}
              structure={structure()}
              rows={rows}
              tableName={tableName()}
              schemaName={schemaName()}
              initialRowIndex={props.initialRowIndex}
              initialColumnIndex={props.initialColumnIndex}
            >
              <DataTable reload={rowsQuery.refetch} />
            </DataTableProvider>
          )}
        </Match>
      </Switch>
    </div>
  );
}
