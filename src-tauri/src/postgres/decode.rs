use pgvector::Vector;
use serde_json::Value as JsonValue;
use sqlx::{postgres::PgValueRef, TypeInfo, Value, ValueRef};
use time::{Date, OffsetDateTime, PrimitiveDateTime, Time};

use crate::postgres::Error;

pub fn to_json(v: PgValueRef) -> Result<JsonValue, Error> {
    if v.is_null() {
        return Ok(JsonValue::Null);
    }

    let type_info = v.type_info();
    let type_name = type_info.name();

    // Handle array types (ending with [])
    if let Some(inner_type) = type_name.strip_suffix("[]") {
        return Ok(decode_array(&v, inner_type));
    }

    let res = match type_name {
        "CHAR" | "VARCHAR" | "TEXT" | "NAME" => decode_string(&v),
        "FLOAT4" => decode_f32(&v),
        "FLOAT8" => decode_f64(&v),
        "INT2" => decode_i16(&v),
        "INT4" => decode_i32(&v),
        "INT8" => decode_i64(&v),
        "BOOL" => decode_bool(&v),
        "DATE" => decode_date(&v),
        "TIME" => decode_time(&v),
        "TIMESTAMP" => decode_timestamp(&v),
        "TIMESTAMPTZ" => decode_timestamptz(&v),
        "JSON" | "JSONB" => ValueRef::to_owned(&v).try_decode().unwrap_or_default(),
        "BYTEA" => decode_bytea(&v),
        "VOID" => JsonValue::Null,
        "vector" => decode_vector(&v),

        // catch-all for user-defined types (enums, domains, composites, etc.)
        other => {
            eprintln!("Unknown type: {}", other);
            // Try decoding as raw bytes -> string (works for enums)
            match v.as_bytes() {
                Ok(bytes) => match std::str::from_utf8(bytes) {
                    Ok(s) => JsonValue::String(s.to_string()),
                    Err(_) => JsonValue::Null,
                },
                Err(_) => return Err(Error::UnsupportedDatatype(type_name.to_string())),
            }
        }
    };

    Ok(res)
}

fn decode_array(v: &PgValueRef<'_>, inner_type: &str) -> JsonValue {
    match inner_type {
        "CHAR" | "VARCHAR" | "TEXT" | "NAME" => ValueRef::to_owned(v)
            .try_decode::<Vec<String>>()
            .map(|arr| JsonValue::Array(arr.into_iter().map(JsonValue::String).collect()))
            .unwrap_or(JsonValue::Null),
        "FLOAT4" => ValueRef::to_owned(v)
            .try_decode::<Vec<f32>>()
            .map(|arr| JsonValue::Array(arr.into_iter().map(JsonValue::from).collect()))
            .unwrap_or(JsonValue::Null),
        "FLOAT8" => ValueRef::to_owned(v)
            .try_decode::<Vec<f64>>()
            .map(|arr| JsonValue::Array(arr.into_iter().map(JsonValue::from).collect()))
            .unwrap_or(JsonValue::Null),
        "INT2" => ValueRef::to_owned(v)
            .try_decode::<Vec<i16>>()
            .map(|arr| {
                JsonValue::Array(
                    arr.into_iter()
                        .map(|i| JsonValue::Number(i.into()))
                        .collect(),
                )
            })
            .unwrap_or(JsonValue::Null),
        "INT4" => ValueRef::to_owned(v)
            .try_decode::<Vec<i32>>()
            .map(|arr| {
                JsonValue::Array(
                    arr.into_iter()
                        .map(|i| JsonValue::Number(i.into()))
                        .collect(),
                )
            })
            .unwrap_or(JsonValue::Null),
        "INT8" => ValueRef::to_owned(v)
            .try_decode::<Vec<i64>>()
            .map(|arr| {
                JsonValue::Array(
                    arr.into_iter()
                        .map(|i| JsonValue::Number(i.into()))
                        .collect(),
                )
            })
            .unwrap_or(JsonValue::Null),
        "BOOL" => ValueRef::to_owned(v)
            .try_decode::<Vec<bool>>()
            .map(|arr| JsonValue::Array(arr.into_iter().map(JsonValue::Bool).collect()))
            .unwrap_or(JsonValue::Null),
        "UUID" => ValueRef::to_owned(v)
            .try_decode::<Vec<sqlx::types::Uuid>>()
            .map(|arr| {
                JsonValue::Array(
                    arr.into_iter()
                        .map(|u| JsonValue::String(u.to_string()))
                        .collect(),
                )
            })
            .unwrap_or(JsonValue::Null),
        _ => {
            eprintln!("Unknown array inner type: {}", inner_type);
            JsonValue::Null
        }
    }
}

