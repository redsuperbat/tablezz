//! Port of `src/keybinds/KeybindChecker.ts`.

use super::parser::{KeybindNode, Modifier};

/// Mirrors the browser `KeyboardEvent` shape the original checker consumed, so
/// keybind expressions written for the Tauri build keep working. `key` is the
/// produced character / named key, `code` the physical key name.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct KeyEvent {
    pub meta_key: bool,
    pub alt_key: bool,
    pub ctrl_key: bool,
    pub key: String,
    pub code: String,
}

pub struct Checker<'a> {
    event: &'a KeyEvent,
    leader_key_ast: &'a KeybindNode,
}

impl<'a> Checker<'a> {
    pub fn new(event: &'a KeyEvent, leader_key_ast: &'a KeybindNode) -> Self {
        Self {
            event,
            leader_key_ast,
        }
    }

    pub fn check(&self, node: &KeybindNode) -> bool {
        match node {
            KeybindNode::Key { key, .. } => self.check_key(key),
            KeybindNode::Combination { left, right, .. } => {
                let modifier_held = match left {
                    Modifier::Meta => self.event.meta_key,
                    Modifier::Alt => self.event.alt_key,
                    Modifier::Ctrl => self.event.ctrl_key,
                };
                modifier_held && self.check(right)
            }
            KeybindNode::Leader { .. } => self.check(self.leader_key_ast),
            KeybindNode::Or { left, right, .. } => self.check(left) || self.check(right),
        }
    }

    fn check_key(&self, key: &str) -> bool {
        key == self.event.key || key == self.event.code
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keybinds::parser::{parse_key_expression, parse_keybind};

    fn check(expr: &str, event: KeyEvent) -> bool {
        let leader = parse_keybind("Space").unwrap();
        let checker = Checker::new(&event, &leader);
        parse_key_expression(expr)
            .unwrap()
            .iter()
            .all(|node| checker.check(node))
    }

    fn key(k: &str) -> KeyEvent {
        KeyEvent {
            key: k.to_string(),
            ..Default::default()
        }
    }

    #[test]
    fn or_statements() {
        assert!(check(
            "(Control + k) | (Meta + j)",
            KeyEvent {
                ctrl_key: true,
                ..key("k")
            }
        ));
    }

    #[test]
    fn multi_combination() {
        assert!(check(
            "Control + Meta + s",
            KeyEvent {
                ctrl_key: true,
                meta_key: true,
                ..key("s")
            }
        ));
    }

    #[test]
    fn modifier_must_be_held() {
        assert!(!check("Control + k", key("k")));
    }

    #[test]
    fn leader_resolves_to_its_expression() {
        assert!(check(
            "Leader",
            KeyEvent {
                key: " ".to_string(),
                code: "Space".to_string(),
                ..Default::default()
            }
        ));
    }
}
