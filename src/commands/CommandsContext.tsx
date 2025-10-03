import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import type { Command } from "./Command";

interface RegisterCommand extends Command {
  disabled?: boolean;
}

interface CommandsContext {
  registerCommand(command: RegisterCommand): void;
  triggerCommand(name: string): void;
  listCommands(): Command[];
}
const CommandsContext = createContext<CommandsContext | null>(null);

export function useCommandsContext() {
  const ctx = useContext(CommandsContext);

  if (!ctx) {
    throw new Error("bad");
  }

  return ctx;
}

export function CommandsProvider({ children }: PropsWithChildren) {
  const commands = useRef<Map<string, Command>>(new Map());

  const registerCommand = useCallback((command: RegisterCommand) => {
    if (command.disabled) {
      commands.current.delete(command.name);
    } else {
      commands.current.set(command.name, command);
    }
  }, []);

  const triggerCommand = useCallback((name: string) => {
    commands.current.get(name)?.action();
  }, []);

  const listCommands = useCallback(() => [...commands.current.values()], []);

  const value = useMemo(
    () => ({ listCommands, triggerCommand, registerCommand }),
    [listCommands, triggerCommand, registerCommand],
  );

  return (
    <CommandsContext.Provider value={value}>
      {children}
    </CommandsContext.Provider>
  );
}
