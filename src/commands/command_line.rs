//! Port of the input half of `src/commands/CommandLine.tsx`. The `:` prompt.

use super::Commands;
use std::collections::HashMap;

#[derive(Default)]
pub struct CommandLine {
    input: Vec<char>,
    cursor: usize,
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
    }

    pub fn set(&mut self, value: &str) {
        self.input = value.chars().collect();
        self.cursor = self.input.len();
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
