//! Port of `src/lib/extractTablesFromSql.ts`, using `sqlparser` in place of
//! `pgsql-ast-parser`.

use sqlparser::ast::{Expr, SelectItem, SetExpr, Statement, TableFactor};
use sqlparser::dialect::PostgreSqlDialect;
use sqlparser::parser::Parser;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExtractedColumn {
    pub name: String,
    pub alias: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExtractedTable {
    pub table: String,
    pub schema: Option<String>,
    /// `None` means "infer from the data" — a `SELECT *` or an expression the
    /// column list could not be resolved from.
    pub columns: Option<Vec<ExtractedColumn>>,
}

pub fn extract_table_from_sql(sql: &str) -> Option<ExtractedTable> {
    let statements = Parser::parse_sql(&PostgreSqlDialect {}, sql).ok()?;
    let statement = statements.into_iter().next()?;

    let Statement::Query(query) = statement else {
        return None;
    };

    let SetExpr::Select(select) = *query.body else {
        return None;
    };

    let relation = select.from.first().map(|from| &from.relation)?;

    let TableFactor::Table { name, .. } = relation else {
        return None;
    };

    // `.value` rather than `.to_string()`: hop queries are fully quoted,
    // and the quotes must not become part of the identifier.
    let mut parts = name
        .0
        .iter()
        .map(|part| part.value.clone())
        .collect::<Vec<_>>();
    let table = parts.pop()?;
    let schema = parts.pop();

    let mut columns = Some(Vec::new());
    for item in &select.projection {
        let (expr, alias) = match item {
            SelectItem::UnnamedExpr(expr) => (expr, None),
            SelectItem::ExprWithAlias { expr, alias } => (expr, Some(alias.value.clone())),
            _ => {
                columns = None;
                break;
            }
        };

        let Expr::Identifier(ident) = expr else {
            columns = None;
            break;
        };

        if let Some(columns) = columns.as_mut() {
            columns.push(ExtractedColumn {
                name: ident.value.clone(),
                alias,
            });
        }
    }

    Some(ExtractedTable {
        table,
        schema,
        columns: columns.filter(|c| !c.is_empty()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn select_star_infers_columns_from_data() {
        let extracted =
            extract_table_from_sql(r#"SELECT * FROM "public"."users" LIMIT 100"#).unwrap();
        assert_eq!(extracted.table, "users");
        assert_eq!(extracted.schema.as_deref(), Some("public"));
        assert_eq!(extracted.columns, None);
    }

    #[test]
    fn explicit_columns_are_extracted() {
        let extracted = extract_table_from_sql("SELECT id, name AS who FROM users").unwrap();
        assert_eq!(extracted.table, "users");
        assert_eq!(extracted.schema, None);
        assert_eq!(
            extracted.columns.unwrap(),
            vec![
                ExtractedColumn {
                    name: "id".into(),
                    alias: None
                },
                ExtractedColumn {
                    name: "name".into(),
                    alias: Some("who".into())
                },
            ]
        );
    }

    #[test]
    fn expressions_fall_back_to_inference() {
        let extracted = extract_table_from_sql("SELECT count(*) FROM users").unwrap();
        assert_eq!(extracted.columns, None);
    }

    #[test]
    fn unparseable_sql_is_not_a_table() {
        assert!(extract_table_from_sql("not sql at all ((").is_none());
    }
}
