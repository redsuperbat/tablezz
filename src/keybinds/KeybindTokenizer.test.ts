import { test } from "vitest";
import { KeybindTokenizer } from "./KeybindTokenizer";

test("KeybindTokenizer", () => {
	const tokenizer = new KeybindTokenizer("Enter");
	console.log(tokenizer.tokenize());
});
