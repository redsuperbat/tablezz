//! Ask mode: turn a question into SQL with a language model, given the shape of the
//! connected database.

use genai::chat::{ChatMessage, ChatRequest};
use genai::Client;

use crate::db::Connection;

const SYSTEM: &str = "You translate questions into SQL for a table viewer. \
You are given the database dialect, the current schema and its tables with their columns. \
Reply with only the SQL, no explanation and no markdown: exactly one read-only SELECT statement that answers the question, \
valid for the given dialect, using only the tables and columns listed. \
Its result is shown to the user as a table.";

/// Describe the database the way the model is prompted with it.
pub async fn describe(db: &Connection, dialect: &str, schema: &str) -> Result<String, String> {
    let mut out = format!("Dialect: {dialect}\nSchema: {schema}\n\nTables:\n");

    // ponytail: one structure query per table on every ask, cache it if large schemas get slow
    for table in db.tables(schema).await.map_err(|e| e.to_string())? {
        let columns = db
            .table_structure(schema, &table)
            .await
            .map_err(|e| e.to_string())?;

        let columns: Vec<String> = columns
            .iter()
            .map(|c| {
                let mut column = format!("{} {}", c.column_name, c.data_type);
                if c.is_primary {
                    column.push_str(" primary key");
                }
                if !c.is_nullable {
                    column.push_str(" not null");
                }
                if let Some(fk) = &c.foreign_key {
                    column.push_str(&format!(" references {}({})", fk.table, fk.column));
                }
                column
            })
            .collect();

        out.push_str(&format!("- {table}({})\n", columns.join(", ")));
    }

    Ok(out)
}

/// The provider is picked from the model name ("claude-*", "gpt-*", "gemini-*",
/// "groq::...", anything else goes to Ollama), each reading its usual api key
/// variable such as `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`.
pub async fn generate_sql(model: &str, database: &str, question: &str) -> Result<String, String> {
    let request = ChatRequest::new(vec![
        ChatMessage::system(SYSTEM),
        ChatMessage::user(format!("{database}\nQuestion: {question}")),
    ]);

    let response = Client::default()
        .exec_chat(model, request, None)
        .await
        .map_err(|e| e.to_string())?;

    parse_sql(response.first_text().unwrap_or_default())
}

/// Models like to wrap code in a markdown fence even when told not to.
fn parse_sql(text: &str) -> Result<String, String> {
    let text = text.trim();
    let sql = match text.strip_prefix("```") {
        Some(fenced) => fenced
            .split_once('\n')
            .map_or("", |(_language, rest)| rest)
            .trim_end()
            .trim_end_matches("```"),
        None => text,
    }
    .trim();

    match sql.is_empty() {
        true => Err("The model returned no SQL".to_string()),
        false => Ok(sql.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_a_markdown_fence() {
        assert_eq!(parse_sql("SELECT 1;").unwrap(), "SELECT 1;");
        assert_eq!(parse_sql("```sql\nSELECT 1;\n```").unwrap(), "SELECT 1;");
        assert_eq!(parse_sql("```\nSELECT 1;```").unwrap(), "SELECT 1;");
        assert!(parse_sql("  ").is_err());
    }
}
