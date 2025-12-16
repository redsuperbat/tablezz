export type CommandVariables = Map<string, () => string>;

export function expandVariables(
  input: string,
  variables: CommandVariables,
): string {
  let result = "";
  let i = 0;

  while (i < input.length) {
    const char = input[i] as string;

    // Handle escape sequences
    if (char === "\\" && i + 1 < input.length) {
      const nextChar = input[i + 1] as string;
      if (variables.has(nextChar)) {
        // Escaped variable character, output literally
        result += nextChar;
        i += 2;
        continue;
      }
    }

    // Check for variable expansion
    const variableGetter = variables.get(char);
    if (variableGetter) {
      result += variableGetter();
      i++;
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

class CommandParser {
  #index = 0;
  #input: string;
  #parts: string[] = [];
  #current = "";
  #inQuotes?: string;
  #escapeNext = false;

  constructor(input: string) {
    this.#input = input;
  }

  parse() {
    while (this.#index < this.#input.length) {
      const char = this.#input[this.#index];

      if (this.#escapeNext) {
        this.#current += char;
        this.#escapeNext = false;
      } else if (char === "\\") {
        this.#escapeNext = true;
      } else if (char === '"' || char === "'" || char === "`") {
        this.#handleQuote(char);
      } else if (char === " " && !this.#inQuotes) {
        this.#pushCurrent();
      } else {
        this.#current += char;
      }

      this.#index++;
    }

    this.#pushCurrent();

    const [commandName, ...args] = this.#parts;
    return { commandName, args };
  }

  #handleQuote(char: string) {
    if (this.#inQuotes === char) {
      this.#inQuotes = undefined;
    } else if (!this.#inQuotes) {
      this.#inQuotes = char;
    } else {
      this.#current += char;
    }
  }

  #pushCurrent() {
    if (this.#current.length > 0) {
      this.#parts.push(this.#current);
      this.#current = "";
    }
  }
}

export function parseCommand(input: string) {
  return new CommandParser(input).parse();
}
