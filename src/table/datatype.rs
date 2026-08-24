//! Port of `src/table/DataType.tsx`. Lucide icons become one character glyphs.

use serde_json::Value as JsonValue;

pub trait DataType {
    fn to_display(&self, data: &JsonValue) -> String;
    fn from_string(&self, value: &str) -> Result<JsonValue, String>;
    fn to_sql_value(&self, data: &JsonValue) -> Result<String, String>;

    fn icon(&self) -> Option<char> {
        None
    }

    fn file_extension(&self) -> &'static str {
        ".txt"
    }
}

/// `String(data)` semantics: a JSON string renders without its quotes.
fn plain(data: &JsonValue) -> String {
    match data {
        JsonValue::String(s) => s.clone(),
        other => other.to_string(),
    }
}

fn quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

struct JsonDataType;

impl DataType for JsonDataType {
    fn to_display(&self, data: &JsonValue) -> String {
        data.to_string()
    }

    fn from_string(&self, value: &str) -> Result<JsonValue, String> {
        serde_json::from_str(value).map_err(|e| e.to_string())
    }

    fn to_sql_value(&self, data: &JsonValue) -> Result<String, String> {
        Ok(quote(&data.to_string()))
    }

    fn icon(&self) -> Option<char> {
        Some('{')
    }

    fn file_extension(&self) -> &'static str {
        ".json"
    }
}

struct ArrayDataType(Box<dyn DataType>);

impl DataType for ArrayDataType {
    fn to_display(&self, data: &JsonValue) -> String {
        let Some(items) = data.as_array() else {
            return plain(data);
        };

        let inner: Vec<String> = items.iter().map(|d| self.0.to_display(d)).collect();
        format!("{{{}}}", inner.join(","))
    }

    fn from_string(&self, value: &str) -> Result<JsonValue, String> {
        let value = value.trim();

        if !value.starts_with('{') || !value.ends_with('}') {
            return Err("Malformed array data, must start and end with {}".to_string());
        }

        let inner = &value[1..value.len() - 1];
        if inner.is_empty() {
            return Ok(JsonValue::Array(Vec::new()));
        }

        inner
            .split(',')
            .map(|v| self.0.from_string(v.trim()))
            .collect::<Result<Vec<_>, _>>()
            .map(JsonValue::Array)
    }

    fn to_sql_value(&self, data: &JsonValue) -> Result<String, String> {
        let items = data.as_array().ok_or("Expected array data")?;
        let inner = items
            .iter()
            .map(|d| self.0.to_sql_value(d))
            .collect::<Result<Vec<_>, _>>()?;

        Ok(format!("ARRAY[{}]", inner.join(",")))
    }

    fn icon(&self) -> Option<char> {
        Some('[')
    }
}

struct WithNull(Box<dyn DataType>);

impl DataType for WithNull {
    fn to_display(&self, data: &JsonValue) -> String {
        if data.is_null() {
            return "null".to_string();
        }
        self.0.to_display(data)
    }

    fn from_string(&self, value: &str) -> Result<JsonValue, String> {
        if value == "null" {
            return Ok(JsonValue::Null);
        }
        self.0.from_string(value)
    }

    fn to_sql_value(&self, data: &JsonValue) -> Result<String, String> {
        if data.is_null() {
            return Ok("null".to_string());
        }
        self.0.to_sql_value(data)
    }

    fn icon(&self) -> Option<char> {
        self.0.icon()
    }

    fn file_extension(&self) -> &'static str {
        self.0.file_extension()
    }
}

struct NumberDataType;

impl DataType for NumberDataType {
    fn to_display(&self, data: &JsonValue) -> String {
        plain(data)
    }

    fn from_string(&self, value: &str) -> Result<JsonValue, String> {
        value
            .trim()
            .parse::<f64>()
            .map_err(|e| e.to_string())
            .and_then(|n| {
                serde_json::Number::from_f64(n)
                    .map(JsonValue::Number)
                    .ok_or_else(|| "not a finite number".to_string())
            })
    }

    fn to_sql_value(&self, data: &JsonValue) -> Result<String, String> {
        if !data.is_number() {
            return Err(format!("Number data type was not of type number: {data}"));
        }
        Ok(data.to_string())
    }

    fn icon(&self) -> Option<char> {
        Some('#')
    }
}

struct TextDataType {
    icon: char,
}

impl DataType for TextDataType {
    fn to_display(&self, data: &JsonValue) -> String {
        plain(data)
    }

    fn from_string(&self, value: &str) -> Result<JsonValue, String> {
        Ok(JsonValue::String(value.to_string()))
    }

    fn to_sql_value(&self, data: &JsonValue) -> Result<String, String> {
        let value = data
            .as_str()
            .ok_or_else(|| format!("Value is not string: {data}"))?;
        Ok(quote(value))
    }

    fn icon(&self) -> Option<char> {
        Some(self.icon)
    }
}

