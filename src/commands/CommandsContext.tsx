import {
  type Accessor,
  createContext,
  createSignal,
  type JSXElement,
  type ParentProps,
  useContext,
} from "solid-js";
import { type ZodType, z } from "zod";
import type { Command } from "./Command";
import { message } from "./Messages";
import { parseCommand } from "./parseCommand";

interface CommandsContext {
  registerCommand<const T extends ZodType[]>(command: Command<T>): void;
  unregisterCommand(command: string): void;
  triggerCommand(commandExpression: string): void;
  allCommands(): Command[];
  addCommandLineSuffix(suffix: JSXElement): void;
  commandLineSuffix: Accessor<JSXElement>;
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
  const [suffix, setSuffix] = createSignal<JSXElement>();

  function unregisterCommand(command: string) {
    return setCommands((prev) => {
      const newMap = new Map(prev);
      newMap.delete(command);
      return newMap;
    });
  }

  function registerCommand<const T extends ZodType[]>(command: Command<T>) {
    return setCommands((prev) => {
      const newMap = new Map(prev);
      newMap.set(command.command, command as Command);
      return newMap;
    });
  }

  function triggerCommand(commandExpression: string) {
    const { commandName, args } = parseCommand(commandExpression);

    if (!commandName) return;

    const command = commands().get(commandName);

    if (!command) {
      return message.error(`Invalid command ${commandName}`);
    }

    const parsedArgs = [];
    for (const [index, schema] of (command.actionArgs ?? []).entries()) {
      const arg = schema.safeParse(args[index]);

      if (!arg.success) {
        const argTitle = schema.meta()?.title;
        const help = argTitle
          ? ` for argument ${argTitle}`
          : ` at index "${index}"`;
        message.error(`${z.treeifyError(arg.error).errors.join(", ")}${help}`);
        return;
      }

      parsedArgs.push(arg.data);
    }

    command.action(...parsedArgs);
  }

  function allCommands() {
    return commands().values().toArray();
  }

  return (
    <CommandsContext.Provider
      value={{
        allCommands,
        triggerCommand,
        registerCommand,
        unregisterCommand,
        addCommandLineSuffix: setSuffix,
        commandLineSuffix: suffix,
      }}
    >
      {props.children}
    </CommandsContext.Provider>
  );
}
