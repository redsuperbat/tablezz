import type { CombinationNode, KeyExpression, KeyNode } from "./HotkeyParser";

export class HotkeyChecker {
	#event: KeyboardEvent;

	constructor(event: KeyboardEvent) {
		this.#event = event;
	}

	check(node: KeyExpression): boolean {
		switch (node.kind) {
			case "key":
				return this.#checkKey(node);
			case "combination":
				return this.#checkCombination(node);
		}
		return false;
	}

	#checkCombination(n: CombinationNode): boolean {
		switch (n.left.kind) {
			case "meta":
				return this.#event.metaKey && this.check(n.right);
			case "shift":
				return this.#event.shiftKey && this.check(n.right);
			case "alt":
				return this.#event.altKey && this.check(n.right);
			case "ctrl":
				return this.#event.ctrlKey && this.check(n.right);
		}
		return false;
	}

	#checkKey(n: KeyNode): boolean {
		return n.key === this.#event.key;
	}
}