struct VectorDataType;

impl DataType for VectorDataType {
    fn to_display(&self, data: &JsonValue) -> String {
        let preview = data.get("preview").and_then(|p| p.as_array());
        let length = data.get("length").and_then(|l| l.as_u64());

        match (preview, length) {
            (Some(preview), Some(length)) => {
                let items: Vec<String> = preview.iter().map(|v| v.to_string()).collect();
                format!("[{}] ({length})", items.join(", "))
            }
            _ => plain(data),
        }
    }

    fn from_string(&self, _value: &str) -> Result<JsonValue, String> {
        Err("Editing vector data is not supported".to_string())
    }

    fn to_sql_value(&self, _data: &JsonValue) -> Result<String, String> {
        Err("Editing vector data is not supported".to_string())
    }

    fn icon(&self) -> Option<char> {
        Some('~')
    }
}

struct DefaultDataType {
    icon: Option<char>,
}

impl DataType for DefaultDataType {
    fn to_display(&self, data: &JsonValue) -> String {
        plain(data)
    }

    fn from_string(&self, value: &str) -> Result<JsonValue, String> {
        Ok(JsonValue::String(value.to_string()))
    }

    fn to_sql_value(&self, data: &JsonValue) -> Result<String, String> {
        Ok(plain(data))
    }

    fn icon(&self) -> Option<char> {
        self.icon
    }
}

/// Strip a `(...)` precision suffix, so `character varying(255)` and
/// `timestamp(3) with time zone` match their base type.
fn strip_precision(data_type: &str) -> String {
    let Some(open) = data_type.find('(') else {
        return data_type.to_string();
    };
    let Some(close) = data_type[open..].find(')').map(|i| i + open) else {
        return data_type.to_string();
    };

    format!("{}{}", &data_type[..open], &data_type[close + 1..])
        .trim()
        .to_string()
}

pub fn create_data_type(data_type: &str, is_nullable: bool) -> Box<dyn DataType> {
    let inner: Box<dyn DataType> = if let Some(element) = data_type.strip_suffix("[]") {
        // We cannot have nullable elements in arrays
        Box::new(ArrayDataType(create_data_type(element, false)))
    } else {
        let base = strip_precision(data_type);

        match base.as_str() {
            "date"
            | "time"
            | "time with time zone"
            | "time without time zone"
            | "timestamp"
            | "timestamp with time zone"
            | "timestamp without time zone" => Box::new(TextDataType { icon: 't' }),

            "json" | "jsonb" => Box::new(JsonDataType),

            "uuid" | "text" | "varchar" | "character varying" | "char" | "character" | "citext"
            | "name" => Box::new(TextDataType { icon: 'a' }),

            "decimal" | "integer" | "numeric" | "bigint" | "smallint" | "real"
            | "double precision" => Box::new(NumberDataType),

            "vector" => Box::new(VectorDataType),
            "boolean" => Box::new(DefaultDataType { icon: Some('b') }),

            _ => Box::new(DefaultDataType { icon: None }),
        }
    };

    if is_nullable {
        return Box::new(WithNull(inner));
    }

    inner
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn nullable_types_round_trip_null() {
        let t = create_data_type("text", true);
        assert_eq!(t.to_display(&JsonValue::Null), "null");
        assert_eq!(t.to_sql_value(&JsonValue::Null).unwrap(), "null");
        assert_eq!(t.from_string("null").unwrap(), JsonValue::Null);
    }

    #[test]
    fn text_values_are_quote_escaped() {
        let t = create_data_type("text", false);
        assert_eq!(t.to_sql_value(&json!("o'brien")).unwrap(), "'o''brien'");
    }

    #[test]
    fn arrays_use_postgres_literal_syntax() {
        let t = create_data_type("integer[]", false);
        assert_eq!(t.to_display(&json!([1, 2, 3])), "{1,2,3}");
        assert_eq!(t.to_sql_value(&json!([1, 2])).unwrap(), "ARRAY[1,2]");
        assert_eq!(t.from_string("{1, 2}").unwrap(), json!([1.0, 2.0]));
    }

    #[test]
    fn precision_suffixes_resolve_to_the_base_type() {
        assert_eq!(
            strip_precision("character varying(255)"),
            "character varying"
        );
        assert_eq!(
            strip_precision("timestamp(3) with time zone"),
            "timestamp with time zone"
        );
        assert_eq!(
            create_data_type("character varying(255)", false).icon(),
            Some('a')
        );
        assert_eq!(
            create_data_type("timestamp(3) with time zone", false).icon(),
            Some('t')
        );
    }

    #[test]
    fn display_never_panics_on_a_mismatched_value() {
        // the decoder can hand us a string where the catalog promised a number
        let t = create_data_type("integer", false);
        assert_eq!(t.to_display(&json!("12")), "12");
        assert!(t.to_sql_value(&json!("12")).is_err());
    }
}
