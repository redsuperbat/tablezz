export type TokenKind =
	| "key"
	| "plus"
	| "pipe"
	| "open-paren"
	| "closed-paren"
	| "ctrl"
	| "meta"
	| "alt"
	| "shift"
	| "leader";

export type Range = {
	start: Position;
	end: Position;
};

export type Position = {
	line: number;
	col: number;
};

export type Token = {
	kind: TokenKind;
	range: Range;
	lexeme: string;
};

export class KeybindTokenizer {
	#text: string;
	#index = 0;
	#col = 1;
	#line = 1;

	readonly #kewordRegex = /[ACLMSadefilnort]/;

	constructor(text: string) {
		this.#text = text;
	}

	#next(): string {
		const char = this.#text[this.#index];

		if (char === "\n") {
			this.#col = 1;
			this.#line += 1;
			this.#index += 1;
			return this.#next();
		}

		this.#col += 1;
		this.#index += 1;
		return char;
	}

	#pos(): Position {
		return { col: this.#col, line: this.#line };
	}

	#peek() {
		return this.#text[this.#index];
	}

	#isAtEnd() {
		return this.#peek() === undefined;
	}

	#singleChar(kind: TokenKind): Token {
		const start = this.#pos();
		const char = this.#next();

		return {
			kind,
			lexeme: char,
			range: { start, end: this.#pos() },
		};
	}

	tokenize(): Token[] {
		const tokens: Token[] = [];
		while (!this.#isAtEnd()) {
			const char = this.#peek();

			// we dont care about spaces and newlines
			if (/\s/.test(char)) {
				this.#next();
				continue;
			}

			// use backslash as escape sequence
			if (char === "\\") {
				this.#next();
				tokens.push(this.#keywordOrKey());
				continue;
			}

			if (char === "+") {
				tokens.push(this.#singleChar("plus"));
				continue;
			}

			if (char === ")") {
				tokens.push(this.#singleChar("closed-paren"));
				continue;
			}

			if (char === "(") {
				tokens.push(this.#singleChar("open-paren"));
				continue;
			}

			if (char === "|") {
				tokens.push(this.#singleChar("pipe"));
				continue;
			}

			tokens.push(this.#keywordOrKey());
		}

		return tokens;
	}

	#keywordOrKey(): Token {
		const start = this.#pos();
		let lexeme = this.#next();

		while (this.#kewordRegex.test(this.#peek()) && !this.#isAtEnd()) {
			lexeme += this.#next();
		}

		let kind: TokenKind = "key";

		switch (lexeme) {
			case "Leader": {
				kind = "leader";
				break;
			}
			case "Meta": {
				kind = "meta";
				break;
			}
			case "Alt": {
				kind = "alt";
				break;
			}
			case "Shift": {
				kind = "shift";
				break;
			}
			case "Control": {
				kind = "ctrl";
				break;
			}
		}

		return {
			kind,
			lexeme,
			range: { start, end: this.#pos() },
		};
	}
}
