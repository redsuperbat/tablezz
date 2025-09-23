import { test } from "vitest";
import { KeybindParser } from "./KeybindParser.ts";
import { KeybindTokenizer } from "./KeybindTokenizer";

test("KeybindParser", () => {
  const tokens = new KeybindTokenizer("Leader + Space").tokenize();
  console.log(tokens);
  const parser = new KeybindParser(tokens);
  console.log(parser.parseKeyExpression());
});
