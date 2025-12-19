import { makePersisted } from "@solid-primitives/storage";
import {
  createSignal,
  For,
  Match,
  onMount,
  type Setter,
  Show,
  Switch,
} from "solid-js";
import { useRegisterKeybindCommandOnMount } from "@/keybinds/useRegisterKeybindCommand";
import { useRegisterKeybindToggle } from "@/keybinds/useRegisterKeybindToggle";
import { cn } from "@/lib/cn";
import { createBoundedCounter, createCounterWithWrap } from "@/lib/counter";
import { useIntersectionScroll } from "@/lib/useIntersectionScroll";
import type { Command } from "./Command";
import { useCommandsContext } from "./CommandsContext";
import { createWatcher } from "./createWatcher";
import { Messages, message } from "./Messages";
import { useRegisterCommandOnMount } from "./useRegisterCommand";

function AutocompleteOptions(props: {
  filteredCommands: Command[];
  onCommandNameAccepted: (commandName: string) => void;
  onClose: () => void;
}) {
  const selectedIndex = createCounterWithWrap(
    () => props.filteredCommands.length - 1,
  );

  createWatcher(
    () => props.filteredCommands,
    ({ next, prev }) => {
      if (prev?.length === next.length) return;
      selectedIndex.reset();
    },
  );

  useRegisterKeybindCommandOnMount({
    command: "CommandAutocompleteHide",
    description: "Hide the command autocomplete menu.",
    keybindExpression: "Escape",
    action: props.onClose,
    overrideInput: true,
  });

  useRegisterKeybindCommandOnMount({
    command: "CommandAutocompleteNext",
    description: "Select the next item in the autocomplete list.",
    keybindExpression: "Tab",
    action() {
      // If it's a single command we just select it
      if (props.filteredCommands.length === 1) {
        const commandName = props.filteredCommands.at(0)?.command;
        if (!commandName) return;
        return props.onCommandNameAccepted(commandName);
      }

      selectedIndex.increment();
    },
    overrideInput: true,
  });

  useRegisterKeybindCommandOnMount({
    command: "CommandCompletePrev",
    description: "Select the previous item in the autocomplete list.",
    action() {
      selectedIndex.decrement();
    },
    keybindExpression: "Control + Tab",
    overrideInput: true,
  });

  useRegisterKeybindCommandOnMount({
    command: "CommandAutocompleteAccept",
    description: "Accept the selected autocomplete suggestion.",
    keybindExpression: "Enter",
    action() {
      const command = props.filteredCommands.at(selectedIndex.value());
      if (!command) return;
      props.onCommandNameAccepted(command.command);
    },
    overrideInput: true,
  });

  return (
    <div class="-left-2 absolute bottom-full z-50 flex max-h-52 flex-col-reverse overflow-y-auto border border-zinc-200 bg-white p-1 shadow-lg">
      <For each={props.filteredCommands}>
        {(c, index) => (
          <AutocompleteOption
            index={index()}
            selectedIndex={selectedIndex.value()}
            commandName={c.command}
          />
        )}
      </For>
    </div>
  );
}

function AutocompleteOption(props: {
  index: number;
  selectedIndex: number;
  commandName: string;
}) {
  const isActive = () => props.index === props.selectedIndex;
  const ref = useIntersectionScroll(isActive);

  return (
    <div
      ref={ref}
      class={cn(
        "px-2 py-1 font-mono text-sm text-zinc-700",
        isActive() && "bg-blue-500/20 text-zinc-900",
      )}
    >
      {props.commandName}
    </div>
  );
}

