import type { Accessor } from "solid-js";
import type { ZodType } from "zod";
import { createWatcher } from "@/commands/createWatcher";
import type { Disposable } from "./Disposable";
import {
  type KeybindCommand,
  useRegisterKeybindCommand,
} from "./useRegisterKeybindCommand";

export function useRegisterKeybindCommandOnConditional<
  const T extends ZodType[],
  const U extends ZodType[],
>(props: {
  true: KeybindCommand<T>;
  false: KeybindCommand<U>;
  predicate: Accessor<boolean>;
}) {
  const register = useRegisterKeybindCommand();
  let disposable: Disposable | undefined;

  createWatcher(props.predicate, ({ next }) => {
    disposable?.dispose();
    if (next) {
      disposable = register(props.true);
    } else {
      disposable = register(props.false);
    }
  });
}
