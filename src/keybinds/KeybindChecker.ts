import type { KeybindLeaderTracker } from "./KeybindLeaderTracker";
import type {
  CombinationNode,
  KeyExpression,
  KeyNode,
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
  #leaderTracker: KeybindLeaderTracker;

  constructor(event: KeyEvent, leaderTracker: KeybindLeaderTracker) {
    this.#event = event;
    this.#leaderTracker = leaderTracker;
  }

  check(node: KeyExpression): boolean {
    switch (node.kind) {
      case "key":
        return this.#checkKey(node);
      case "combination":
        return this.#checkCombination(node);
      case "or":
        return this.#checkOr(node);
    }
    return false;
  }

  #checkOr(node: OrNode): boolean {
    return this.check(node.left) || this.check(node.right);
  }

  #checkCombination(n: CombinationNode): boolean {
    switch (n.left.kind) {
      case "meta":
        return this.#event.metaKey && this.check(n.right);
      case "alt":
        return this.#event.altKey && this.check(n.right);
      case "ctrl":
        return this.#event.ctrlKey && this.check(n.right);
      case "leader": {
        // It's important we check leader key last since we clear
        // the leader key when checked if it's active
        // This is not a great design but works well for now
        return this.check(n.right) && this.#leaderTracker.isActive();
      }
    }

    return false;
  }

  #checkKey(n: KeyNode): boolean {
    return n.key === this.#event.key || n.key === this.#event.code;
  }
}
