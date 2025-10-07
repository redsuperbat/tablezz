import { onCleanup, onMount } from "solid-js";
import type { Command } from "@/commands/Command";
import { useCommandsContext } from "@/commands/CommandsContext";
import type { Keybind } from "./Keybind";
import { useKeybindContext } from "./KeybindProvider";

export interface KeybindCommand extends Omit<Command, "name">, Keybind {}

export function useRegisterKeybindCommand(keybindCommand: KeybindCommand) {
  const keybindContext = useKeybindContext();
  const commandsContext = useCommandsContext();

  onMount(() => {
    commandsContext.registerCommand({
      action: keybindCommand.action,
      name: keybindCommand.command,
    });

    keybindContext.registerKeybind({
      command: keybindCommand.command,
      keybindExpression: keybindCommand.keybindExpression,
      overrideInput: keybindCommand.overrideInput,
    });
  });

  onCleanup(() => {
    commandsContext.unregisterCommand(keybindCommand.command);
    keybindContext.unregisterKeybind(keybindCommand);
  });
}
