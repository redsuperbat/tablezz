import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import type { Command } from "./Command";

interface RegisterCommand extends Command {}

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
    throw new Error("bad");
  }

  return ctx;
}

export function CommandsProvider({ children }: PropsWithChildren) {
  const commands = useRef<Map<string, Command>>(new Map());

  const unregisterCommand = useCallback((command: string) => {
    commands.current.delete(command);
  }, []);

  const registerCommand = useCallback((command: RegisterCommand) => {
    commands.current.set(command.name, command);
  }, []);

  const triggerCommand = useCallback((name: string) => {
    commands.current.get(name)?.action();
  }, []);

  const listCommands = useCallback(() => [...commands.current.values()], []);

  const value = useMemo(
    () => ({
      listCommands,
      triggerCommand,
      registerCommand,
      unregisterCommand,
    }),
    [listCommands, triggerCommand, registerCommand, unregisterCommand],
  );

  return (
    <CommandsContext.Provider value={value}>
      {children}
    </CommandsContext.Provider>
  );
}