function Autocomplete(props: {
  value: string;
  onValueChanged: (v: string) => void;
}) {
  const commandContext = useCommandsContext();
  let input: HTMLInputElement | undefined;

  onMount(() => {
    // Autofocus is flaky after first mount, this works well though
    input?.focus();
  });

  const commands = () => commandContext.allCommands();

  const ghostText = () => {
    if (props.value.trim() === "") {
      return;
    }

    const matchingCommand = commands().find((cmd) =>
      cmd.command.startsWith(props.value.trim()),
    );

    if (!matchingCommand) {
      return;
    }

    const maybeSchemaTypes = matchingCommand.actionArgs
      ?.map((s) => s.meta()?.title)
      .join(" ");

    const schemaTypes = maybeSchemaTypes ? ` ${maybeSchemaTypes}` : "";

    return {
      show: `${matchingCommand.command}${schemaTypes}`,
      fill: matchingCommand.command,
    };
  };

  const toggleShowAutocomplete = useRegisterKeybindToggle({
    keybindExpression: "Control + Space",
    command: "CommandShowAutocomplete",
    description: "Show the command autocomplete menu.",
    overrideInput: true,
  });

  const filteredCommands = () =>
    commands().filter((c) => c.command.startsWith(props.value));

  useRegisterKeybindCommandOnMount({
    command: "CommandComplete",
    description: "Autocomplete the current command or show suggestions.",
    action() {
      if (filteredCommands().length === 1) {
        return props.onValueChanged(ghostText()?.fill ?? "");
      }
      if (filteredCommands().length > 1) {
        return toggleShowAutocomplete.set(true);
      }
    },
    keybindExpression: "Tab",
    overrideInput: true,
  });

  return (
    <div class="relative w-full">
      <div class="relative">
        <div class="pointer-events-none absolute inset-0 overflow-hidden whitespace-nowrap font-mono text-zinc-400">
          <span class="invisible">{props.value}</span>

          <span>{ghostText()?.show.slice(props.value.length)}</span>
        </div>

        <Show when={toggleShowAutocomplete.value()}>
          <AutocompleteOptions
            onClose={() => toggleShowAutocomplete.set(false)}
            onCommandNameAccepted={(commandName) => {
              props.onValueChanged(commandName);
              toggleShowAutocomplete.set(false);
            }}
            filteredCommands={filteredCommands()}
          />
        </Show>

        <input
          ref={input}
          type="text"
          value={props.value}
          onInput={(e) => props.onValueChanged(e.target.value)}
          placeholder='Type a command name or press "Tab"'
          autofocus
          class="relative w-full bg-transparent font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          style={{ "caret-color": "currentColor" }}
        />
      </div>
    </div>
  );
}

function CommandLineContent(props: {
  commandHistory: () => string[];
  setCommandHistory: Setter<string[]>;
  onClose: () => void;
  onSelect: () => void;
}) {
  const commandContext = useCommandsContext();
  const historyIndex = createBoundedCounter({
    initialValue: -1,
    min: 0,
    max: () => props.commandHistory().length - 1,
  });
  const [inputValue, setInputValue] = createSignal("");

  useRegisterKeybindCommandOnMount({
    keybindExpression: "Escape",
    command: "CommandLineClose",
    description: "Close the command line.",
    action: props.onClose,
    overrideInput: true,
  });

  useRegisterCommandOnMount({
    command: "CommandLineClearHistory",
    description: "Clear all command history.",
    action() {
      props.setCommandHistory([]);
    },
  });

  useRegisterKeybindCommandOnMount({
    keybindExpression: "ArrowDown | Control + j",
    command: "CommandLineNextHistory",
    description: "Navigate to the next command in history.",
    overrideInput: true,
    action() {
      historyIndex.decrement();

      const history = props.commandHistory().at(historyIndex.value());
      if (!history) return;

      setInputValue(history);
    },
  });

  useRegisterKeybindCommandOnMount({
    keybindExpression: "ArrowUp | Control + k",
    command: "CommandLinePreviousHistory",
    description: "Navigate to the previous command in history.",
    overrideInput: true,
    action() {
      historyIndex.increment();

      const history = props.commandHistory().at(historyIndex.value());
      if (!history) return;

      setInputValue(history);
    },
  });

  useRegisterKeybindCommandOnMount({
    keybindExpression: "Enter",
    action() {
      const command = inputValue().trim();
      if (command.length === 0) {
        return props.onClose();
      }

      props.setCommandHistory((prev) => {
        return [command, ...prev];
      });

      commandContext.triggerCommand(command);
      props.onSelect();
    },
    command: "CommandAccept",
    description: "Execute the current command.",
    overrideInput: true,
  });

  return (
    <div class="flex items-center gap-1">
      <span class="font-mono text-zinc-500">:</span>
      <Autocomplete value={inputValue()} onValueChanged={setInputValue} />
    </div>
  );
}

export function CommandLine() {
  const commandContext = useCommandsContext();
  const [commandHistory, setCommandHistoryArray] = makePersisted(
    createSignal<string[]>([]),
    { name: "commandHistory" },
  );

  const setCommandHistory = (cb: (commands: string[]) => string[]) => {
    setCommandHistoryArray([...new Set(cb(commandHistory()))]);
  };

  const toggle = useRegisterKeybindToggle({
    keybindExpression: ":",
    command: "CommandLineActivate",
    description: "Open the command line.",
  });

  createWatcher(toggle.value, ({ next }) => {
    if (next) {
      message.clear();
    }
  });

  return (
    <div class="h-8 w-screen border-zinc-200 border-t bg-zinc-50">
      <div
        class="grid h-full items-center px-3"
        style={{ "grid-template-columns": "1fr auto" }}
      >
        <Switch fallback={<Messages />}>
          <Match when={toggle.value()}>
            <CommandLineContent
              commandHistory={commandHistory}
              setCommandHistory={setCommandHistory}
              onClose={toggle.close}
              onSelect={toggle.close}
            />
          </Match>
        </Switch>
        <span class="grid place-content-center text-sm">
          {commandContext.commandLineSuffix()}
        </span>
      </div>
    </div>
  );
}
