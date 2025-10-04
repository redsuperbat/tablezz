import { describe, expect, test } from "vitest";
import { KeybindChecker, type KeyEvent } from "./KeybindChecker.ts";
import { KeybindLeaderTracker } from "./KeybindLeaderTracker.ts";
import { KeybindParser } from "./KeybindParser.ts";
import { KeybindTokenizer } from "./KeybindTokenizer";

const check = ({
  event,
  expr,
}: {
  expr: string;
  event: Partial<KeyEvent> & { key: string };
}): boolean => {
  const tokenizer = new KeybindTokenizer(expr);
  const parser = new KeybindParser(tokenizer.tokenize());
  const checker = new KeybindChecker(
    {
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      code: "",
      ...event,
    },
    new KeybindLeaderTracker(1000, "Space"),
  );
  const expression = parser.parseKeyExpression();
  return checker.check(expression);
};

describe("KeybindChecker", () => {
  test("or statements", () => {
    const result = check({
      expr: "(Control + k) | (Meta + j)",
      event: { key: "k", ctrlKey: true },
    });
    expect(result).toBe(true);
  });

  test("leader key", () => {
    const result = check({
      event: { key: "Space" },
      expr: "Leader + Space",
    });
    expect(result).toBe(false);
  });
});
