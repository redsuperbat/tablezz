//! The SQLite adapter. Schemas map to sqlite's attached databases (usually
//! just `main`), and table metadata comes from the pragma table-valued
//! functions instead of a catalog.

use async_trait::async_trait;
use serde_json::Value as JsonValue;
use sqlx::{sqlite::SqlitePool, Column, Executor, Row};

use super::{decode, ColumnInfo, Database, Error, ForeignKey, JsonRow, TableReference};

pub struct Sqlite(SqlitePool);

impl Sqlite {
    pub async fn connect(database_url: &str) -> Result<Self, Error> {
        Ok(Self(SqlitePool::connect(database_url).await?))
    }
}

#[async_trait]
impl Database for Sqlite {
    fn default_schema(&self) -> String {
        "main".to_string()
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

        let rows = self.0.fetch_all(query).await?;
        let mut values = Vec::new();

        for row in rows {
            let mut value = JsonRow::default();
            for (i, column) in row.columns().iter().enumerate() {
                let raw = row.try_get_raw(i)?;
                value.insert(column.name().to_string(), decode::sqlite_to_json(raw)?);
            }
            values.push(value);
        }

        Ok(values)
    }

    async fn table_structure(
        &self,
        _schema: &str,
        table_name: &str,
    ) -> Result<Vec<ColumnInfo>, Error> {
        let columns = sqlx::query(r#"SELECT name, type, "notnull", pk FROM pragma_table_info(?)"#)
            .bind(table_name)
            .fetch_all(&self.0)
            .await?;

        let foreign_keys =
            sqlx::query(r#"SELECT "from", "table", "to" FROM pragma_foreign_key_list(?)"#)
                .bind(table_name)
                .fetch_all(&self.0)
                .await?;

        Ok(columns
            .iter()
            .map(|row| {
                let name: String = row.get("name");
                let foreign_key = foreign_keys
                    .iter()
                    .find(|fk| fk.get::<String, _>("from") == name)
                    .and_then(|fk| {
                        // A NULL "to" means the foreign key points at the
                        // target's implicit primary key.
                        let column: Option<String> = fk.get("to");
                        Some(ForeignKey {
                            table: fk.get("table"),
                            column: column?,
                        })
                    });

                ColumnInfo {
                    data_type: row.get("type"),
                    is_primary: row.get::<i64, _>("pk") > 0,
                    is_nullable: row.get::<i64, _>("notnull") == 0,
                    column_name: name,
                    foreign_key,
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
        _schema: &str,
        table_name: &str,
    ) -> Result<Vec<TableReference>, Error> {
        let rows = sqlx::query(
            r#"
            SELECT
                m.name AS source_table,
                fk."from" AS source_column,
                fk."to" AS target_column
            FROM sqlite_master m
            JOIN pragma_foreign_key_list(m.name) fk
            WHERE m.type = 'table'
              AND fk."table" = ?
              AND fk."to" IS NOT NULL
            "#,
        )
        .bind(table_name)
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
        let rows = sqlx::query("SELECT name FROM pragma_database_list ORDER BY name")
            .fetch_all(&self.0)
            .await?;

        Ok(rows.iter().map(|r| r.get("name")).collect())
    }

    // Sqlite's equivalent of schemas is the list of attached databases.
    async fn schemas(&self) -> Result<Vec<String>, Error> {
        self.databases().await
    }

    async fn tables(&self, schema: &str) -> Result<Vec<String>, Error> {
        let rows = sqlx::query(&format!(
            r#"
            SELECT name
            FROM "{schema}".sqlite_master
            WHERE type = 'table'
              AND name NOT LIKE 'sqlite_%'
            ORDER BY name
            "#
        ))
        .fetch_all(&self.0)
        .await?;

        Ok(rows.iter().map(|r| r.get("name")).collect())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn the_whole_trait_works_against_a_real_database() {
        let db = Sqlite::connect("sqlite::memory:").await.unwrap();

        db.batch_execute(vec![
            "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, height REAL)".into(),
            "CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id))"
                .into(),
            "INSERT INTO users (name, height) VALUES ('ada', 1.7), ('grace', NULL)".into(),
        ])
        .await
        .unwrap();

        assert_eq!(db.default_schema(), "main");
        assert_eq!(db.schemas().await.unwrap(), vec!["main"]);
        assert_eq!(db.tables("main").await.unwrap(), vec!["orders", "users"]);
        assert_eq!(db.count("main", "users").await.unwrap(), 2);

        let rows = db
            .select("SELECT * FROM users ORDER BY id", Vec::new())
            .await
            .unwrap();
        assert_eq!(rows[0]["name"], "ada");
        assert_eq!(rows[0]["height"], 1.7);
        assert_eq!(rows[1]["height"], JsonValue::Null);

        let structure = db.table_structure("main", "users").await.unwrap();
        assert_eq!(structure[0].column_name, "id");
        assert!(structure[0].is_primary);
        assert!(!structure[1].is_nullable);

        let references = db.get_table_references("main", "users").await.unwrap();
        assert_eq!(references.len(), 1);
        assert_eq!(references[0].source_table, "orders");
        assert_eq!(references[0].source_column, "user_id");
        assert_eq!(references[0].target_column, "id");

        db.raw_execute("DELETE FROM users WHERE name = 'grace'")
            .await
            .unwrap();
        assert_eq!(db.count("main", "users").await.unwrap(), 1);
    }
}
