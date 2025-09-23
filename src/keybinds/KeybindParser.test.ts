import { test } from "vitest";
import { KeybindParser } from "./KeybindParser.ts";
import { KeybindTokenizer } from "./KeybindTokenizer";

test("KeybindParser", () => {
	const tokenizer = new KeybindTokenizer("(Enter + k) | (Meta + j)");
	const parser = new KeybindParser(tokenizer.tokenize());
	console.log(parser.parseKeyExpression());
});