fn decode_string(v: &PgValueRef<'_>) -> JsonValue {
    ValueRef::to_owned(v)
        .try_decode::<String>()
        .map(JsonValue::String)
        .unwrap_or(JsonValue::Null)
}

fn decode_f32(v: &PgValueRef<'_>) -> JsonValue {
    ValueRef::to_owned(v)
        .try_decode::<f32>()
        .map(JsonValue::from)
        .unwrap_or(JsonValue::Null)
}

fn decode_f64(v: &PgValueRef<'_>) -> JsonValue {
    ValueRef::to_owned(v)
        .try_decode::<f64>()
        .map(JsonValue::from)
        .unwrap_or(JsonValue::Null)
}

fn decode_i16(v: &PgValueRef<'_>) -> JsonValue {
    ValueRef::to_owned(v)
        .try_decode::<i16>()
        .map(|i| JsonValue::Number(i.into()))
        .unwrap_or(JsonValue::Null)
}

fn decode_i32(v: &PgValueRef<'_>) -> JsonValue {
    ValueRef::to_owned(v)
        .try_decode::<i32>()
        .map(|i| JsonValue::Number(i.into()))
        .unwrap_or(JsonValue::Null)
}

fn decode_i64(v: &PgValueRef<'_>) -> JsonValue {
    ValueRef::to_owned(v)
        .try_decode::<i64>()
        .map(|i| JsonValue::Number(i.into()))
        .unwrap_or(JsonValue::Null)
}

fn decode_bool(v: &PgValueRef<'_>) -> JsonValue {
    ValueRef::to_owned(v)
        .try_decode::<bool>()
        .map(JsonValue::Bool)
        .unwrap_or(JsonValue::Null)
}

fn decode_date(v: &PgValueRef<'_>) -> JsonValue {
    ValueRef::to_owned(v)
        .try_decode::<Date>()
        .map(|d| JsonValue::String(d.to_string()))
        .unwrap_or(JsonValue::Null)
}

fn decode_time(v: &PgValueRef<'_>) -> JsonValue {
    ValueRef::to_owned(v)
        .try_decode::<Time>()
        .map(|t| JsonValue::String(t.to_string()))
        .unwrap_or(JsonValue::Null)
}

fn decode_timestamp(v: &PgValueRef<'_>) -> JsonValue {
    ValueRef::to_owned(v)
        .try_decode::<PrimitiveDateTime>()
        .map(|t| JsonValue::String(t.to_string()))
        .unwrap_or(JsonValue::Null)
}

fn decode_timestamptz(v: &PgValueRef<'_>) -> JsonValue {
    ValueRef::to_owned(v)
        .try_decode::<OffsetDateTime>()
        .map(|t| JsonValue::String(t.to_string()))
        .unwrap_or(JsonValue::Null)
}

fn decode_bytea(v: &PgValueRef<'_>) -> JsonValue {
    ValueRef::to_owned(v)
        .try_decode::<Vec<u8>>()
        .map(|bytes| {
            JsonValue::Array(
                bytes
                    .into_iter()
                    .map(|n| JsonValue::Number(n.into()))
                    .collect(),
            )
        })
        .unwrap_or(JsonValue::Null)
}

fn decode_vector(v: &PgValueRef<'_>) -> JsonValue {
    ValueRef::to_owned(v)
        .try_decode::<Vector>()
        .map(|vec| JsonValue::Array(vec.to_vec().into_iter().map(JsonValue::from).collect()))
        .unwrap_or(JsonValue::Null)
}
