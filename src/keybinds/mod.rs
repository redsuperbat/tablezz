//! Keybind pipeline: tokenizer -> parser -> checker, plus the stacked registry
//! that used to live in `KeybindProvider.tsx` / `KeybindStack.ts`.

pub mod checker;
pub mod formatter;
pub mod parser;
pub mod tokenizer;

pub use checker::KeyEvent;

use indexmap::IndexMap;
use parser::{KeyExpression, KeybindNode};

/// What a component (or the config file) asks to be bound.
#[derive(Debug, Clone)]
pub struct Keybind {
    pub command: String,
    pub keybind_expression: String,
    /// Whether the keybind should override the input if the focus is in a text
    /// input (the command line prompt or the picker search box).
    pub override_input: bool,
    pub description: Option<String>,
}

impl Keybind {
    pub fn new(command: &str, keybind_expression: &str) -> Self {
        Self {
            command: command.to_string(),
            keybind_expression: keybind_expression.to_string(),
            override_input: false,
            description: None,
        }
    }

    pub fn override_input(mut self) -> Self {
        self.override_input = true;
        self
    }
}

#[derive(Debug, Clone)]
struct RegisteredKeybind {
    command: String,
    override_input: bool,
    ast: KeyExpression,
    description: Option<String>,
}

/// What happened to a key event. `Consumed` is the equivalent of the original
/// calling `preventDefault()` mid sequence: the key belonged to a keybind, so a
/// focused text input must not also see it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KeyOutcome {
    Triggered(String),
    Consumed,
    Ignored,
}

#[derive(Debug, Clone)]
pub struct PotentialKeybind {
    pub bind: String,
    pub command: String,
    pub description: Option<String>,
}

/// Port of `KeybindStack.ts` — one stack per keybind expression, the top of
/// each stack wins so an overlay can shadow a binding while it is open.
#[derive(Default)]
struct KeybindStack {
    stacks: IndexMap<String, Vec<RegisteredKeybind>>,
}

impl KeybindStack {
    fn push(&mut self, keybind_expression: String, item: RegisteredKeybind) {
        self.stacks
            .entry(keybind_expression)
            .or_default()
            .push(item);
    }

    fn remove(&mut self, keybind_expression: &str, command: &str) {
        let Some(stack) = self.stacks.get_mut(keybind_expression) else {
            return;
        };

        let Some(index) = stack.iter().rposition(|k| k.command == command) else {
            return;
        };

        stack.remove(index);

        if stack.is_empty() {
            self.stacks.shift_remove(keybind_expression);
        }
    }

    fn all_tops(&self) -> Vec<RegisteredKeybind> {
        self.stacks
            .values()
            .filter_map(|stack| stack.last().cloned())
            .collect()
    }
}

/// Port of `KeybindProvider.tsx`. Owns the two stacks (config file keybinds take
/// precedence over the ones components register) and the in-flight sequence
/// state for multi-key binds like `g > g`.
pub struct Keybinds {
    config: KeybindStack,
    component: KeybindStack,
    leader_ast: KeybindNode,
    pub potential: Option<Vec<PotentialKeybind>>,
    sequence_index: usize,
    pending: Option<Vec<RegisteredKeybind>>,
}

impl Keybinds {
    pub fn new(leader_key: &str) -> Self {
        Self {
            config: KeybindStack::default(),
            component: KeybindStack::default(),
            leader_ast: parser::parse_keybind(leader_key).unwrap_or(KeybindNode::Key {
                key: "Space".to_string(),
                range: Default::default(),
            }),
            potential: None,
            sequence_index: 0,
            pending: None,
        }
    }

    pub fn set_leader_key(&mut self, leader_key: &str) -> Result<(), String> {
        self.leader_ast = parser::parse_keybind(leader_key)?;
        Ok(())
    }

    fn compile(keybind: &Keybind) -> Result<RegisteredKeybind, String> {
        Ok(RegisteredKeybind {
            command: keybind.command.clone(),
            override_input: keybind.override_input,
            ast: parser::parse_key_expression(&keybind.keybind_expression)?,
            description: keybind.description.clone(),
        })
    }

    pub fn register(&mut self, keybind: &Keybind) -> Result<(), String> {
        let compiled = Self::compile(keybind)?;
        self.component
            .push(normalize(&keybind.keybind_expression), compiled);
        self.reset();
        Ok(())
    }

    pub fn unregister(&mut self, keybind: &Keybind) {
        self.component
            .remove(&normalize(&keybind.keybind_expression), &keybind.command);
        self.reset();
    }

    pub fn register_config(&mut self, keybind: &Keybind) -> Result<(), String> {
        let compiled = Self::compile(keybind)?;
        self.config
            .push(normalize(&keybind.keybind_expression), compiled);
        Ok(())
    }

    pub fn clear_config(&mut self) {
        self.config = KeybindStack::default();
        self.reset();
    }

    /// Every currently active binding, config first — used by the help overlay.
    pub fn all_keybinds(&self) -> Vec<PotentialKeybind> {
        self.component
            .all_tops()
            .into_iter()
            .chain(self.config.all_tops())
            .map(|k| PotentialKeybind {
                bind: formatter::format(&k.ast),
                command: k.command,
                description: k.description,
            })
            .collect()
    }

