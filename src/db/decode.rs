//! Raw database values to JSON, one entry point per adapter. The postgres half
//! is a port of `src-tauri/src/postgres/decode.rs`, unchanged apart from the
//! error type living next door instead of behind an IPC boundary.

use pgvector::Vector;
use serde_json::Value as JsonValue;
use sqlx::{mysql::MySqlValueRef, postgres::PgValueRef, sqlite::SqliteValueRef};
use sqlx::{TypeInfo, Value, ValueRef};
use time::{Date, OffsetDateTime, PrimitiveDateTime, Time};

use super::Error;

/// Decoding has to happen in one expression: the owned value only lives as long
/// as the borrow `try_decode` takes out of it.
macro_rules! decode {
    ($v:expr, $t:ty, $map:expr) => {
        ValueRef::to_owned($v)
            .try_decode::<$t>()
            .map($map)
            .unwrap_or(JsonValue::Null)
    };
}

fn array<T>(items: Vec<T>, map: impl Fn(T) -> JsonValue) -> JsonValue {
    JsonValue::Array(items.into_iter().map(map).collect())
}

pub fn to_json(v: PgValueRef) -> Result<JsonValue, Error> {
    if v.is_null() {
        return Ok(JsonValue::Null);
    }

    let type_info = v.type_info();
    let type_name = type_info.name().to_string();

    // Handle array types (ending with [])
    if let Some(inner_type) = type_name.strip_suffix("[]") {
        return Ok(decode_array(&v, inner_type));
    }

    let res = match type_name.as_str() {
        "CHAR" | "VARCHAR" | "TEXT" | "NAME" => decode!(&v, String, JsonValue::String),
        "FLOAT4" => decode!(&v, f32, JsonValue::from),
        "FLOAT8" => decode!(&v, f64, JsonValue::from),
        "INT2" => decode!(&v, i16, JsonValue::from),
        "INT4" => decode!(&v, i32, JsonValue::from),
        "INT8" => decode!(&v, i64, JsonValue::from),
        "BOOL" => decode!(&v, bool, JsonValue::Bool),
        "UUID" => decode!(&v, sqlx::types::Uuid, |u| JsonValue::String(u.to_string())),
        "DATE" => decode!(&v, Date, |d| JsonValue::String(d.to_string())),
        "TIME" => decode!(&v, Time, |t| JsonValue::String(t.to_string())),
        "TIMESTAMP" => decode!(&v, PrimitiveDateTime, |t| JsonValue::String(t.to_string())),
        "TIMESTAMPTZ" => decode!(&v, OffsetDateTime, |t| JsonValue::String(t.to_string())),
        "JSON" | "JSONB" => ValueRef::to_owned(&v).try_decode().unwrap_or_default(),
        "BYTEA" => decode!(&v, Vec<u8>, |bytes: Vec<u8>| JsonValue::Array(
            bytes.into_iter().map(JsonValue::from).collect()
        )),
        "VOID" => JsonValue::Null,
        "vector" => decode!(&v, Vector, |vec: Vector| {
            let floats = vec.to_vec();
            let preview: Vec<JsonValue> =
                floats.iter().take(5).map(|&f| JsonValue::from(f)).collect();
            serde_json::json!({ "preview": preview, "length": floats.len() })
        }),

        // catch-all for user-defined types (enums, domains, composites, etc.)
        _ => match v.as_bytes() {
            // Try decoding as raw bytes -> string (works for enums)
            Ok(bytes) => match std::str::from_utf8(bytes) {
                Ok(s) => JsonValue::String(s.to_string()),
                Err(_) => JsonValue::Null,
            },
            Err(_) => return Err(Error::UnsupportedDatatype(type_name)),
        },
    };

    Ok(res)
}

