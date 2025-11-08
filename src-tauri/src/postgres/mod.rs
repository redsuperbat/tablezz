use indexmap::IndexMap;
use serde::Serialize;
use serde::Serializer;
use serde_json::Value as JsonValue;
use sqlx::Executor;
use sqlx::Pool;
use sqlx::{Column, Postgres, Row};
use tauri::Manager;
use tauri::{
    command, plugin::Builder as PluginBuilder, plugin::TauriPlugin, RunEvent, Runtime, State,
};
use tokio::sync::RwLock;

mod decode;

use std::collections::HashMap;

use crate::postgres;

#[derive(Default)]
pub struct DbInstances(pub RwLock<HashMap<String, Pool<Postgres>>>);

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Sql(#[from] sqlx::Error),
    #[error(transparent)]
    Migration(#[from] sqlx::migrate::MigrateError),
    #[error("invalid connection url: {0}")]
    InvalidDbUrl(String),
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

#[derive(Serialize)]
pub enum LastInsertId {
    Postgres(()),
}

#[command]
pub async fn load(db_instances: State<'_, DbInstances>, db: String) -> Result<String, Error> {
    let pool = Pool::connect(&db).await?;

    db_instances.0.write().await.insert(db.clone(), pool);

    Ok(db)
}

/// Allows the database connection(s) to be closed; if no database
/// name is passed in then _all_ database connection pools will be
/// shut down.
#[command]
pub async fn close(
    db_instances: State<'_, DbInstances>,
    db: Option<String>,
) -> Result<bool, Error> {
    let instances = db_instances.0.read().await;

    let pools = if let Some(db) = db {
        vec![db]
    } else {
        instances.keys().cloned().collect()
    };

    for pool in pools {
        let db = instances.get(&pool).ok_or(Error::DatabaseNotLoaded(pool))?;
        db.close().await;
    }

    Ok(true)
}

/// Execute a command against the database
#[command]
pub async fn execute(
    db_instances: State<'_, DbInstances>,
    db: String,
    query: String,
    values: Vec<JsonValue>,
) -> Result<(u64, LastInsertId), Error> {
    let instances = db_instances.0.read().await;

    let pool = instances.get(&db).ok_or(Error::DatabaseNotLoaded(db))?;
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

    let result = pool.execute(query).await?;
    Ok((result.rows_affected(), LastInsertId::Postgres(())))
}

#[command]
pub async fn select(
    db_instances: State<'_, DbInstances>,
    db: String,
    query: String,
    values: Vec<JsonValue>,
) -> Result<Vec<IndexMap<String, JsonValue>>, Error> {
    let instances = db_instances.0.read().await;

    let pool = instances.get(&db).ok_or(Error::DatabaseNotLoaded(db))?;

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

pub struct Builder {}

impl Builder {
    pub fn new() -> Self {
        Self {}
    }

    pub fn build<R: Runtime>(self) -> TauriPlugin<R> {
        PluginBuilder::new("sql")
            .invoke_handler(tauri::generate_handler![load, execute, select, close])
            .setup(|app, _| {
                let instances = DbInstances::default();
                app.manage(instances);
                Ok(())
            })
            .on_event(|app, event| {
                if let RunEvent::Exit = event {
                    tauri::async_runtime::block_on(async move {
                        let instances = &*app.state::<DbInstances>();
                        let instances = instances.0.read().await;
                        for value in instances.values() {
                            value.close().await;
                        }
                    });
                }
            })
            .build()
    }
}
