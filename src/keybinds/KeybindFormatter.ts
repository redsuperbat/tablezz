import type {
  CombinationNode,
  KeybindNode,
  KeyExpression,
  KeyNode,
  LeaderNode,
  ModifierNode,
  OrNode,
} from "./KeybindParser";

export class KeybindFormatter {
  format(keyExpression: KeyExpression): string {
    return keyExpression
      .map((node) => {
        return this.#formatKeybind(node);
      })
      .join(">");
  }

  #formatKeybind(node: KeybindNode): string {
    switch (node.kind) {
      case "key":
        return this.#formatKey(node);
      case "or":
        return this.#formatOr(node);
      case "combination":
        return this.#formatCombination(node);
      case "leader":
        return this.#formatLeader(node);
    }
  }

  #formatLeader(_node: LeaderNode): string {
    return "Leader";
  }

  #formatCombination(node: CombinationNode): string {
    return `${this.#formatModifier(node.left)} + ${this.#formatKeybind(node.right)}`;
  }

  #formatModifier(left: ModifierNode): string {
    switch (left.kind) {
      case "meta":
        return "Meta";
      case "alt":
        return "Alt";
      case "ctrl":
        return "Control";
    }
  }

  #formatOr(node: OrNode): string {
    return `${this.#formatKeybind(node.left)} | ${this.#formatKeybind(node.right)}`;
  }

  #formatKey(node: KeyNode): string {
    return node.key;
  }
}
