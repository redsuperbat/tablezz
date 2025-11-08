use serde_json::Value as JsonValue;
use sqlx::{postgres::PgValueRef, TypeInfo, Value, ValueRef};
use time::{Date, OffsetDateTime, PrimitiveDateTime, Time};

use crate::postgres::Error;

pub fn to_json(v: PgValueRef) -> Result<JsonValue, Error> {
    if v.is_null() {
        return Ok(JsonValue::Null);
    }

    let type_info = v.type_info();

    let res = match type_info.name() {
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

        // catch-all for user-defined types (enums, domains, composites, etc.)
        _ => {
            // Try decoding as raw bytes -> string (works for enums)
            match v.as_bytes() {
                Ok(bytes) => match std::str::from_utf8(bytes) {
                    Ok(s) => JsonValue::String(s.to_string()),
                    Err(_) => JsonValue::Null,
                },
                Err(_) => return Err(Error::UnsupportedDatatype(type_info.name().to_string())),
            }
        }
    };

    Ok(res)
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
