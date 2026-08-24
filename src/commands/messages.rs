//! Port of `src/commands/Messages.tsx`. The toast becomes a transient line in
//! the status bar; the history is kept for the `Messages` command.

use std::time::{Duration, Instant};

const TOAST_DURATION: Duration = Duration::from_secs(10);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageType {
    Info,
    Error,
}

impl MessageType {
    pub fn as_str(&self) -> &'static str {
        match self {
            MessageType::Info => "info",
            MessageType::Error => "error",
        }
    }
}

#[derive(Debug, Clone)]
pub struct StoredMessage {
    pub kind: MessageType,
    pub text: String,
    pub timestamp: time::OffsetDateTime,
}

#[derive(Default)]
pub struct Messages {
    history: Vec<StoredMessage>,
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
        self.history.push(StoredMessage {
            kind,
            text: text.clone(),
            timestamp: now(),
        });
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

    pub fn history(&self) -> &[StoredMessage] {
        &self.history
    }

    pub fn clear_history(&mut self) {
        self.history.clear();
    }
}

fn now() -> time::OffsetDateTime {
    time::OffsetDateTime::now_local().unwrap_or_else(|_| time::OffsetDateTime::now_utc())
}
