//! The MySQL adapter, which also covers MariaDB — sqlx's mysql driver speaks
//! the MariaDB wire protocol, it just insists on the `mysql://` scheme.

use async_trait::async_trait;
use serde_json::Value as JsonValue;
use sqlx::{mysql::MySqlPool, Column, Executor, Row};

use super::{decode, ColumnInfo, Database, Error, ForeignKey, JsonRow, TableReference};

pub struct MySql {
    pool: MySqlPool,
    /// The database named in the connection url, doubling as the default
    /// schema — in MySQL the two are the same thing.
    database: String,
}

impl MySql {
    pub async fn connect(database_url: &str) -> Result<Self, Error> {
        let url = database_url.replacen("mariadb://", "mysql://", 1);
        let database = url::Url::parse(&url)
            .map_err(|e| Error::InvalidUrl(e.to_string()))?
            .path()
            .trim_start_matches('/')
            .to_string();

        Ok(Self {
            pool: MySqlPool::connect(&url).await?,
            database,
        })
    }
}

#[async_trait]
impl Database for MySql {
    fn default_schema(&self) -> String {
        self.database.clone()
    }

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

        let rows = self.pool.fetch_all(query).await?;
        let mut values = Vec::new();

        for row in rows {
            let mut value = JsonRow::default();
            for (i, column) in row.columns().iter().enumerate() {
                let raw = row.try_get_raw(i)?;
                value.insert(column.name().to_string(), decode::mysql_to_json(raw)?);
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
                c.COLUMN_NAME AS column_name,
                c.COLUMN_TYPE AS data_type,
                c.COLUMN_KEY AS column_key,
                c.IS_NULLABLE AS is_nullable,
                kcu.REFERENCED_TABLE_NAME AS foreign_table_name,
                kcu.REFERENCED_COLUMN_NAME AS foreign_column_name
            FROM information_schema.COLUMNS c
            LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu
                ON kcu.TABLE_SCHEMA = c.TABLE_SCHEMA
               AND kcu.TABLE_NAME = c.TABLE_NAME
               AND kcu.COLUMN_NAME = c.COLUMN_NAME
               AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
            WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
            ORDER BY c.ORDINAL_POSITION
            "#,
        )
        .bind(schema)
        .bind(table_name)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .iter()
            .map(|row| {
                let column_key: String = row.get("column_key");
                let is_nullable: String = row.get("is_nullable");
                let foreign_table_name: Option<String> = row.get("foreign_table_name");
                let foreign_column_name: Option<String> = row.get("foreign_column_name");

                ColumnInfo {
                    column_name: row.get("column_name"),
                    data_type: row.get("data_type"),
                    is_primary: column_key == "PRI",
                    is_nullable: is_nullable == "YES",
                    foreign_key: foreign_table_name
                        .zip(foreign_column_name)
                        .map(|(table, column)| ForeignKey { table, column }),
                }
            })
            .collect())
    }

    async fn batch_execute(&self, statements: Vec<String>) -> Result<(), Error> {
        let mut tx = self.pool.begin().await?;

        for statement in statements {
            sqlx::query(&statement).execute(&mut *tx).await?;
        }

        tx.commit().await?;
        Ok(())
    }

    async fn raw_execute(&self, sql: &str) -> Result<(), Error> {
        sqlx::query(sql).execute(&self.pool).await?;
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
                TABLE_NAME AS source_table,
                COLUMN_NAME AS source_column,
                REFERENCED_COLUMN_NAME AS target_column
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME = ?
            "#,
        )
        .bind(schema)
        .bind(table_name)
        .fetch_all(&self.pool)
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
            "SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.iter().map(|r| r.get("name")).collect())
    }

    // In MySQL a schema and a database are the same thing.
    async fn schemas(&self) -> Result<Vec<String>, Error> {
        self.databases().await
    }

    async fn tables(&self, schema: &str) -> Result<Vec<String>, Error> {
        let rows = sqlx::query(
            r#"
            SELECT TABLE_NAME AS name
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ?
              AND TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
            "#,
        )
        .bind(schema)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.iter().map(|r| r.get("name")).collect())
    }

    async fn count(&self, schema: &str, table_name: &str) -> Result<i64, Error> {
        let row = sqlx::query(&format!(
            "SELECT COUNT(*) AS count FROM `{schema}`.`{table_name}`"
        ))
        .fetch_one(&self.pool)
        .await?;

        Ok(row.get("count"))
    }
}
