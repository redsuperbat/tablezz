import { test } from "vitest";
import { HotkeyParser } from "./HotkeyParser";
import { HotkeyTokenizer } from "./HotkeyTokenizer";

test("HotkeyParser", () => {
	const tokenizer = new HotkeyTokenizer("Enter");
	const parser = new HotkeyParser(tokenizer.tokenize());
	console.log(parser.parse());
});
