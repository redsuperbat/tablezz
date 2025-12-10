export class KeybindStack<T extends { command: string }> {
  #stacks = new Map<string, T[]>();

  constructor(stacks: Map<string, T[]> = new Map()) {
    this.#stacks = stacks;
  }

  push(keybindExpression: string, item: T): void {
    const stack = this.#stacks.get(keybindExpression) ?? [];
    this.#stacks.set(keybindExpression, [...stack, item]);
  }

  remove(keybindExpression: string, command: string): void {
    const stack = this.#stacks.get(keybindExpression);
    if (!stack) return;

    const index = stack.findLastIndex((k) => k.command === command);
    if (index === -1) return;

    const newStack = [...stack];
    newStack.splice(index, 1);

    if (newStack.length === 0) {
      this.#stacks.delete(keybindExpression);
    } else {
      this.#stacks.set(keybindExpression, newStack);
    }
  }

  top(key: string): T | undefined {
    const stack = this.#stacks.get(key);
    return stack?.at(-1);
  }

  allTops(): T[] {
    return this.#stacks
      .values()
      .map((stack) => stack.at(-1))
      .filter((item) => item !== undefined)
      .toArray();
  }

  clone(): KeybindStack<T> {
    return new KeybindStack<T>(this.#stacks);
  }
}
