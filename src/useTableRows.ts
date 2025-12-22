import { useQuery } from "@tanstack/solid-query";
import type { TableStructure } from "./database/database";
import { useDatabase } from "./database/useDatabase";
import { useSchemaContext } from "./SchemaProvider";

export function useTableRows(
  tableName: () => string,
  structure: () => TableStructure[],
  limit = 100,
) {
  const database = useDatabase();
  const { schema } = useSchemaContext();

  const query = () => {
    const idColumnName = structure().find((c) => c.isPrimary)?.columnName;

    if (idColumnName) {
      return `SELECT * FROM "${schema()}"."${tableName()}" ORDER BY "${idColumnName}" LIMIT ${limit};`;
    }

    return `SELECT * FROM "${schema()}"."${tableName()}" LIMIT ${limit};`;
  };

  return useQuery(() => ({
    queryFn: () => database.select<Record<string, unknown>[]>(query()),
    staleTime: Infinity,
    queryKey: ["table-content", query()],
  }));
}
