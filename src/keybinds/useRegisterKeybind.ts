import type { Command } from "@/commands/Command";
import { useCommandsContext } from "@/commands/CommandsContext";
import { useConfig } from "@/config/ConfigurationProvider";
import type { Keybind } from "./Keybind";
import { useKeybindContext } from "./KeybindProvider";

interface KeybindCommand extends Omit<Command, "name">, Keybind {}

export function useRegisterKeybindCommand(keybindCommand: KeybindCommand) {
  const config = useConfig();
  const keybindContext = useKeybindContext();
  const commandsContext = useCommandsContext();

  commandsContext.registerCommand({
    action: keybindCommand.action,
    name: keybindCommand.command,
  });

  keybindContext.register({
    command: keybindCommand.command,
    keybindExpression:
      config.get("keybindings")[keybindCommand.command] ??
      keybindCommand.keybindExpression,
    overrideInput: keybindCommand.overrideInput,
  });
}
