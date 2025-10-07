import { createContext, type ParentProps, useContext } from "solid-js";
import type { Command } from "./Command";

interface RegisterCommand extends Command {}

interface CommandsContext {
  registerCommand(command: RegisterCommand): void;
  unregisterCommand(name: string): void;
  triggerCommand(name: string): void;
  listCommands(): Command[];
  isCommand(name: string): void;
}
const CommandsContext = createContext<CommandsContext | null>(null);

export function useCommandsContext() {
  const ctx = useContext(CommandsContext);

  if (!ctx) {
    throw new Error("bad");
  }

  return ctx;
}

export function CommandsProvider({ children }: ParentProps) {
  const commands = new Map<string, Command>();

  const unregisterCommand = (command: string) => commands.delete(command);

  const registerCommand = (command: RegisterCommand) =>
    commands.set(command.name, command);

  const isCommand = (name: string) => commands.has(name);

  const triggerCommand = (name: string) => commands.get(name)?.action();

  const listCommands = () => [...commands.values()];

  return (
    <CommandsContext.Provider
      value={{
        listCommands,
        triggerCommand,
        registerCommand,
        unregisterCommand,
        isCommand,
      }}
    >
      {children}
    </CommandsContext.Provider>
  );
}
