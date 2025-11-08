import { onMount } from "solid-js";
import type { ZodType } from "zod";
import type { Disposable } from "@/keybinds/Disposable";
import type { Command } from "./Command";
import { useCommandsContext } from "./CommandsContext";

export function useRegisterCommand() {
  const commandContext = useCommandsContext();

  return <const T extends ZodType[]>(command: Command<T>): Disposable => {
    commandContext.registerCommand(command);

    return {
      dispose() {
        commandContext.unregisterCommand(command.command);
      },
    };
  };
}

export function useRegisterCommandOnMount<const T extends ZodType[]>(
  command: Command<T>,
) {
  const registerCommand = useRegisterCommand();

  onMount(() => {
    registerCommand(command);
  });
}
