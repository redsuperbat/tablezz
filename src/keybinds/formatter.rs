//! Port of `src/keybinds/KeybindFormatter.ts`.

use super::parser::{KeyExpression, KeybindNode, Modifier};

pub fn format(key_expression: &KeyExpression) -> String {
    key_expression
        .iter()
        .map(format_keybind)
        .collect::<Vec<_>>()
        .join(" > ")
}

pub fn format_keybind(node: &KeybindNode) -> String {
    match node {
        KeybindNode::Key { key, .. } => key.clone(),
        KeybindNode::Leader { .. } => "Leader".to_string(),
        KeybindNode::Or { left, right, .. } => {
            format!("{} | {}", format_keybind(left), format_keybind(right))
        }
        KeybindNode::Combination { left, right, .. } => {
            let modifier = match left {
                Modifier::Meta => "Meta",
                Modifier::Alt => "Alt",
                Modifier::Ctrl => "Control",
            };
            format!("{modifier} + {}", format_keybind(right))
        }
    }
}
