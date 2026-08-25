//! The database layer. [`Database`] is everything the app needs from a
//! database; [`postgres`] is the first adapter. Adding another database means
//! implementing the trait and registering its url scheme in [`SCHEMES`] and
//! [`connect`].

mod decode;
mod postgres;

use async_trait::async_trait;
use indexmap::IndexMap;
use serde_json::Value as JsonValue;
use std::sync::Arc;

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
    pub foreign_key: Option<ForeignKey>,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Sql(#[from] sqlx::Error),
    #[error("unsupported datatype: {0}")]
    UnsupportedDatatype(String),
    #[error("invalid url: {0}")]
    InvalidUrl(String),
    #[error("no adapter for scheme `{0}`")]
    UnsupportedScheme(String),
}

/// One open database connection.
#[async_trait]
pub trait Database: Send + Sync {
    async fn select(&self, query: &str, values: Vec<JsonValue>) -> Result<Vec<JsonRow>, Error>;

    async fn table_structure(
        &self,
        schema: &str,
        table_name: &str,
    ) -> Result<Vec<ColumnInfo>, Error>;

    /// Execute multiple statements in a transaction.
    async fn batch_execute(&self, statements: Vec<String>) -> Result<(), Error>;

    /// Execute a raw SQL string directly, not wrapped in a transaction.
    async fn raw_execute(&self, sql: &str) -> Result<(), Error>;

    /// Tables that reference the given table via foreign keys.
    async fn get_table_references(
        &self,
        schema: &str,
        table_name: &str,
    ) -> Result<Vec<TableReference>, Error>;

    async fn databases(&self) -> Result<Vec<String>, Error>;

    async fn schemas(&self) -> Result<Vec<String>, Error>;

    async fn tables(&self, schema: &str) -> Result<Vec<String>, Error>;

    async fn count(&self, schema: &str, table_name: &str) -> Result<i64, Error>;
}

pub type Connection = Arc<dyn Database>;

/// Url schemes with an adapter behind them.
const SCHEMES: &[&str] = &["postgres", "postgresql"];

pub async fn connect(database_url: &str) -> Result<Connection, Error> {
    let url = url::Url::parse(database_url).map_err(|e| Error::InvalidUrl(e.to_string()))?;

    match url.scheme() {
        "postgres" | "postgresql" => {
            Ok(Arc::new(postgres::Postgres::connect(database_url).await?))
        }
        other => Err(Error::UnsupportedScheme(other.to_string())),
    }
}

/// Split a connection url into the url actually used and the database it points
/// at, defaulting to the `postgres` database — port of
/// `ConnectionCredentialsProvider.tsx`. Also the validation gate before a url
/// is persisted, so it rejects schemes no adapter handles.
pub fn credentials(raw: &str) -> Result<(String, String), String> {
    let mut url = url::Url::parse(raw).map_err(|e| e.to_string())?;

    if !SCHEMES.contains(&url.scheme()) {
        return Err(format!(
            "no adapter for scheme `{}`, expected one of: {}",
            url.scheme(),
            SCHEMES.join(", ")
        ));
    }

    let database = url.path().trim_start_matches('/').to_string();

    if database.is_empty() {
        url.set_path("/postgres");
        return Ok((url.to_string(), "postgres".to_string()));
    }

    Ok((url.to_string(), database))
}
