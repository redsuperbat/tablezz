use indexmap::IndexMap;
use serde_json::Value as JsonValue;
use sqlx::{migrate::MigrateDatabase, Column, Executor, Pool, Row};
use tauri::{AppHandle, Runtime};

use sqlx::Postgres;

use crate::{error, LastInsertId};

pub enum DbPool {
    Postgres(Pool<Postgres>),
}

// private methods
impl DbPool {
    pub(crate) async fn connect<R: Runtime>(
        conn_url: &str,
        _app: &AppHandle<R>,
    ) -> Result<Self, crate::error::Error> {
        match conn_url
            .split_once(':')
            .ok_or_else(|| crate::error::Error::InvalidDbUrl(conn_url.to_string()))?
            .0
        {
            "postgres" => {
                if !Postgres::database_exists(conn_url).await.unwrap_or(false) {
                    Postgres::create_database(conn_url).await?;
                }
                Ok(Self::Postgres(Pool::connect(conn_url).await?))
            }
            _ => panic!(),
        }
    }

    pub(crate) async fn close(&self) {
        match self {
            DbPool::Postgres(pool) => pool.close().await,
        }
    }

    pub(crate) async fn execute(
        &self,
        _query: String,
        _values: Vec<JsonValue>,
    ) -> Result<(u64, LastInsertId), crate::error::Error> {
        Ok(match self {
            DbPool::Postgres(pool) => {
                let mut query = sqlx::query(&_query);
                for value in _values {
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
                let result = pool.execute(query).await?;
                (result.rows_affected(), LastInsertId::Postgres(()))
            }
        })
    }

    pub(crate) async fn select(
        &self,
        _query: String,
        _values: Vec<JsonValue>,
    ) -> Result<Vec<IndexMap<String, JsonValue>>, error::Error> {
        Ok(match self {
            DbPool::Postgres(pool) => {
                let mut query = sqlx::query(&_query);
                for value in _values {
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

                        let v = crate::decode::postgres::to_json(v)?;

                        value.insert(column.name().to_string(), v);
                    }

                    values.push(value);
                }
                values
            }
        })
    }
}
