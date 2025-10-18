import { test } from "vitest";
import { parseCommand } from "./parseCommand";

test("parseCommand", () => {
  const result = parseCommand('Command arg1 "arg 2" "arg with many things"');
  console.log(result);
});
