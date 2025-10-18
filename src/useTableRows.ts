import { useQuery } from "@tanstack/solid-query";
import { createMemo } from "solid-js";
import { useDatabase } from "./database/useDatabase";
import { useSchemaContext } from "./SchemaProvider";

function useTableRowsDatabaseQuery(tableName: () => string) {
  const { schema } = useSchemaContext();

  return createMemo(() => `SELECT * FROM "${schema()}"."${tableName()}"`);
}

export function useTableRows(tableName: () => string) {
  const database = useDatabase();
  const query = useTableRowsDatabaseQuery(tableName);

  return useQuery(() => ({
    queryFn: () => database.select<Record<string, unknown>[]>(query()),

    queryKey: ["table-content", query(), tableName()],
  }));
}
