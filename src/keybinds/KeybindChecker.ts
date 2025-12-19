import type {
  CombinationNode,
  KeybindNode,
  KeyNode,
  LeaderNode,
  OrNode,
} from "./KeybindParser";

export interface KeyEvent {
  metaKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;

  key: string;
  code: string;
}

export class KeybindChecker {
  #event: KeyEvent;
  #leaderKeyAst: KeybindNode;

  constructor(event: KeyEvent, leaderKeyAst: KeybindNode) {
    this.#event = event;
    this.#leaderKeyAst = leaderKeyAst;
  }

  check(node: KeybindNode): boolean {
    switch (node.kind) {
      case "key":
        return this.#checkKeyNode(node);
      case "combination":
        return this.#checkCombinationNode(node);
      case "leader":
        return this.#checkLeaderNode(node);
      case "or":
        return this.#checkOrNode(node);
    }
  }

  #checkLeaderNode(_node: LeaderNode): boolean {
    return this.check(this.#leaderKeyAst);
  }

  #checkOrNode(node: OrNode): boolean {
    return this.check(node.left) || this.check(node.right);
  }

  #checkCombinationNode(n: CombinationNode): boolean {
    switch (n.left.kind) {
      case "meta":
        return this.#event.metaKey && this.check(n.right);
      case "alt":
        return this.#event.altKey && this.check(n.right);
      case "ctrl":
        return this.#event.ctrlKey && this.check(n.right);
    }
  }

  #checkKeyNode(n: KeyNode): boolean {
    return this.#checkKey(n.key);
  }

  #checkKey(key: string): boolean {
    return key === this.#event.key || key === this.#event.code;
  }
}
