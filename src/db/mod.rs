//! Port of `src-tauri/src/postgres/mod.rs` plus the thin wrapper that used to be
//! `src/database/database.ts`. The Tauri IPC boundary is gone — the queries run
//! in process, so this is the whole database layer.

mod decode;

use indexmap::IndexMap;
use serde_json::Value as JsonValue;
use sqlx::{Column, Executor, PgPool, Row};

pub type JsonRow = IndexMap<String, JsonValue>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ForeignKey {
    pub table: String,
    pub column: String,
}

#[derive(Debug, Clone)]
pub struct TableReference {
    pub source_table: String,
    pub source_column: String,
    pub target_column: String,
}

#[derive(Debug, Clone)]
pub struct ColumnInfo {
    pub column_name: String,
    pub data_type: String,
    pub is_primary: bool,
    pub is_nullable: bool,
    pub column_default: Option<String>,
    pub foreign_key: Option<ForeignKey>,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Sql(#[from] sqlx::Error),
    #[error("unsupported datatype: {0}")]
    UnsupportedDatatype(String),
}

/// Split a connection url into the url actually used and the database it points
/// at, defaulting to the `postgres` database — port of
/// `ConnectionCredentialsProvider.tsx`.
pub fn credentials(raw: &str) -> Result<(String, String), String> {
    let mut url = url::Url::parse(raw).map_err(|e| e.to_string())?;
    let database = url.path().trim_start_matches('/').to_string();

    if database.is_empty() {
        url.set_path("/postgres");
        return Ok((url.to_string(), "postgres".to_string()));
    }

    Ok((url.to_string(), database))
}

pub async fn connect(database_url: &str) -> Result<PgPool, Error> {
    Ok(PgPool::connect(database_url).await?)
}

pub async fn select(
    pool: &PgPool,
    query: &str,
    values: Vec<JsonValue>,
) -> Result<Vec<JsonRow>, Error> {
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

    let rows = pool.fetch_all(query).await?;
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

pub async fn table_structure(
    pool: &PgPool,
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
            pg_get_expr(d.adbin, d.adrelid) AS column_default,
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
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE c.relname = $1
          AND n.nspname = $2
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attnum
        "#,
    )
    .bind(table_name)
    .bind(schema)
    .fetch_all(pool)
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
                column_default: row.get("column_default"),
                foreign_key: foreign_table_name
                    .zip(foreign_column_name)
                    .map(|(table, column)| ForeignKey { table, column }),
            }
        })
        .collect())
}

/// Execute multiple statements in a transaction.
pub async fn batch_execute(pool: &PgPool, statements: Vec<String>) -> Result<(), Error> {
    let mut tx = pool.begin().await?;

    for statement in statements {
        sqlx::query(&statement).execute(&mut *tx).await?;
    }

    tx.commit().await?;
    Ok(())
}

/// Execute a raw SQL string directly, not wrapped in a transaction.
pub async fn raw_execute(pool: &PgPool, sql: &str) -> Result<(), Error> {
    sqlx::query(sql).execute(pool).await?;
    Ok(())
}

/// Tables that reference the given table via foreign keys.
pub async fn get_table_references(
    pool: &PgPool,
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
    .fetch_all(pool)
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

// --- the queries the data hooks used to build (useDatabases, useSelectedSchemaTables, ...) ---

pub async fn databases(pool: &PgPool) -> Result<Vec<String>, Error> {
    let rows =
        sqlx::query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname")
            .fetch_all(pool)
            .await?;

    Ok(rows.iter().map(|r| r.get("datname")).collect())
}

pub async fn schemas(pool: &PgPool) -> Result<Vec<String>, Error> {
    let rows =
        sqlx::query("SELECT schema_name FROM information_schema.schemata ORDER BY schema_name")
            .fetch_all(pool)
            .await?;

    Ok(rows.iter().map(|r| r.get("schema_name")).collect())
}

pub async fn tables(pool: &PgPool, schema: &str) -> Result<Vec<String>, Error> {
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
    .fetch_all(pool)
    .await?;

    Ok(rows.iter().map(|r| r.get("table_name")).collect())
}

pub async fn count(pool: &PgPool, schema: &str, table_name: &str) -> Result<i64, Error> {
    let row = sqlx::query(&format!(
        r#"SELECT COUNT(*) AS count FROM "{schema}"."{table_name}""#
    ))
    .fetch_one(pool)
    .await?;

    Ok(row.get("count"))
}
