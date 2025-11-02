import { describe, expect, test } from "vitest";
import { KeybindChecker, type KeyEvent } from "./KeybindChecker.ts";
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
    "Space",
  );
  const expression = parser.parseKeyExpression();

  return expression.every((e) => checker.check(e));
};

describe("KeybindChecker", () => {
  test("or statements", () => {
    const result = check({
      expr: "(Control + k) | (Meta + j)",
      event: { key: "k", ctrlKey: true },
    });
    expect(result).toBe(true);
  });

  test("Multi combination", () => {
    const result = check({
      expr: "Control + Meta + s",
      event: { key: "s", ctrlKey: true, metaKey: true },
    });

    expect(result).toBe(true);
  });
});
