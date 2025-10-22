import { expect, test } from "vitest";
import { KeybindTokenizer } from "./KeybindTokenizer";

const tokenize = (exp: string) => new KeybindTokenizer(exp).tokenize();

test("KeybindTokenizer", () => {
  const tokens = tokenize("Leader > (Enter + k) | (Meta + j)");
  expect(tokens).toBeDefined();
});
