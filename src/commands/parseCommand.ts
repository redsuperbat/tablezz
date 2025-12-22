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

export type ParsedCommand = {
  commandName: string;
  args: string[];
};

class CommandParser {
  #index = 0;
  #input: string;
  #parts: string[][] = [[]];
  #current = "";
  #inQuotes?: string;
  #escapeNext = false;

  constructor(input: string) {
    this.#input = input;
  }

  parse(): ParsedCommand[] {
    while (this.#index < this.#input.length) {
      const char = this.#input[this.#index];

      if (this.#escapeNext) {
        this.#current += char;
        this.#escapeNext = false;
      } else if (char === "\\") {
        this.#escapeNext = true;
      } else if (char === '"' || char === "'" || char === "`") {
        this.#handleQuote(char);
      } else if (char === "|") {
        this.#parts.push([]);
      } else if (char === " " && !this.#inQuotes) {
        this.#pushCurrent();
      } else {
        this.#current += char;
      }

      this.#index++;
    }

    this.#pushCurrent();

    return this.#parts
      .map((p) => {
        const [commandName, ...args] = p;
        if (!commandName) return;
        return { commandName, args };
      })
      .filter((c) => c !== undefined);
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
      this.#parts.at(-1)?.push(this.#current);
      this.#current = "";
    }
  }
}

export function parseCommand(input: string) {
  return new CommandParser(input).parse();
}
