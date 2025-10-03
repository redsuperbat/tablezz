import type { Command } from "@/commands/Command";
import { useCommandsContext } from "@/commands/CommandsContext";
import type { Keybind } from "./Keybind";
import { useKeybindContext } from "./KeybindProvider";

interface KeybindCommand extends Omit<Command, "name">, Keybind {
  disabled?: boolean;
}

export function useRegisterKeybindCommand(keybindCommand: KeybindCommand) {
  const keybindContext = useKeybindContext();
  const commandsContext = useCommandsContext();

  commandsContext.registerCommand({
    action: keybindCommand.action,
    name: keybindCommand.command,
    disabled: keybindCommand.disabled,
  });

  keybindContext.registerKeybind({
    command: keybindCommand.command,
    keybindExpression: keybindCommand.keybindExpression,
    overrideInput: keybindCommand.overrideInput,
  });
}
