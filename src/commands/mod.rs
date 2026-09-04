//! only way UI actions happen: keybinds trigger commands, the command line
//! triggers commands.

pub mod builtin;
pub mod command_line;
pub mod messages;
pub mod parse;

use indexmap::IndexMap;
use std::collections::HashMap;

use crate::app::App;

/// Replaces the `actionArgs: ZodType[]` contract. Each spec knows how to parse
/// one positional argument and how to render itself in the command line ghost
/// text (`title`).
#[derive(Debug, Clone)]
pub struct ArgSpec {
    pub title: String,
    pub kind: ArgKind,
    pub optional: bool,
    pub default: Option<String>,
}

#[derive(Debug, Clone)]
pub enum ArgKind {
    Str { min_len: usize },
    Num,
    Url,
    Enum(&'static [&'static str]),
}

impl ArgSpec {
    pub fn string(title: &str) -> Self {
        Self::of(title, ArgKind::Str { min_len: 1 })
    }

    pub fn number(title: &str) -> Self {
        Self::of(title, ArgKind::Num)
    }

    pub fn url(title: &str) -> Self {
        Self::of(title, ArgKind::Url)
    }

    pub fn one_of(title: &str, variants: &'static [&'static str]) -> Self {
        Self::of(title, ArgKind::Enum(variants))
    }

    fn of(title: &str, kind: ArgKind) -> Self {
        Self {
            title: title.to_string(),
            kind,
            optional: false,
            default: None,
        }
    }

    pub fn optional(mut self) -> Self {
        self.optional = true;
        self
    }

    pub fn with_default(mut self, default: &str) -> Self {
        self.default = Some(default.to_string());
        self.optional = true;
        self
    }

    fn parse(&self, raw: Option<&str>) -> Result<ArgValue, String> {
        let raw = match (raw, self.default.as_deref()) {
            (Some(raw), _) => raw,
            (None, Some(default)) => default,
            (None, None) if self.optional => return Ok(ArgValue::None),
            (None, None) => return Err(self.failure("expected a value")),
        };

        match &self.kind {
            ArgKind::Str { min_len } => {
                if raw.chars().count() < *min_len {
                    return Err(self.failure(&format!(
                        "too small: expected at least {min_len} characters"
                    )));
                }
                Ok(ArgValue::Str(raw.to_string()))
            }
            ArgKind::Num => raw
                .trim()
                .parse::<f64>()
                .map(ArgValue::Num)
                .map_err(|_| self.failure("expected a number")),
            ArgKind::Url => {
                if raw.contains("://") && !raw.ends_with("://") {
                    Ok(ArgValue::Str(raw.to_string()))
                } else {
                    Err(self.failure("expected a url"))
                }
            }
            ArgKind::Enum(variants) => {
                if variants.contains(&raw) {
                    Ok(ArgValue::Str(raw.to_string()))
                } else {
                    Err(self.failure(&format!("expected one of {}", variants.join(", "))))
                }
            }
        }
    }

    fn failure(&self, problem: &str) -> String {
        format!("{problem} for argument {}", self.title)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum ArgValue {
    Str(String),
    Num(f64),
    None,
}

impl ArgValue {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            ArgValue::Str(value) => Some(value),
            _ => None,
        }
    }

    pub fn as_num(&self) -> Option<f64> {
        match self {
            ArgValue::Num(value) => Some(*value),
            _ => None,
        }
    }

    /// Numeric arguments are always used as positive cell distances.
    pub fn as_usize(&self) -> Option<usize> {
        self.as_num().map(|n| n.max(0.0) as usize)
    }
}

/// Every action is a plain function over the whole app state — the equivalent of
/// a component closure now that there is a single owner instead of a reactive
/// provider tree.
pub type Action = fn(&mut App, &[ArgValue]) -> anyhow::Result<()>;

pub struct Command {
    pub command: String,
    pub description: Option<String>,
    pub args: Vec<ArgSpec>,
    pub action: Action,
    pub aliases: Vec<String>,
}

impl Command {
    pub fn new(command: &str, action: Action) -> Self {
        Self {
            command: command.to_string(),
            description: None,
            args: Vec::new(),
            action,
            aliases: vec![],
        }
    }

    pub fn described(mut self, description: &str) -> Self {
        self.description = Some(description.to_string());
        self
    }

    pub fn args(mut self, args: Vec<ArgSpec>) -> Self {
        self.args = args;
        self
    }

    pub fn alias(mut self, alias: &str) -> Self {
        self.aliases.push(alias.to_string());
        self
    }

    /// The `<sql> [cascade]` hint rendered after the command name.
    pub fn args_hint(&self) -> String {
        self.args
            .iter()
            .map(|a| a.title.clone())
            .collect::<Vec<_>>()
            .join(" ")
    }
}

#[derive(Default)]
pub struct Commands {
    commands: IndexMap<String, Command>,
}

impl Commands {
    pub fn register(&mut self, command: Command) {
        self.commands.insert(command.command.clone(), command);
    }

    pub fn unregister(&mut self, command: &str) {
        self.commands.shift_remove(command);
    }

