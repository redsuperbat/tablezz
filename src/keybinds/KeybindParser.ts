import type { Range, Token, TokenKind } from "./KeybindTokenizer";

export interface KeyNode {
  kind: "key";
  key: string;
  range: Range;
}

export interface LeaderNode {
  kind: "leader";
  range: Range;
}

export interface MetaNode {
  kind: "meta";
  range: Range;
}

export interface AltNode {
  kind: "alt";
  range: Range;
}

export interface CtrlNode {
  kind: "ctrl";
  range: Range;
}

export interface OrNode {
  kind: "or";
  left: KeybindNode;
  right: KeybindNode;
  range: Range;
}

export type ModifierNode = MetaNode | AltNode | CtrlNode;

export interface CombinationNode {
  kind: "combination";
  left: ModifierNode;
  right: KeybindNode;
  range: Range;
}

export type KeybindNode = KeyNode | OrNode | CombinationNode | LeaderNode;

export type KeyExpression = KeybindNode[];

export class KeybindParser {
  #tokens: Token[];
  #tokenIndex: number;

  constructor(tokens: Token[]) {
    this.#tokens = tokens;
    this.#tokenIndex = 0;
  }

  #peek(): Token | undefined {
    return this.#tokens[this.#tokenIndex];
  }

  #assertPeek<T extends TokenKind>(
    ...expected: T[]
  ): Omit<Token, "kind"> & { kind: T } {
    const token = this.#peek();
    if (!token) {
      throw new Error("Unexpected end of input");
    }
    if (!expected.includes(token.kind as T)) {
      throw new Error(`Expected any of (${expected}), got ${token.kind}`);
    }
    return token as Omit<Token, "kind"> & { kind: T };
  }

  #isAtEnd(): boolean {
    return this.#peek() === undefined;
  }

  #assertNext<T extends TokenKind>(...expected: T[]) {
    const token = this.#assertPeek(...expected);
    this.#tokenIndex++;
    return token;
  }

  #parseKey(): KeyNode {
    const token = this.#assertNext("key");
    return { key: token.lexeme, kind: "key", range: token.range };
  }

  #parseModifier(): ModifierNode {
    return this.#assertNext("meta", "alt", "ctrl");
  }

  #parseCombination(): CombinationNode {
    const left = this.#parseModifier();
    this.#assertNext("plus");
    const right = this.#parseKeybind();
    return {
      left,
      right,
      kind: "combination",
      range: { start: left.range.start, end: right.range.end },
    };
  }

  #parseLeafNode(): KeybindNode {
    const next = this.#assertPeek(
      "meta",
      "alt",
      "ctrl",
      "key",
      "leader",
      "open-paren",
    );

    switch (next.kind) {
      case "key":
        return this.#parseKey();
      case "leader":
        return this.#parseLeader();
      case "ctrl":
      case "meta":
      case "alt":
        return this.#parseCombination();
      case "open-paren":
        return this.#parseParenthesized();
    }
  }

  #parseParenthesized(): KeybindNode {
    const openParen = this.#assertNext("open-paren");
    const innerExpression = this.#parseKeybind();
    const closeParen = this.#assertNext("closed-paren");

    return {
      ...innerExpression,
      range: { start: openParen.range.start, end: closeParen.range.end },
    };
  }

  #parseLeader(): LeaderNode {
    const { kind, range } = this.#assertNext("leader");
    return { kind, range };
  }

  #parseKeybind(): KeybindNode {
    const leafExpression = this.#parseLeafNode();

    if (this.#isAtEnd()) {
      return leafExpression;
    }

    switch (this.#peek()?.kind) {
      case "plus":
        return this.#parseCombination();
      case "pipe":
        return this.#parseOr(leafExpression);
      default:
        return leafExpression;
    }
  }

  parseKeyExpression(): KeyExpression {
    const keybinds = [];

    while (true) {
      keybinds.push(this.#parseKeybind());

      if (this.#isAtEnd()) {
        break;
      }
      this.#assertNext("right-angle-bracket");
    }

    return keybinds;
  }

  #parseOr(left: KeybindNode): OrNode {
    const start = left.range.start;
    this.#assertNext("pipe");
    const right = this.#parseKeybind();

    return {
      kind: "or",
      left,
      range: { start, end: right.range.end },
      right,
    };
  }
}
