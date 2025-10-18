export function parseCommand(input: string) {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === " " && !inQuotes) {
      if (current.length > 0) {
        parts.push(current);
        current = "";
      }
    } else {
      current += char;
    }

    i++;
  }

  if (current.length > 0) {
    parts.push(current);
  }

  const [commandName, ...args] = parts;

  return { commandName, args };
}
