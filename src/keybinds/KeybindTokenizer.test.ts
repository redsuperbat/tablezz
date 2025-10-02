import { expect, test } from "vitest";
import { KeybindTokenizer } from "./KeybindTokenizer";

test("KeybindTokenizer", () => {
  const tokenizer = new KeybindTokenizer("(Enter + k) | (Meta + j)");
  expect(tokenizer).toBeDefined();
});
