import { astVisitor, parse, type Statement } from "pgsql-ast-parser";

export type ExtractedTable = {
  table: string;
  schema?: string;
};

/**
 * Extracts table names from a SQL query using PostgreSQL AST parsing.
 * Returns an array of tables referenced in the query (FROM, JOIN, INSERT INTO, UPDATE, DELETE FROM, etc.)
 */
export function extractTablesFromSql(sql: string): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  const seen = new Set<string>();

  let statements: Statement[];
  try {
    statements = parse(sql);
  } catch {
    // If parsing fails, return empty array
    return [];
  }

  const visitor = astVisitor(() => ({
    tableRef: (t) => {
      const key = t.schema ? `${t.schema}.${t.name}` : t.name;
      if (!seen.has(key)) {
        seen.add(key);
        tables.push({
          table: t.name,
          schema: t.schema ?? undefined,
        });
      }
    },
  }));

  for (const statement of statements) {
    visitor.statement(statement);
  }

  return tables;
}

/**
 * Extracts the first/primary table from a SQL query.
 * For SELECT queries, this is typically the main table in the FROM clause.
 */
export function extractPrimaryTableFromSql(
  sql: string,
): ExtractedTable | undefined {
  const tables = extractTablesFromSql(sql);
  return tables[0];
}
