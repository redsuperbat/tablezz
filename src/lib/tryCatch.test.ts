import { expect, test } from "vitest";
import { tryCatch } from "./tryCatch";

test("reject", async () => {
  const [error] = await tryCatch(Promise.reject("lol"));
  expect(error).toEqual(new Error("lol"));
});

test("resolve", async () => {
  const [, value] = await tryCatch(Promise.resolve("lol"));
  expect(value).toEqual("lol");
});
