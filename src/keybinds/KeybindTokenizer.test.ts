import { test } from "vitest";
import { KeybindTokenizer } from "./KeybindTokenizer";

test("KeybindTokenizer", () => {
	const tokenizer = new KeybindTokenizer("(Enter + k) | (Meta + j)");
	console.log(tokenizer.tokenize());
});
