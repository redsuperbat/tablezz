import { test } from "vitest";
import { HotkeyTokenizer } from "./HotkeyTokenizer";

test("HotkeyTokenizer", () => {
	const tokenizer = new HotkeyTokenizer("Enter");
	console.log(tokenizer.tokenize());
});
