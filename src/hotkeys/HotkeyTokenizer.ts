export type TokenKind =
	| "key"
	| "plus"
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

export class HotkeyTokenizer {
	#text: string;
	#index = 0;
	#col = 1;
	#line = 1;
	readonly #keyRegex = /^[A-Za-z0-9]+/;

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

	tokenize(): Token[] {
		const tokens: Token[] = [];
		while (this.#index < this.#text.length) {
			const start = this.#pos();
			const char = this.#next();

			// we dont care about spaces and newlines
			if (/s/.test(char)) {
				continue;
			}

			if (char === "+") {
				tokens.push({
					kind: "plus",
					lexeme: char,
					range: { start, end: this.#pos() },
				});
				continue;
			}

			if (this.#keyRegex.test(char)) {
				let lexeme = char;
				while (this.#keyRegex.test(this.#peek()) && !this.#isAtEnd()) {
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

				tokens.push({
					kind,
					lexeme,
					range: { start, end: this.#pos() },
				});
			}
		}

		return tokens;
	}
}
