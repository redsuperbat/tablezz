import { test } from "vitest";
import { KeybindParser } from "./KeybindParser";
import { KeybindTokenizer } from "./KeybindTokenizer";

test("KeybindParser", () => {
	const tokenizer = new KeybindTokenizer("Enter + LOL");
	const parser = new KeybindParser(tokenizer.tokenize());
	console.log(parser.parseKeyExpression());
});
