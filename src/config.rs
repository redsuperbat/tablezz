//! Port of `src/config/configuration.ts` + `ConfigurationService.ts` +
//! `ConfigurationProvider.tsx`. Same file, same shape: `~/tablezz/config.json`,
//! watched and hot reloaded.

use indexmap::IndexMap;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use schemars::JsonSchema;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::sync::mpsc::UnboundedSender;

use crate::keybinds::parser;

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(untagged)]
pub enum KeybindEntry {
    Simple(String),
    Full {
        command: String,
        #[serde(default)]
        description: Option<String>,
    },
}

impl KeybindEntry {
    pub fn command(&self) -> &str {
        match self {
            KeybindEntry::Simple(command) => command,
            KeybindEntry::Full { command, .. } => command,
        }
    }

    pub fn description(&self) -> Option<&str> {
        match self {
            KeybindEntry::Simple(_) => None,
            KeybindEntry::Full { description, .. } => description.as_deref(),
        }
    }
}

/// All configuration options to configure Tablezz.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", default)]
pub struct Configuration {
    /// The leader key, e.g. "Space" or "Control + a".
    pub leader_key: String,
    /// Custom keybinds which trigger predefined commands.
    pub keybinds: IndexMap<String, KeybindEntry>,
    /// Aliases for long named commands, e.g. { "w": "WriteChanges" }.
    pub command_aliases: HashMap<String, String>,
    /// The terminal editor invoked when editing cells.
    pub editor: String,
}

impl Default for Configuration {
    fn default() -> Self {
        Self {
            leader_key: "Space".to_string(),
            keybinds: IndexMap::new(),
            command_aliases: HashMap::new(),
            editor: "nvim".to_string(),
        }
    }
}

impl Configuration {
    fn validate(&self) -> Result<(), String> {
        let ast = parser::parse_keybind(&self.leader_key)
            .map_err(|e| format!("invalid leaderKey: {e}"))?;

        if matches!(ast, parser::KeybindNode::Leader { .. }) {
            return Err("Leader key can not be self referential".to_string());
        }

        for expression in self.keybinds.keys() {
            parser::parse_key_expression(expression)
                .map_err(|e| format!("invalid keybind \"{expression}\": {e}"))?;
        }

        Ok(())
    }
}

/// `~/tablezz`, overridable with `TABLEZZ_HOME`.
pub fn tablezz_dir() -> PathBuf {
    match std::env::var_os("TABLEZZ_HOME") {
        Some(dir) => PathBuf::from(dir),
        None => dirs::home_dir().unwrap_or_default().join("tablezz"),
    }
}

pub fn config_path() -> PathBuf {
    tablezz_dir().join("config.json")
}

/// Load the configuration, falling back to the default on any problem. The
/// second element is a message to surface to the user.
pub fn load() -> (Configuration, Option<String>) {
    let path = config_path();

    let Ok(contents) = std::fs::read_to_string(&path) else {
        return (Configuration::default(), None);
    };

    let config: Configuration = match serde_json::from_str(&contents) {
        Ok(config) => config,
        Err(error) => {
            return (
                Configuration::default(),
                Some(format!("Configuration error: {error}")),
            )
        }
    };

    if let Err(error) = config.validate() {
        return (
            Configuration::default(),
            Some(format!("Configuration error: {error}")),
        );
    }

    (config, None)
}

/// Watch the config file and notify on change. The returned watcher must be
/// kept alive.
pub fn watch(tx: UnboundedSender<crate::app::Msg>) -> Option<RecommendedWatcher> {
    let path = config_path();
    let directory = path.parent()?.to_path_buf();
    let filename = path.file_name()?.to_os_string();

    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        let Ok(event) = event else { return };

        // Editors write config.json atomically, so watch the directory and
        // filter instead of watching the file itself.
        if event.paths.iter().any(|p| p.file_name() == Some(&filename)) {
            let _ = tx.send(crate::app::Msg::ConfigChanged);
        }
    })
    .ok()?;

    std::fs::create_dir_all(&directory).ok()?;
    watcher
        .watch(&directory, RecursiveMode::NonRecursive)
        .ok()?;

    Some(watcher)
}
