import type { Range, Token, TokenKind } from "./HotkeyTokenizer";

export interface KeyNode {
	kind: "key";
	key: string;
	range: Range;
}

export interface CombinationNode {
	kind: "combination";
	keys: KeyNode[];
	range: Range;
}

export type Node = KeyNode | CombinationNode;

export class HotkeyParser {
	#tokens: Token[];
	#pos: number;

	constructor(tokens: Token[]) {
		this.#tokens = tokens;
		this.#pos = 0;
	}

	#peek(): Token | undefined {
		return this.#tokens[this.#pos];
	}

	#assertPeek(...expected: TokenKind[]): Token {
		const token = this.#peek();
		if (!token) {
			throw new Error("Unexpected end of input");
		}
		if (!expected.includes(token.kind)) {
			throw new Error(`Expected ${expected}, got ${token.kind}`);
		}
		return token;
	}

	#assertNext(...expected: TokenKind[]): Token {
		const token = this.#assertPeek(...expected);
		this.#pos++;
		return token;
	}

	#parseKey(): KeyNode {
		const token = this.#assertNext("key");
		return { key: token.lexeme, kind: "key", range: token.range };
	}

	#parseCombination(): CombinationNode {
		const key = this.#parseKey();
		const keys = [key];

		while (this.#peek()?.kind === "plus") {
			this.#assertNext("plus");
			keys.push(this.#parseKey());
		}

		const end = keys.at(-1)?.range.end ?? key.range.end;

		return {
			keys,
			kind: "combination",
			range: { start: key.range.start, end },
		};
	}

	public parse(): Node {
		return this.#parseCombination();
	}
}
