import { astVisitor, parse, type Statement } from "pgsql-ast-parser";

export type ExtractedColumn = {
  name: string;
  alias?: string;
};

export type ExtractedTable = {
  table: string;
  schema?: string;
  columns: ExtractedColumn[] | null; // null means infer from data
};

export function extractTableFromSql(sql: string): ExtractedTable | null {
  let statements: Statement[];
  try {
    statements = parse(sql);
  } catch {
    return null;
  }
  const statement = statements[0];

  if (!statement) {
    return null;
  }

  let table: { name: string; schema?: string } | null = null;

  const visitor = astVisitor(() => ({
    tableRef: (t) => {
      if (table !== null) return;
      table = { name: t.name, schema: t.schema ?? undefined };
    },
  }));

  visitor.statement(statement);

  if (table === null) {
    return null;
  }

  const extractedTable = table as { name: string; schema?: string };
  let columns: ExtractedColumn[] | null = null;
  if (statement?.type === "select" && statement.columns?.length) {
    columns = [];
    for (const col of statement.columns) {
      const expr = col.expr;

      if (expr.type === "ref" && expr.name === "*") {
        columns = null;
        break;
      }

      if (expr.type === "ref") {
        columns.push({
          name: expr.name,
          alias: col.alias?.name,
        });
        continue;
      }

      columns = null;
      break;
    }
  }

  return {
    table: extractedTable.name,
    schema: extractedTable.schema,
    columns,
  };
}