pub fn mysql_to_json(v: MySqlValueRef) -> Result<JsonValue, Error> {
    if v.is_null() {
        return Ok(JsonValue::Null);
    }

    let bytes_array =
        |bytes: Vec<u8>| JsonValue::Array(bytes.into_iter().map(JsonValue::from).collect());

    let res = match v.type_info().name() {
        "BOOLEAN" => decode!(&v, bool, JsonValue::Bool),
        "TINYINT" | "SMALLINT" | "MEDIUMINT" | "INT" | "BIGINT" => {
            decode!(&v, i64, JsonValue::from)
        }
        "TINYINT UNSIGNED" | "SMALLINT UNSIGNED" | "MEDIUMINT UNSIGNED" | "INT UNSIGNED"
        | "BIGINT UNSIGNED" => decode!(&v, u64, JsonValue::from),
        "FLOAT" => decode!(&v, f32, JsonValue::from),
        "DOUBLE" => decode!(&v, f64, JsonValue::from),
        "DECIMAL" => decode!(&v, sqlx::types::Decimal, |d| JsonValue::String(
            d.to_string()
        )),
        "CHAR" | "VARCHAR" | "TEXT" | "TINYTEXT" | "MEDIUMTEXT" | "LONGTEXT" | "ENUM" | "SET" => {
            decode!(&v, String, JsonValue::String)
        }
        "DATE" => decode!(&v, Date, |d| JsonValue::String(d.to_string())),
        "TIME" => decode!(&v, Time, |t| JsonValue::String(t.to_string())),
        "DATETIME" => decode!(&v, PrimitiveDateTime, |t| JsonValue::String(t.to_string())),
        "TIMESTAMP" => decode!(&v, OffsetDateTime, |t| JsonValue::String(t.to_string())),
        "JSON" => ValueRef::to_owned(&v).try_decode().unwrap_or_default(),
        "BINARY" | "VARBINARY" | "TINYBLOB" | "BLOB" | "MEDIUMBLOB" | "LONGBLOB" => {
            decode!(&v, Vec<u8>, bytes_array)
        }
        // The macro falls back to Null when the string decode fails too.
        _ => decode!(&v, String, JsonValue::String),
    };

    Ok(res)
}

pub fn sqlite_to_json(v: SqliteValueRef) -> Result<JsonValue, Error> {
    if v.is_null() {
        return Ok(JsonValue::Null);
    }

    let bytes_array =
        |bytes: Vec<u8>| JsonValue::Array(bytes.into_iter().map(JsonValue::from).collect());

    let res = match v.type_info().name() {
        "BOOLEAN" => decode!(&v, bool, JsonValue::Bool),
        "INTEGER" | "BIGINT" | "INT" => decode!(&v, i64, JsonValue::from),
        "REAL" | "NUMERIC" => decode!(&v, f64, JsonValue::from),
        // Sqlite stores dates and times as text; keep them as the stored string.
        "TEXT" | "DATE" | "TIME" | "DATETIME" => decode!(&v, String, JsonValue::String),
        "BLOB" => decode!(&v, Vec<u8>, bytes_array),
        _ => decode!(&v, String, JsonValue::String),
    };

    Ok(res)
}

fn decode_array(v: &PgValueRef<'_>, inner_type: &str) -> JsonValue {
    match inner_type {
        "CHAR" | "VARCHAR" | "TEXT" | "NAME" => {
            decode!(v, Vec<String>, |a: Vec<String>| array(a, JsonValue::String))
        }
        "FLOAT4" => decode!(v, Vec<f32>, |a: Vec<f32>| array(a, JsonValue::from)),
        "FLOAT8" => decode!(v, Vec<f64>, |a: Vec<f64>| array(a, JsonValue::from)),
        "INT2" => decode!(v, Vec<i16>, |a: Vec<i16>| array(a, JsonValue::from)),
        "INT4" => decode!(v, Vec<i32>, |a: Vec<i32>| array(a, JsonValue::from)),
        "INT8" => decode!(v, Vec<i64>, |a: Vec<i64>| array(a, JsonValue::from)),
        "BOOL" => decode!(v, Vec<bool>, |a: Vec<bool>| array(a, JsonValue::Bool)),
        "UUID" => decode!(
            v,
            Vec<sqlx::types::Uuid>,
            |a: Vec<sqlx::types::Uuid>| array(a, |u| JsonValue::String(u.to_string()))
        ),
        _ => JsonValue::Null,
    }
}
