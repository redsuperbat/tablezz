import { expect, test } from "vitest";
import { KeybindParser } from "./KeybindParser.ts";
import { KeybindTokenizer } from "./KeybindTokenizer";

test("KeybindParser", () => {
  const tokens = new KeybindTokenizer("Leader + Space").tokenize();
  const parser = new KeybindParser(tokens);
  expect(parser).toBeDefined();
});
