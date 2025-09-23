import type { KeybindLeaderTracker } from "./KeybindLeaderTracker";
import type {
	CombinationNode,
	KeyExpression,
	KeyNode,
	OrNode,
} from "./KeybindParser";

export class KeybindChecker {
	#event: KeyboardEvent;
	#leaderTracker: KeybindLeaderTracker;

	constructor(event: KeyboardEvent, leaderTracker: KeybindLeaderTracker) {
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
		return this.check(node.left) && this.check(node.right);
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
			case "leader": {
				if (this.#leaderTracker.isTracking) {
					return this.#leaderTracker.withLeaderScope(() => this.check(n.right));
				}

				if (this.#leaderTracker.isLeader(this.#event)) {
					this.#leaderTracker.track();
					return false;
				}

				return false;
			}
		}

		return false;
	}

	#checkKey(n: KeyNode): boolean {
		return n.key === this.#event.key || n.key === this.#event.code;
	}
}
