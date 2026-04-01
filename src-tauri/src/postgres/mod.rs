use indexmap::IndexMap;
use serde::Serialize;
use serde::Serializer;
use serde_json::Value as JsonValue;
use sqlx::Executor;
use sqlx::Pool;
use sqlx::{Column, Postgres, Row};
use tauri::Manager;
use tauri::{command, App, Runtime, State};
use tokio::sync::RwLock;

mod decode;

use std::collections::HashMap;

use crate::postgres;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKey {
    pub table: String,
    pub column: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableReference {
    pub source_table: String,
    pub source_column: String,
    pub target_column: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub column_name: String,
    pub data_type: String,
    pub is_primary: bool,
    pub is_nullable: bool,
    pub column_default: Option<String>,
    pub foreign_key: Option<ForeignKey>,
}

#[derive(Default)]
pub struct DbInstances(pub RwLock<HashMap<String, Pool<Postgres>>>);

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Sql(#[from] sqlx::Error),
    #[error("database {0} not loaded")]
    DatabaseNotLoaded(String),
    #[error("unsupported datatype: {0}")]
    UnsupportedDatatype(String),
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[command]
pub async fn load(
    db_instances: State<'_, DbInstances>,
    database_url: String,
) -> Result<String, Error> {
    let pool = Pool::connect(&database_url).await?;

    db_instances
        .0
        .write()
        .await
        .insert(database_url.clone(), pool);

    Ok(database_url)
}

#[command]
pub async fn select(
    db_instances: State<'_, DbInstances>,
    database_url: String,
    query: String,
    values: Vec<JsonValue>,
) -> Result<Vec<IndexMap<String, JsonValue>>, Error> {
    let instances = db_instances.0.read().await;

    let pool = instances
        .get(&database_url)
        .ok_or(Error::DatabaseNotLoaded(database_url))?;

    let mut query = sqlx::query(&query);

    for value in values {
        if value.is_null() {
            query = query.bind(None::<JsonValue>);
        } else if value.is_string() {
            query = query.bind(value.as_str().unwrap().to_owned())
        } else if let Some(number) = value.as_number() {
            query = query.bind(number.as_f64().unwrap_or_default())
        } else {
            query = query.bind(value);
        }
    }

    let rows = pool.fetch_all(query).await?;
    let mut values = Vec::new();

    for row in rows {
        let mut value = IndexMap::default();
        for (i, column) in row.columns().iter().enumerate() {
            let v = row.try_get_raw(i)?;

            let v = postgres::decode::to_json(v)?;

            value.insert(column.name().to_string(), v);
        }

        values.push(value);
    }

    Ok(values)
}

#[command]
pub async fn table_structure(
    db_instances: State<'_, DbInstances>,
    database_url: String,
    schema: String,
    table_name: String,
) -> Result<Vec<ColumnInfo>, Error> {
    let instances = db_instances.0.read().await;
    let pool = instances
        .get(&database_url)
        .ok_or(Error::DatabaseNotLoaded(database_url))?;

    // Query using format_type() to get proper type names like "integer[]" instead of "ARRAY"
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
    .bind(&table_name)
    .bind(&schema)
    .fetch_all(pool)
    .await?;

    let columns: Vec<ColumnInfo> = rows
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
        .collect();

    Ok(columns)
}

/// Execute multiple statements in a single transaction
#[command]
pub async fn batch_execute(
    db_instances: State<'_, DbInstances>,
    database_url: String,
    statements: Vec<String>,
) -> Result<(), Error> {
    let instances = db_instances.0.read().await;
    let pool = instances
        .get(&database_url)
        .ok_or(Error::DatabaseNotLoaded(database_url))?;

    let mut tx = pool.begin().await?;

    for statement in statements {
        sqlx::query(&statement).execute(&mut *tx).await?;
    }

    tx.commit().await?;

    Ok(())
}

/// Get tables that reference the given table via foreign keys
#[command]
pub async fn get_table_references(
    db_instances: State<'_, DbInstances>,
    database_url: String,
    schema: String,
    table_name: String,
) -> Result<Vec<TableReference>, Error> {
    let instances = db_instances.0.read().await;
    let pool = instances
        .get(&database_url)
        .ok_or(Error::DatabaseNotLoaded(database_url))?;

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
    .bind(&table_name)
    .bind(&schema)
    .fetch_all(pool)
    .await?;

    let references: Vec<TableReference> = rows
        .iter()
        .map(|row| TableReference {
            source_table: row.get("source_table"),
            source_column: row.get("source_column"),
            target_column: row.get("target_column"),
        })
        .collect();

    Ok(references)
}

/// Initialize database state - call from setup
pub fn init<R: Runtime>(app: &App<R>) {
    app.manage(DbInstances::default());
}

/// Cleanup connections on app exit
pub async fn cleanup(db_instances: &DbInstances) {
    let instances = db_instances.0.read().await;
    for value in instances.values() {
        value.close().await;
    }
}
