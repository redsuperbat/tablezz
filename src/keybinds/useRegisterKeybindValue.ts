import { createSignal } from "solid-js";
import type { ZodType } from "zod";
import type { InferParsedSchemas } from "@/commands/Command";
import {
  type KeybindCommand,
  useRegisterKeybindCommand,
} from "./useRegisterKeybindCommand";

export interface RegisterKeybindValueOptions<T extends ZodType[]>
  extends Omit<KeybindCommand<T>, "action"> {}

export function useRegisterKeybindValue<const T extends ZodType[]>(
  options: RegisterKeybindValueOptions<T>,
) {
  const [value, setValue] = createSignal<InferParsedSchemas<T>>();

  useRegisterKeybindCommand({
    command: options.command,
    actionArgs: options.actionArgs,
    keybindExpression: options.keybindExpression,
    description: options.description,
    overrideInput: options.overrideInput,
    action(...args) {
      setValue(() => args);
    },
  });

  return { value, set: setValue };
}