    fn reset(&mut self) {
        self.sequence_index = 0;
        self.pending = None;
        self.potential = None;
    }

    /// Feed a key event in. Yields the command expression to trigger once a full
    /// keybind (possibly a multi-key sequence) has been matched.
    pub fn handle_key(&mut self, event: &KeyEvent, input_focused: bool) -> KeyOutcome {
        let i = self.sequence_index;

        let candidates = self.pending.take().unwrap_or_else(|| {
            // Config keybinds take precedence, then component keybinds
            let mut all = self.config.all_tops();
            all.extend(self.component.all_tops());
            all
        });

        let mut to_check: Vec<RegisteredKeybind> =
            candidates.into_iter().filter(|k| k.ast.len() > i).collect();

        // Combinations are checked before plain keys so `Control + j` wins over `j`
        to_check.sort_by_key(|k| !k.ast[i].is_combination());

        if to_check.is_empty() {
            self.reset();
            return KeyOutcome::Ignored;
        }

        let checker = checker::Checker::new(event, &self.leader_ast);
        let mut keybind_hit = false;
        let mut new_pending: Vec<RegisteredKeybind> = Vec::new();

        for bind in to_check {
            // If the focus is in a text input we skip triggering the keybind,
            // unless the keybind specifically overrides it
            if input_focused && !bind.override_input {
                continue;
            }

            if !checker.check(&bind.ast[i]) {
                continue;
            }

            keybind_hit = true;

            if bind.ast.len() == i + 1 {
                self.reset();
                return KeyOutcome::Triggered(bind.command);
            }

            new_pending.push(bind);
        }

        if !keybind_hit {
            self.reset();
            return KeyOutcome::Ignored;
        }

        self.sequence_index = i + 1;

        // Show the keys that could come next for the user
        let potentials: Vec<PotentialKeybind> = new_pending
            .iter()
            .filter(|k| k.ast.len() > self.sequence_index)
            .map(|k| PotentialKeybind {
                bind: formatter::format_keybind(&k.ast[self.sequence_index]),
                command: k.command.clone(),
                description: k.description.clone(),
            })
            .collect();

        self.potential = (!potentials.is_empty()).then_some(potentials);
        self.pending = Some(new_pending);

        KeyOutcome::Consumed
    }
}

fn normalize(keybind_expression: &str) -> String {
    keybind_expression.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn triggered(command: &str) -> KeyOutcome {
        KeyOutcome::Triggered(command.to_string())
    }

    fn key(k: &str) -> KeyEvent {
        KeyEvent {
            key: k.to_string(),
            ..Default::default()
        }
    }

    fn keybinds(binds: &[(&str, &str)]) -> Keybinds {
        let mut keybinds = Keybinds::new("Space");
        for (command, expression) in binds {
            keybinds
                .register(&Keybind::new(command, expression))
                .unwrap();
        }
        keybinds
    }

    #[test]
    fn triggers_single_key() {
        let mut k = keybinds(&[("MoveCellDown", "j")]);
        assert_eq!(k.handle_key(&key("j"), false), triggered("MoveCellDown"));
    }

    #[test]
    fn triggers_sequence_only_when_complete() {
        let mut k = keybinds(&[("GoToTop", "g > g")]);
        assert_eq!(k.handle_key(&key("g"), false), KeyOutcome::Consumed);
        assert!(k.potential.is_some());
        assert_eq!(k.handle_key(&key("g"), false), triggered("GoToTop"));
        assert!(k.potential.is_none());
    }

    #[test]
    fn broken_sequence_resets() {
        let mut k = keybinds(&[("GoToTop", "g > g"), ("MoveCellDown", "j")]);
        assert_eq!(k.handle_key(&key("g"), false), KeyOutcome::Consumed);
        assert_eq!(k.handle_key(&key("x"), false), KeyOutcome::Ignored);
        // the sequence state is gone, so `j` fires on its own again
        assert_eq!(k.handle_key(&key("j"), false), triggered("MoveCellDown"));
    }

    #[test]
    fn top_of_stack_shadows_earlier_registration() {
        let mut k = keybinds(&[("PickerClose", "Escape"), ("CommandLineClose", "Escape")]);
        assert_eq!(
            k.handle_key(&key("Escape"), false),
            triggered("CommandLineClose")
        );

        k.unregister(&Keybind::new("CommandLineClose", "Escape"));
        assert_eq!(
            k.handle_key(&key("Escape"), false),
            triggered("PickerClose")
        );
    }

    #[test]
    fn input_focus_only_lets_overriding_binds_through() {
        let mut k = Keybinds::new("Space");
        k.register(&Keybind::new("MoveCellDown", "j")).unwrap();
        k.register(&Keybind::new("CommandAccept", "Enter").override_input())
            .unwrap();

        assert_eq!(k.handle_key(&key("j"), true), KeyOutcome::Ignored);
        assert_eq!(
            k.handle_key(&key("Enter"), true),
            triggered("CommandAccept")
        );
    }

    #[test]
    fn config_keybinds_take_precedence() {
        let mut k = Keybinds::new("Space");
        k.register(&Keybind::new("MoveCellDown", "j")).unwrap();
        k.register_config(&Keybind::new("GoToBottom", "j")).unwrap();

        assert_eq!(k.handle_key(&key("j"), false), triggered("GoToBottom"));
    }
}
