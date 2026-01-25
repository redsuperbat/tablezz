import { useQueryClient } from "@tanstack/solid-query";
import {
  type Accessor,
  createContext,
  createSignal,
  type JSXElement,
  type ParentProps,
  useContext,
} from "solid-js";
import { prettifyError, type ZodType } from "zod";
import { useConfig } from "@/config/ConfigurationProvider";
import { iife } from "@/lib/iife";
import type { Command } from "./Command";
import { message } from "./Messages";
import {
  type CommandVariables,
  expandVariables,
  type ParsedCommand,
  parseCommand,
} from "./parseCommand";

interface CommandsContext {
  registerCommand<const T extends ZodType[]>(command: Command<T>): void;
  unregisterCommand(command: string): void;
  triggerCommand(commandExpression: string): void;
  allCommands(): Command[];
  addCommandLineSuffix(suffix: JSXElement): void;
  commandLineSuffix: Accessor<JSXElement>;
  registerVariable(char: string, getter: () => string): void;
  unregisterVariable(char: string): void;
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
  const queryClient = useQueryClient();
  const { config } = useConfig();
  const [commands, setCommands] = createSignal(new Map<string, Command>());
  const [suffix, setSuffix] = createSignal<JSXElement>();
  const [variables, setVariables] = createSignal<CommandVariables>(new Map());

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

  function registerVariable(char: string, getter: () => string) {
    setVariables((prev) => {
      const newMap = new Map(prev);
      newMap.set(char, getter);
      return newMap;
    });
  }

  function unregisterVariable(char: string) {
    setVariables((prev) => {
      const newMap = new Map(prev);
      newMap.delete(char);
      return newMap;
    });
  }

  const nextTick = () => new Promise<void>((r) => queueMicrotask(r));
  function waitForQueries(): Promise<void> {
    return new Promise((resolve) => {
      if (queryClient.isFetching() === 0) {
        resolve();
        return;
      }

      const unsubscribe = queryClient.getQueryCache().subscribe(() => {
        if (queryClient.isFetching() === 0) {
          unsubscribe();
          resolve();
        }
      });
    });
  }

  function triggerCommand(commandExpression: string) {
    const expandedCommandExpression = expandVariables(
      commandExpression,
      variables(),
    );

    const parsedCommands = parseCommand(expandedCommandExpression);

    iife(async () => {
      for (const command of parsedCommands) {
        // wait for pending queries to the database
        await waitForQueries();
        // wait solid to trigger onMount
        await nextTick();
        await executeCommand(command);
      }
    });
  }

  async function executeCommand(parsedCommand: ParsedCommand) {
    const { args, commandName } = parsedCommand;

    const command =
      commands().get(commandName) ??
      commands().get(config().commandAliases[commandName] ?? "");

    if (!command) {
      return message.error(`Invalid command: "${commandName}"`);
    }

    const parsedArgs = [];
    for (const [index, schema] of (command.actionArgs ?? []).entries()) {
      const arg = schema.safeParse(args[index]);

      if (!arg.success) {
        const argTitle = schema.meta()?.title;
        const help = argTitle
          ? ` for argument ${argTitle}`
          : ` at index "${index}"`;
        message.error(`${prettifyError(arg.error)} ${help}`);
        return;
      }

      parsedArgs.push(arg.data);
    }

    try {
      await command.action(...parsedArgs);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      message.error(errorMessage);
    }
  }

  function allCommands() {
    const all = commands().values().toArray();

    for (const [alias, command] of Object.entries(config().commandAliases)) {
      const cmd = all.find((c) => c.command === command);
      if (!cmd) continue;
      cmd.command = alias;
      all.push(cmd);
    }

    return all;
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
        registerVariable,
        unregisterVariable,
      }}
    >
      {props.children}
    </CommandsContext.Provider>
  );
}
