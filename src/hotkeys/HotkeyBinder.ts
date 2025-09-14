import type { CombinationNode, KeyNode, Node } from "./HotkeyParser";

export class HotkeyBinder {
	#ast: Node;
	#handler: (e: KeyboardEvent) => void;
	#subscriptions: Set<() => void> = new Set();

	constructor(ast: Node, handler: (e: KeyboardEvent) => void) {
		this.#ast = ast;
		this.#handler = handler;
	}

	register() {
		switch (this.#ast.kind) {
			case "key":
				this.#registerKey(this.#ast);
				break;
			case "combination":
				this.#registerCombination(this.#ast);
				break;
		}

		return { unsubscribe: () => this.#subscriptions.forEach((s) => s()) };
	}

	#registerCombination(n: CombinationNode): void {
		this.#registerWithPredicate((e) =>
			n.keys.map((k) => k.key).includes(e.key),
		);
	}

	#registerKey(n: KeyNode): void {
		this.#registerWithPredicate((e) => e.key === n.key);
	}

	#registerWithPredicate(predicate: (e: KeyboardEvent) => boolean) {
		const handleKey = (e: KeyboardEvent) => {
			if (predicate(e)) {
				this.#handler(e);
			}
		};
		window.addEventListener("keyup", handleKey);
		this.#subscriptions.add(() =>
			window.removeEventListener("keyup", handleKey),
		);
	}
}
