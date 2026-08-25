//! The PostgreSQL adapter — port of `src-tauri/src/postgres/mod.rs`.

use async_trait::async_trait;
use serde_json::Value as JsonValue;
use sqlx::{Column, Executor, PgPool, Row};

use super::{decode, ColumnInfo, Database, Error, ForeignKey, JsonRow, TableReference};

pub struct Postgres(PgPool);

impl Postgres {
    pub async fn connect(database_url: &str) -> Result<Self, Error> {
        Ok(Self(PgPool::connect(database_url).await?))
    }
}

#[async_trait]
impl Database for Postgres {
    async fn select(&self, query: &str, values: Vec<JsonValue>) -> Result<Vec<JsonRow>, Error> {
        let mut query = sqlx::query(query);

        for value in values {
            if value.is_null() {
                query = query.bind(None::<JsonValue>);
            } else if let Some(string) = value.as_str() {
                query = query.bind(string.to_owned());
            } else if let Some(number) = value.as_f64() {
                query = query.bind(number);
            } else {
                query = query.bind(value);
            }
        }

        let rows = self.0.fetch_all(query).await?;
        let mut values = Vec::new();

        for row in rows {
            let mut value = JsonRow::default();
            for (i, column) in row.columns().iter().enumerate() {
                let raw = row.try_get_raw(i)?;
                value.insert(column.name().to_string(), decode::to_json(raw)?);
            }
            values.push(value);
        }

        Ok(values)
    }

    async fn table_structure(
        &self,
        schema: &str,
        table_name: &str,
    ) -> Result<Vec<ColumnInfo>, Error> {
        let rows = sqlx::query(
            r#"
            SELECT
                a.attname AS column_name,
                format_type(a.atttypid, a.atttypmod) AS data_type,
                COALESCE(
                    (SELECT true FROM pg_constraint c
                     WHERE c.conrelid = a.attrelid
                     AND a.attnum = ANY(c.conkey)
                     AND c.contype = 'p'),
                    false
                ) AS is_primary,
                NOT a.attnotnull AS is_nullable,
                (SELECT fc.relname FROM pg_constraint con
                 JOIN pg_class fc ON fc.oid = con.confrelid
                 WHERE con.conrelid = a.attrelid
                 AND a.attnum = ANY(con.conkey)
                 AND con.contype = 'f'
                 LIMIT 1
                ) AS foreign_table_name,
                (SELECT fa.attname FROM pg_constraint con
                 JOIN pg_attribute fa ON fa.attrelid = con.confrelid
                   AND fa.attnum = con.confkey[array_position(con.conkey, a.attnum)]
                 WHERE con.conrelid = a.attrelid
                 AND a.attnum = ANY(con.conkey)
                 AND con.contype = 'f'
                 LIMIT 1
                ) AS foreign_column_name
            FROM pg_attribute a
            JOIN pg_class c ON a.attrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE c.relname = $1
              AND n.nspname = $2
              AND a.attnum > 0
              AND NOT a.attisdropped
            ORDER BY a.attnum
            "#,
        )
        .bind(table_name)
        .bind(schema)
        .fetch_all(&self.0)
        .await?;

        Ok(rows
            .iter()
            .map(|row| {
                let foreign_table_name: Option<String> = row.get("foreign_table_name");
                let foreign_column_name: Option<String> = row.get("foreign_column_name");

                ColumnInfo {
                    column_name: row.get("column_name"),
                    data_type: row.get("data_type"),
                    is_primary: row.get("is_primary"),
                    is_nullable: row.get("is_nullable"),
                    foreign_key: foreign_table_name
                        .zip(foreign_column_name)
                        .map(|(table, column)| ForeignKey { table, column }),
                }
            })
            .collect())
    }

    async fn batch_execute(&self, statements: Vec<String>) -> Result<(), Error> {
        let mut tx = self.0.begin().await?;

        for statement in statements {
            sqlx::query(&statement).execute(&mut *tx).await?;
        }

        tx.commit().await?;
        Ok(())
    }

    async fn raw_execute(&self, sql: &str) -> Result<(), Error> {
        sqlx::query(sql).execute(&self.0).await?;
        Ok(())
    }

    async fn get_table_references(
        &self,
        schema: &str,
        table_name: &str,
    ) -> Result<Vec<TableReference>, Error> {
        let rows = sqlx::query(
            r#"
            SELECT
                source_table.relname AS source_table,
                source_attr.attname AS source_column,
                target_attr.attname AS target_column
            FROM pg_constraint con
            JOIN pg_class source_table ON source_table.oid = con.conrelid
            JOIN pg_class target_table ON target_table.oid = con.confrelid
            JOIN pg_namespace n ON target_table.relnamespace = n.oid
            CROSS JOIN LATERAL unnest(con.conkey, con.confkey) AS cols(source_attnum, target_attnum)
            JOIN pg_attribute source_attr ON source_attr.attrelid = con.conrelid
                AND source_attr.attnum = cols.source_attnum
            JOIN pg_attribute target_attr ON target_attr.attrelid = con.confrelid
                AND target_attr.attnum = cols.target_attnum
            WHERE target_table.relname = $1
              AND n.nspname = $2
              AND con.contype = 'f'
            "#,
        )
        .bind(table_name)
        .bind(schema)
        .fetch_all(&self.0)
        .await?;

        Ok(rows
            .iter()
            .map(|row| TableReference {
                source_table: row.get("source_table"),
                source_column: row.get("source_column"),
                target_column: row.get("target_column"),
            })
            .collect())
    }

    async fn databases(&self) -> Result<Vec<String>, Error> {
        let rows = sqlx::query(
            "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
        )
        .fetch_all(&self.0)
        .await?;

        Ok(rows.iter().map(|r| r.get("datname")).collect())
    }

    async fn schemas(&self) -> Result<Vec<String>, Error> {
        let rows =
            sqlx::query("SELECT schema_name FROM information_schema.schemata ORDER BY schema_name")
                .fetch_all(&self.0)
                .await?;

        Ok(rows.iter().map(|r| r.get("schema_name")).collect())
    }

    async fn tables(&self, schema: &str) -> Result<Vec<String>, Error> {
        let rows = sqlx::query(
            r#"
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
            "#,
        )
        .bind(schema)
        .fetch_all(&self.0)
        .await?;

        Ok(rows.iter().map(|r| r.get("table_name")).collect())
    }

    async fn count(&self, schema: &str, table_name: &str) -> Result<i64, Error> {
        let row = sqlx::query(&format!(
            r#"SELECT COUNT(*) AS count FROM "{schema}"."{table_name}""#
        ))
        .fetch_one(&self.0)
        .await?;

        Ok(row.get("count"))
    }
}
