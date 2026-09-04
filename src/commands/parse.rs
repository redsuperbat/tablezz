use std::collections::HashMap;

pub type CommandVariables = HashMap<char, String>;

/// Expand single character variables (`%`, `&`, `@`) in a command expression.
/// A backslash escapes a variable character.
pub fn expand_variables(input: &str, variables: &CommandVariables) -> String {
    let chars: Vec<char> = input.chars().collect();
    let mut result = String::new();
    let mut i = 0;

    while i < chars.len() {
        let char = chars[i];

        // Handle escape sequences
        if char == '\\' && i + 1 < chars.len() {
            let next_char = chars[i + 1];
            if variables.contains_key(&next_char) {
                // Escaped variable character, output literally
                result.push(next_char);
                i += 2;
                continue;
            }
        }

        if let Some(value) = variables.get(&char) {
            result.push_str(value);
            i += 1;
            continue;
        }

        result.push(char);
        i += 1;
    }

    result
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedCommand {
    pub command_name: String,
    pub args: Vec<String>,
}

/// Split a command line into `|` separated commands, honouring quotes and
/// backslash escapes.
pub fn parse_command(input: &str) -> Vec<ParsedCommand> {
    let mut parts: Vec<Vec<String>> = vec![Vec::new()];
    let mut current = String::new();
    let mut in_quotes: Option<char> = None;
    let mut escape_next = false;

    for char in input.chars() {
        if escape_next {
            current.push(char);
            escape_next = false;
        } else if char == '\\' {
            escape_next = true;
        } else if char == '"' || char == '\'' || char == '`' {
            match in_quotes {
                Some(open) if open == char => in_quotes = None,
                None => in_quotes = Some(char),
                Some(_) => current.push(char),
            }
        } else if char == '|' && in_quotes.is_none() {
            push_current(&mut parts, &mut current);
            parts.push(Vec::new());
        } else if char == ' ' && in_quotes.is_none() {
            push_current(&mut parts, &mut current);
        } else {
            current.push(char);
        }
    }

    push_current(&mut parts, &mut current);

    parts
        .into_iter()
        .filter_map(|part| {
            let mut iter = part.into_iter();
            let command_name = iter.next()?;
            Some(ParsedCommand {
                command_name,
                args: iter.collect(),
            })
        })
        .collect()
}

fn push_current(parts: &mut [Vec<String>], current: &mut String) {
    if !current.is_empty() {
        if let Some(last) = parts.last_mut() {
            last.push(std::mem::take(current));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_args_and_keeps_quoted_groups() {
        let parsed = parse_command(r#"Command arg1 "arg 2" "arg with many things""#);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].command_name, "Command");
        assert_eq!(
            parsed[0].args,
            vec!["arg1", "arg 2", "arg with many things"]
        );
    }

    #[test]
    fn splits_piped_commands() {
        let parsed = parse_command("MoveCellDown 3 | WriteChanges");
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].args, vec!["3"]);
        assert_eq!(parsed[1].command_name, "WriteChanges");
    }

    #[test]
    fn a_pipe_inside_quotes_is_literal() {
        let parsed = parse_command(r#"SqlSelect "select 1 | 2""#);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].args, vec!["select 1 | 2"]);
    }

    #[test]
    fn expands_and_escapes_variables() {
        let vars = CommandVariables::from([('%', "\"users\"".to_string())]);
        assert_eq!(
            expand_variables("SqlExecute select * from %", &vars),
            "SqlExecute select * from \"users\""
        );
        assert_eq!(expand_variables("literal \\%", &vars), "literal %");
    }
}
