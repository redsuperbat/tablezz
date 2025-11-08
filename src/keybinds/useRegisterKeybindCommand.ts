import { onCleanup, onMount } from "solid-js";
import type { ZodType } from "zod";
import type { Command } from "@/commands/Command";
import { useCommandsContext } from "@/commands/CommandsContext";
import type { Disposable } from "./Disposable";
import type { Keybind } from "./Keybind";
import { useKeybindContext } from "./KeybindProvider";

export interface KeybindCommand<T extends ZodType[] = []>
  extends Omit<Command<T>, "name">,
    Keybind {}

export function useRegisterKeybindCommand() {
  const keybindContext = useKeybindContext();
  const commandsContext = useCommandsContext();

  return <const T extends ZodType[]>(
    keybindCommand: KeybindCommand<T>,
  ): Disposable => {
    commandsContext.registerCommand({
      action: keybindCommand.action,
      command: keybindCommand.command,
      actionArgs: keybindCommand.actionArgs,
      description: keybindCommand.description,
    });

    keybindContext.registerKeybind({
      command: keybindCommand.command,
      keybindExpression: keybindCommand.keybindExpression,
      overrideInput: keybindCommand.overrideInput,
    });

    return {
      dispose() {
        commandsContext.unregisterCommand(keybindCommand.command);
        keybindContext.unregisterKeybind(keybindCommand);
      },
    };
  };
}

export function useRegisterKeybindCommandOnMount<const T extends ZodType[]>(
  keybindCommand: KeybindCommand<T>,
) {
  const register = useRegisterKeybindCommand();

  let disposable: Disposable | undefined;

  onMount(() => {
    disposable = register(keybindCommand);
  });

  onCleanup(() => {
    disposable?.dispose();
  });
}
