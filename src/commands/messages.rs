//! Port of `src/commands/Messages.tsx`. The toast becomes a transient line in
//! the status bar.

use std::time::{Duration, Instant};

const TOAST_DURATION: Duration = Duration::from_secs(10);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageType {
    Info,
    Error,
}

#[derive(Default)]
pub struct Messages {
    history: Vec<String>,
    current: Option<(MessageType, String, Instant)>,
}

impl Messages {
    pub fn info(&mut self, text: impl Into<String>) {
        self.show(MessageType::Info, text.into());
    }

    pub fn error(&mut self, text: impl Into<String>) {
        self.show(MessageType::Error, text.into());
    }

    fn show(&mut self, kind: MessageType, text: String) {
        self.history.push(text.clone());
        self.current = Some((kind, text, Instant::now()));
    }

    pub fn clear(&mut self) {
        self.current = None;
    }

    /// The message currently worth showing, if it has not expired yet.
    pub fn current(&self) -> Option<(MessageType, &str)> {
        self.current
            .as_ref()
            .filter(|(_, _, at)| at.elapsed() < TOAST_DURATION)
            .map(|(kind, text, _)| (*kind, text.as_str()))
    }

    /// Everything ever shown, kept for the tests to observe.
    #[cfg(test)]
    pub fn history(&self) -> &[String] {
        &self.history
    }
}
