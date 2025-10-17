import {
  createContext,
  createSignal,
  type ParentProps,
  useContext,
} from "solid-js";
import type { Command } from "./Command";

export interface RegisterCommand extends Command {}

interface CommandsContext {
  registerCommand(command: RegisterCommand): void;
  unregisterCommand(name: string): void;
  triggerCommand(name: string): void;
  listCommands(): Command[];
}
const CommandsContext = createContext<CommandsContext | null>(null);

export function useCommandsContext() {
  const ctx = useContext(CommandsContext);

  if (!ctx) {
    throw new Error("Commands context was not found");
  }

  return ctx;
}

export function CommandsProvider(props: ParentProps) {
  const [commands, setCommands] = createSignal(new Map<string, Command>());

  const unregisterCommand = (command: string) =>
    setCommands((prev) => {
      const newMap = new Map(prev);
      newMap.delete(command);
      return newMap;
    });

  const registerCommand = (command: RegisterCommand) =>
    setCommands((prev) => {
      const newMap = new Map(prev);
      newMap.set(command.name, command);
      return newMap;
    });

  const triggerCommand = (name: string) => commands().get(name)?.action();

  const listCommands = () => commands().values().toArray();

  return (
    <CommandsContext.Provider
      value={{
        listCommands,
        triggerCommand,
        registerCommand,
        unregisterCommand,
      }}
    >
      {props.children}
    </CommandsContext.Provider>
  );
}
