use super::tokenizer::{Range, Token, TokenKind};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Modifier {
    Meta,
    Alt,
    Ctrl,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KeybindNode {
    Key {
        key: String,
        range: Range,
    },
    Leader {
        range: Range,
    },
    Or {
        left: Box<KeybindNode>,
        right: Box<KeybindNode>,
        range: Range,
    },
    Combination {
        left: Modifier,
        right: Box<KeybindNode>,
        range: Range,
    },
}

impl KeybindNode {
    pub fn range(&self) -> Range {
        match self {
            KeybindNode::Key { range, .. }
            | KeybindNode::Leader { range }
            | KeybindNode::Or { range, .. }
            | KeybindNode::Combination { range, .. } => *range,
        }
    }

    fn with_range(self, range: Range) -> Self {
        match self {
            KeybindNode::Key { key, .. } => KeybindNode::Key { key, range },
            KeybindNode::Leader { .. } => KeybindNode::Leader { range },
            KeybindNode::Or { left, right, .. } => KeybindNode::Or { left, right, range },
            KeybindNode::Combination { left, right, .. } => {
                KeybindNode::Combination { left, right, range }
            }
        }
    }

    pub fn is_combination(&self) -> bool {
        matches!(self, KeybindNode::Combination { .. })
    }
}

/// A `>` separated sequence of keybinds.
pub type KeyExpression = Vec<KeybindNode>;

pub struct Parser {
    tokens: Vec<Token>,
    token_index: usize,
}

impl Parser {
    pub fn new(tokens: Vec<Token>) -> Self {
        Self {
            tokens,
            token_index: 0,
        }
    }

    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.token_index)
    }

    fn assert_peek(&self, expected: &[TokenKind]) -> Result<&Token, String> {
        let token = self
            .peek()
            .ok_or_else(|| "Unexpected end of input".to_string())?;

        if !expected.contains(&token.kind) {
            return Err(format!(
                "Expected any of ({expected:?}), got {:?}",
                token.kind
            ));
        }

        Ok(token)
    }

    fn is_at_end(&self) -> bool {
        self.peek().is_none()
    }

    fn assert_next(&mut self, expected: &[TokenKind]) -> Result<Token, String> {
        let token = self.assert_peek(expected)?.clone();
        self.token_index += 1;
        Ok(token)
    }

    fn parse_key(&mut self) -> Result<KeybindNode, String> {
        let token = self.assert_next(&[TokenKind::Key])?;
        Ok(KeybindNode::Key {
            key: token.lexeme,
            range: token.range,
        })
    }

    fn parse_modifier(&mut self) -> Result<(Modifier, Range), String> {
        let token = self.assert_next(&[TokenKind::Meta, TokenKind::Alt, TokenKind::Ctrl])?;
        let modifier = match token.kind {
            TokenKind::Meta => Modifier::Meta,
            TokenKind::Alt => Modifier::Alt,
            _ => Modifier::Ctrl,
        };
        Ok((modifier, token.range))
    }

    fn parse_combination(&mut self) -> Result<KeybindNode, String> {
        let (left, left_range) = self.parse_modifier()?;
        self.assert_next(&[TokenKind::Plus])?;
        let right = self.parse_keybind()?;

        Ok(KeybindNode::Combination {
            range: Range {
                start: left_range.start,
                end: right.range().end,
            },
            left,
            right: Box::new(right),
        })
    }

    fn parse_leaf_node(&mut self) -> Result<KeybindNode, String> {
        let next = self.assert_peek(&[
            TokenKind::Meta,
            TokenKind::Alt,
            TokenKind::Ctrl,
            TokenKind::Key,
            TokenKind::Leader,
            TokenKind::OpenParen,
        ])?;

        match next.kind {
            TokenKind::Key => self.parse_key(),
            TokenKind::Leader => self.parse_leader(),
            TokenKind::Ctrl | TokenKind::Meta | TokenKind::Alt => self.parse_combination(),
            _ => self.parse_parenthesized(),
        }
    }

    fn parse_parenthesized(&mut self) -> Result<KeybindNode, String> {
        let open_paren = self.assert_next(&[TokenKind::OpenParen])?;
        let inner = self.parse_keybind()?;
        let close_paren = self.assert_next(&[TokenKind::ClosedParen])?;

        Ok(inner.with_range(Range {
            start: open_paren.range.start,
            end: close_paren.range.end,
        }))
    }

    fn parse_leader(&mut self) -> Result<KeybindNode, String> {
        let token = self.assert_next(&[TokenKind::Leader])?;
        Ok(KeybindNode::Leader { range: token.range })
    }

    pub fn parse_keybind(&mut self) -> Result<KeybindNode, String> {
        let leaf = self.parse_leaf_node()?;

        if self.is_at_end() {
            return Ok(leaf);
        }

        match self.peek().map(|t| t.kind) {
            Some(TokenKind::Plus) => self.parse_combination(),
            Some(TokenKind::Pipe) => self.parse_or(leaf),
            _ => Ok(leaf),
        }
    }

    pub fn parse_key_expression(&mut self) -> Result<KeyExpression, String> {
        let mut keybinds = Vec::new();

        loop {
            keybinds.push(self.parse_keybind()?);

            if self.is_at_end() {
                break;
            }

            self.assert_next(&[TokenKind::RightAngleBracket])?;
        }

        Ok(keybinds)
    }

    fn parse_or(&mut self, left: KeybindNode) -> Result<KeybindNode, String> {
        let start = left.range().start;
        self.assert_next(&[TokenKind::Pipe])?;
        let right = self.parse_keybind()?;

        Ok(KeybindNode::Or {
            range: Range {
                start,
                end: right.range().end,
            },
            left: Box::new(left),
            right: Box::new(right),
        })
    }
}

/// Parse a full `>` separated key expression.
pub fn parse_key_expression(expression: &str) -> Result<KeyExpression, String> {
    Parser::new(super::tokenizer::tokenize(expression)?).parse_key_expression()
}

/// Parse a single keybind (used for the leader key).
pub fn parse_keybind(expression: &str) -> Result<KeybindNode, String> {
    Parser::new(super::tokenizer::tokenize(expression)?).parse_keybind()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nested_expression() {
        let ast = parse_key_expression("Leader | (Meta + (k | j)) > Space").unwrap();
        assert_eq!(ast.len(), 2);
        assert!(matches!(ast[0], KeybindNode::Or { .. }));
        assert!(matches!(&ast[1], KeybindNode::Key { key, .. } if key == "Space"));
    }

    #[test]
    fn parses_chained_modifiers() {
        let ast = parse_keybind("Control + Meta + s").unwrap();
        let KeybindNode::Combination { left, right, .. } = ast else {
            panic!("expected combination");
        };
        assert_eq!(left, Modifier::Ctrl);
        assert!(matches!(
            *right,
            KeybindNode::Combination {
                left: Modifier::Meta,
                ..
            }
        ));
    }

    #[test]
    fn rejects_trailing_operator() {
        assert!(parse_key_expression("g >").is_err());
    }
}