    /// An exact command name first, then an alias from the config file, then one
    /// the command declared itself — so a user can rebind a built in alias.
    pub fn get<'a>(&'a self, name: &str, aliases: &HashMap<String, String>) -> Option<&'a Command> {
        self.commands
            .get(name)
            .or_else(|| self.commands.get(aliases.get(name)?))
            .or_else(|| {
                self.commands
                    .values()
                    .find(|command| command.aliases.iter().any(|alias| alias == name))
            })
    }

    /// Command names (aliases included) with their definition, sorted for the
    /// autocomplete list. Config aliases are listed first so that they survive
    /// the dedup when they shadow a built in alias, matching [`Commands::get`].
    pub fn all(&self, aliases: &HashMap<String, String>) -> Vec<(String, &Command)> {
        let mut all: Vec<(String, &Command)> = Vec::new();

        for (alias, command) in aliases {
            if let Some(command) = self.commands.get(command) {
                all.push((alias.clone(), command));
            }
        }

        for command in self.commands.values() {
            all.push((command.command.clone(), command));
            for alias in &command.aliases {
                all.push((alias.clone(), command));
            }
        }

        all.sort_by(|(a, _), (b, _)| a.cmp(b));
        all.dedup_by(|(a, _), (b, _)| a == b);
        all
    }

    pub fn parse_args(command: &Command, args: &[String]) -> Result<Vec<ArgValue>, String> {
        command
            .args
            .iter()
            .enumerate()
            .map(|(index, spec)| spec.parse(args.get(index).map(String::as_str)))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn registry() -> Commands {
        let mut commands = Commands::default();
        commands.register(Command::new("Quit", |_, _| Ok(())).alias("q"));
        commands.register(
            Command::new("WriteChanges", |_, _| Ok(()))
                .alias("w")
                .alias("write"),
        );
        commands.register(Command::new("Undo", |_, _| Ok(())));
        commands
    }

    fn config(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(alias, command)| (alias.to_string(), command.to_string()))
            .collect()
    }

    fn resolve(commands: &Commands, name: &str, aliases: &[(&str, &str)]) -> Option<String> {
        commands
            .get(name, &config(aliases))
            .map(|command| command.command.clone())
    }

    #[test]
    fn built_in_aliases_resolve() {
        let commands = registry();
        assert_eq!(resolve(&commands, "q", &[]).as_deref(), Some("Quit"));
        assert_eq!(
            resolve(&commands, "w", &[]).as_deref(),
            Some("WriteChanges")
        );
        assert_eq!(
            resolve(&commands, "write", &[]).as_deref(),
            Some("WriteChanges"),
            "a command can declare more than one"
        );
        assert_eq!(resolve(&commands, "nope", &[]), None);
    }

    #[test]
    fn a_config_alias_overrides_a_built_in_one() {
        let commands = registry();
        assert_eq!(
            resolve(&commands, "q", &[("q", "Undo")]).as_deref(),
            Some("Undo")
        );
    }

    #[test]
    fn a_real_command_name_always_wins() {
        let mut commands = registry();
        // a command actually called `w` beats both alias kinds
        commands.register(Command::new("w", |_, _| Ok(())));

        assert_eq!(
            resolve(&commands, "w", &[("w", "Undo")]).as_deref(),
            Some("w")
        );
    }

    #[test]
    fn listing_includes_each_name_once() {
        let commands = registry();
        // `w` is both a built in alias and a config alias here
        let all = commands.all(&config(&[("w", "Undo"), ("z", "Quit")]));

        let names: Vec<&str> = all.iter().map(|(name, _)| name.as_str()).collect();
        assert_eq!(
            names,
            vec!["Quit", "Undo", "WriteChanges", "q", "w", "write", "z"]
        );

        // and the config alias is the one that survived, matching get()
        let resolved = all
            .iter()
            .find(|(name, _)| name == "w")
            .map(|(_, command)| command.command.as_str());
        assert_eq!(resolved, Some("Undo"));
    }

    fn spec_parse(spec: &ArgSpec, raw: Option<&str>) -> Result<ArgValue, String> {
        spec.parse(raw)
    }

    #[test]
    fn optional_args_are_absent_not_errors() {
        let spec = ArgSpec::number("<distance>").optional();
        assert_eq!(spec_parse(&spec, None), Ok(ArgValue::None));
        assert_eq!(spec_parse(&spec, Some("3")), Ok(ArgValue::Num(3.0)));
    }

    #[test]
    fn required_args_report_the_title() {
        let spec = ArgSpec::string("<sql>");
        assert_eq!(
            spec_parse(&spec, None),
            Err("expected a value for argument <sql>".to_string())
        );
    }

    #[test]
    fn enum_args_use_their_default() {
        let spec = ArgSpec::one_of("<type>", &["tables", "schemas"]).with_default("tables");
        assert_eq!(spec_parse(&spec, None), Ok(ArgValue::Str("tables".into())));
        assert!(spec_parse(&spec, Some("nope")).is_err());
    }

    #[test]
    fn urls_must_have_a_scheme() {
        let spec = ArgSpec::url("<url>");
        assert!(spec_parse(&spec, Some("postgres://localhost/db")).is_ok());
        assert!(spec_parse(&spec, Some("localhost/db")).is_err());
    }
}
