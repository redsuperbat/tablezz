import { expect, test } from "vitest";
import { KeybindChecker } from "./KeybindChecker.ts";
import { KeybindLeaderTracker } from "./KeybindLeaderTracker.ts";
import { KeybindParser } from "./KeybindParser.ts";
import { KeybindTokenizer } from "./KeybindTokenizer";

test("KeybindChecker", () => {
	const tokenizer = new KeybindTokenizer("(Enter + k) | (Meta + j)");
	const parser = new KeybindParser(tokenizer.tokenize());
	const checker = new KeybindChecker(
		{
			altKey: false,
			ctrlKey: false,
			metaKey: true,
			code: "k",
			key: "j",
		},
		new KeybindLeaderTracker(1000, "Enter"),
	);
	const expresssion = parser.parseKeyExpression();
	const result = checker.check(expresssion);
	expect(result).toBe(true);
});
