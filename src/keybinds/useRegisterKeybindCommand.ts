import { useEffect } from "react";
import type { Command } from "@/commands/Command";
import { useCommandsContext } from "@/commands/CommandsContext";
import type { Keybind } from "./Keybind";
import { useKeybindContext } from "./KeybindProvider";

export interface KeybindCommand extends Omit<Command, "name">, Keybind {}

export function useRegisterKeybindCommand(keybindCommand: KeybindCommand) {
  const keybindContext = useKeybindContext();
  const commandsContext = useCommandsContext();

  useEffect(() => {
    commandsContext.registerCommand({
      action: keybindCommand.action,
      name: keybindCommand.command,
    });

    keybindContext.registerKeybind({
      command: keybindCommand.command,
      keybindExpression: keybindCommand.keybindExpression,
      overrideInput: keybindCommand.overrideInput,
    });

    return () => {
      commandsContext.unregisterCommand(keybindCommand.command);
      keybindContext.unregisterKeybind(keybindCommand);
    };
  }, [keybindCommand, keybindContext, commandsContext]);
}
