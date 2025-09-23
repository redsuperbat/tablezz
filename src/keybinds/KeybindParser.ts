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

export interface ShiftNode {
  kind: "shift";
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
  left: KeyExpression;
  right: KeyExpression;
  range: Range;
}

export interface CombinationNode {
  kind: "combination";
  left: KeyExpression;
  right: KeyExpression;
  range: Range;
}

export type ModifierNode =
  | MetaNode
  | ShiftNode
  | AltNode
  | CtrlNode
  | LeaderNode;

export type KeyExpression = KeyNode | OrNode | CombinationNode | ModifierNode;

export class KeybindParser {
  #tokens: Token[];
  #pos: number;

  constructor(tokens: Token[]) {
    this.#tokens = tokens;
    this.#pos = 0;
  }

  #peek(): Token | undefined {
    return this.#tokens[this.#pos];
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
    this.#pos++;
    return token;
  }

  #parseKey(): KeyNode {
    const token = this.#assertNext("key");
    return { key: token.lexeme, kind: "key", range: token.range };
  }

  #parseModifier(): ModifierNode {
    return this.#assertNext("meta", "alt", "ctrl");
  }

  #parseCombination(left: KeyExpression): CombinationNode {
    this.#assertNext("plus");
    const right = this.parseKeyExpression();
    return {
      left,
      right,
      kind: "combination",
      range: { start: left.range.start, end: right.range.end },
    };
  }

  #parseLeafNode() {
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
        return this.#parseModifier();
      case "open-paren":
        return this.#parseParenthesized();
    }
  }

  #parseParenthesized(): KeyExpression {
    const openParen = this.#assertNext("open-paren");
    const innerExpression = this.parseKeyExpression();
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

  public parseKeyExpression(): KeyExpression {
    const leafExpression = this.#parseLeafNode();

    if (this.#isAtEnd()) {
      return leafExpression;
    }

    // Only look for operators if we're not at a closing paren
    let next = this.#peek();
    if (next?.kind === "closed-paren") {
      return leafExpression;
    }

    next = this.#assertPeek("plus", "pipe");

    switch (next.kind) {
      case "plus":
        return this.#parseCombination(leafExpression);
      case "pipe":
        return this.#parseOr(leafExpression);
      default:
        return leafExpression;
    }
  }

  #parseOr(left: KeyExpression): OrNode {
    const start = left.range.start;
    this.#assertNext("pipe");
    const right = this.parseKeyExpression();

    return {
      kind: "or",
      left,
      range: { start, end: right.range.end },
      right,
    };
  }
}
