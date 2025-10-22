import { expect, test } from "vitest";
import { KeybindParser } from "./KeybindParser.ts";
import { KeybindTokenizer } from "./KeybindTokenizer";

const parse = (exp: string) => {
  const tokens = new KeybindTokenizer(exp).tokenize();
  return new KeybindParser(tokens).parseKeyExpression();
};

test("KeybindParser", () => {
  const ast = parse("Leader | (Meta + (k | j)) > Space");
  expect(ast).toBeDefined();
});
