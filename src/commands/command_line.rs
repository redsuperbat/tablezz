use super::Commands;
use std::collections::HashMap;

#[derive(Default)]
pub struct CommandLine {
    input: Vec<char>,
    cursor: usize,
    /// What the history is being filtered by, once history navigation starts.
    history_search: Option<String>,
    history_index: usize,
}

impl CommandLine {
    pub fn value(&self) -> String {
        self.input.iter().collect()
    }

    pub fn cursor(&self) -> usize {
        self.cursor
    }

    pub fn insert(&mut self, char: char) {
        self.input.insert(self.cursor, char);
        self.cursor += 1;
        self.history_search = None;
    }

    pub fn backspace(&mut self) {
        if self.cursor == 0 {
            return;
        }
        self.cursor -= 1;
        self.input.remove(self.cursor);
    }

    pub fn delete(&mut self) {
        if self.cursor < self.input.len() {
            self.input.remove(self.cursor);
        }
    }

    pub fn clear(&mut self) {
        self.input.clear();
        self.cursor = 0;
        self.history_search = None;
    }

    pub fn set(&mut self, value: &str) {
        self.input = value.chars().collect();
        self.cursor = self.input.len();
    }

    /// The query the history is being filtered by, for highlighting.
    pub fn history_search(&self) -> Option<&str> {
        self.history_search.as_deref()
    }

    fn filtered_history<'a>(&self, history: &'a [String]) -> Vec<&'a String> {
        match self.history_search.as_deref() {
            None | Some("") => history.iter().collect(),
            Some(query) => {
                let query = query.to_lowercase();
                history
                    .iter()
                    .filter(|entry| entry.to_lowercase().contains(&query))
                    .collect()
            }
        }
    }

    /// Port of `navigateHistory`: the first press starts a search from whatever
    /// is typed, later presses walk the matches.
    pub fn navigate_history(&mut self, history: &[String], backwards: bool) {
        if self.history_search.is_none() {
            self.history_search = Some(self.value());
            self.history_index = 0;

            if backwards {
                if let Some(entry) = self.filtered_history(history).first() {
                    let entry = entry.to_string();
                    self.set_keeping_search(&entry);
                }
            }
            return;
        }

        let max = self.filtered_history(history).len().saturating_sub(1);
        self.history_index = match backwards {
            true => (self.history_index + 1).min(max),
            false => self.history_index.saturating_sub(1),
        };

        if let Some(entry) = self.filtered_history(history).get(self.history_index) {
            let entry = entry.to_string();
            self.set_keeping_search(&entry);
        }
    }

    fn set_keeping_search(&mut self, value: &str) {
        let search = self.history_search.take();
        self.set(value);
        self.history_search = search;
    }

    pub fn move_left(&mut self) {
        self.cursor = self.cursor.saturating_sub(1);
    }

    pub fn move_right(&mut self) {
        self.cursor = (self.cursor + 1).min(self.input.len());
    }

    pub fn move_home(&mut self) {
        self.cursor = 0;
    }

    pub fn move_end(&mut self) {
        self.cursor = self.input.len();
    }

    /// The greyed out completion shown behind the cursor: the first matching
    /// command name plus its argument titles.
    pub fn ghost_text(
        &self,
        commands: &Commands,
        aliases: &HashMap<String, String>,
    ) -> Option<String> {
        let value = self.value();
        let typed = value.trim();

        if typed.is_empty() {
            return None;
        }

        let (name, command) = commands
            .all(aliases)
            .into_iter()
            .find(|(name, _)| name.starts_with(typed))?;

        let hint = command.args_hint();
        let full = if hint.is_empty() {
            name
        } else {
            format!("{name} {hint}")
        };

        Some(full.chars().skip(value.chars().count()).collect())
    }

    /// Command names matching what has been typed so far.
    pub fn matches(&self, commands: &Commands, aliases: &HashMap<String, String>) -> Vec<String> {
        let value = self.value();
        commands
            .all(aliases)
            .into_iter()
            .map(|(name, _)| name)
            .filter(|name| name.starts_with(&value))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn history() -> Vec<String> {
        vec![
            "SqlSelect select 1".to_string(),
            "WriteChanges".to_string(),
            "SqlExecute vacuum".to_string(),
        ]
    }

    #[test]
    fn first_press_filters_by_what_was_typed() {
        let mut line = CommandLine::default();
        line.set("Sql");
        line.navigate_history(&history(), true);

        assert_eq!(line.value(), "SqlSelect select 1");
        assert_eq!(line.history_search(), Some("Sql"));

        line.navigate_history(&history(), true);
        assert_eq!(line.value(), "SqlExecute vacuum", "skips the non match");

        line.navigate_history(&history(), false);
        assert_eq!(line.value(), "SqlSelect select 1");
    }

    #[test]
    fn walking_stops_at_the_ends() {
        let mut line = CommandLine::default();
        line.navigate_history(&history(), true);
        for _ in 0..5 {
            line.navigate_history(&history(), true);
        }
        assert_eq!(line.value(), "SqlExecute vacuum", "last entry");

        for _ in 0..5 {
            line.navigate_history(&history(), false);
        }
        assert_eq!(line.value(), "SqlSelect select 1", "first entry");
    }

    #[test]
    fn typing_ends_the_history_search() {
        let mut line = CommandLine::default();
        line.navigate_history(&history(), true);
        assert!(line.history_search().is_some());

        line.insert('x');
        assert!(line.history_search().is_none());
    }
}
