//! Replaces the `makePersisted` / localStorage usage: hop stack, saved
//! connection urls and command history, kept in `~/tablezz/state.json`.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Port of the `Hop` in `src/HopContext.ts`. Scroll offsets are in rows and
/// columns rather than pixels.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hop {
    pub query: String,
    #[serde(default)]
    pub row_index: usize,
    #[serde(default)]
    pub column_index: usize,
    #[serde(default)]
    pub scroll_x: usize,
    #[serde(default)]
    pub scroll_y: usize,
}

impl Hop {
    pub fn new(query: String) -> Self {
        Self {
            query,
            row_index: 0,
            column_index: 0,
            scroll_x: 0,
            scroll_y: 0,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct PersistedState {
    pub database_url: Option<String>,
    pub saved_urls: Vec<String>,
    pub schema: Option<String>,
    pub hops: Vec<Hop>,
    pub command_history: Vec<String>,
}

pub fn state_path() -> PathBuf {
    crate::config::tablezz_dir().join("state.json")
}

impl PersistedState {
    pub fn load() -> Self {
        std::fs::read_to_string(state_path())
            .ok()
            .and_then(|contents| serde_json::from_str(&contents).ok())
            .unwrap_or_default()
    }

    pub fn save(&self) {
        let path = state_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(contents) = serde_json::to_string_pretty(self) {
            let _ = std::fs::write(path, contents);
        }
    }

    // --- hop stack (port of HopContext.ts) ---

    pub fn current_hop(&self) -> Option<&Hop> {
        self.hops.last()
    }

    pub fn current_hop_mut(&mut self) -> Option<&mut Hop> {
        self.hops.last_mut()
    }

    pub fn add_hop(&mut self, query: String) {
        self.hops.push(Hop::new(query));
    }

    pub fn pop_hop(&mut self) {
        if self.hops.len() == 1 {
            return;
        }
        self.hops.pop();
    }

    pub fn clear_hops(&mut self) {
        self.hops.clear();
    }
}
