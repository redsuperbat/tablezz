#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TokenKind {
    Key,
    Plus,
    Pipe,
    RightAngleBracket,
    OpenParen,
    ClosedParen,
    Ctrl,
    Meta,
    Alt,
    Leader,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Position {
    pub line: usize,
    pub col: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Token {
    pub kind: TokenKind,
    pub range: Range,
    pub lexeme: String,
}

pub struct Tokenizer {
    text: Vec<char>,
    index: usize,
    col: usize,
    line: usize,
}

impl Tokenizer {
    pub fn new(text: &str) -> Self {
        Self {
            text: text.chars().collect(),
            index: 0,
            col: 1,
            line: 1,
        }
    }

    fn next_char(&mut self) -> Result<char, String> {
        let char = *self
            .text
            .get(self.index)
            .ok_or_else(|| "Unexpected end of expression".to_string())?;

        if char == '\n' {
            self.col = 1;
            self.line += 1;
            self.index += 1;
            return self.next_char();
        }

        self.col += 1;
        self.index += 1;
        Ok(char)
    }

    fn pos(&self) -> Position {
        Position {
            col: self.col,
            line: self.line,
        }
    }

    fn peek(&self) -> Option<char> {
        self.text.get(self.index).copied()
    }

    fn is_at_end(&self) -> bool {
        self.peek().is_none()
    }

    fn single_char(&mut self, kind: TokenKind) -> Result<Token, String> {
        let start = self.pos();
        let char = self.next_char()?;

        Ok(Token {
            kind,
            lexeme: char.to_string(),
            range: Range {
                start,
                end: self.pos(),
            },
        })
    }

    pub fn tokenize(mut self) -> Result<Vec<Token>, String> {
        let mut tokens = Vec::new();

        while !self.is_at_end() {
            let char = self.peek().unwrap_or_default();

            // we dont care about spaces and newlines
            if char.is_whitespace() {
                self.next_char()?;
                continue;
            }

            // use backslash as escape sequence
            if char == '\\' {
                self.next_char()?;
                tokens.push(self.keyword_or_key()?);
                continue;
            }

            let kind = match char {
                '>' => Some(TokenKind::RightAngleBracket),
                '+' => Some(TokenKind::Plus),
                ')' => Some(TokenKind::ClosedParen),
                '(' => Some(TokenKind::OpenParen),
                '|' => Some(TokenKind::Pipe),
                _ => None,
            };

            match kind {
                Some(kind) => tokens.push(self.single_char(kind)?),
                None => tokens.push(self.keyword_or_key()?),
            }
        }

        Ok(tokens)
    }

    fn keyword_or_key(&mut self) -> Result<Token, String> {
        let start = self.pos();
        let mut lexeme = String::from(self.next_char()?);

        while !self.is_at_end() && self.peek().is_some_and(|c| c.is_ascii_alphabetic()) {
            lexeme.push(self.next_char()?);
        }

        let kind = match lexeme.as_str() {
            "Leader" => TokenKind::Leader,
            "Meta" => TokenKind::Meta,
            "Alt" => TokenKind::Alt,
            "Control" => TokenKind::Ctrl,
            _ => TokenKind::Key,
        };

        Ok(Token {
            kind,
            lexeme,
            range: Range {
                start,
                end: self.pos(),
            },
        })
    }
}

pub fn tokenize(text: &str) -> Result<Vec<Token>, String> {
    Tokenizer::new(text).tokenize()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenizes_a_full_expression() {
        let tokens = tokenize("Leader > (Enter + k) | (Meta + j)").unwrap();
        let kinds: Vec<TokenKind> = tokens.iter().map(|t| t.kind).collect();

        assert_eq!(
            kinds,
            vec![
                TokenKind::Leader,
                TokenKind::RightAngleBracket,
                TokenKind::OpenParen,
                TokenKind::Key,
                TokenKind::Plus,
                TokenKind::Key,
                TokenKind::ClosedParen,
                TokenKind::Pipe,
                TokenKind::OpenParen,
                TokenKind::Meta,
                TokenKind::Plus,
                TokenKind::Key,
                TokenKind::ClosedParen,
            ]
        );
    }

    #[test]
    fn escapes_operators() {
        let tokens = tokenize("\\|").unwrap();
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0].kind, TokenKind::Key);
        assert_eq!(tokens[0].lexeme, "|");
    }
}
