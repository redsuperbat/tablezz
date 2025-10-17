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
import { useRegisterKeybindCommand } from "@/keybinds/useRegisterKeybindCommand";
import { useRegisterKeybindToggle } from "@/keybinds/useRegisterToggleKeybind";
import { cn } from "@/lib/cn";
import { createCounterWithWrap } from "@/lib/createCounterWithWrap";
import { useIntersectionScroll } from "@/lib/useIntersectionScroll";
import type { Command } from "./Command";
import { useCommandsContext } from "./CommandsContext";
import { createWatcher } from "./createWatcher";
import { Messages, message } from "./Messages";
import { useRegisterCommand } from "./useRegisterCommand";

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

  useRegisterKeybindCommand({
    command: "CommandAutocompleteHide",
    keybindExpression: "Escape",
    action: props.onClose,
    overrideInput: true,
  });

  useRegisterKeybindCommand({
    command: "CommandAutocompleteNext",
    keybindExpression: "Tab",
    action() {
      // If it's a single command we just select it
      if (props.filteredCommands.length === 1) {
        const commandName = props.filteredCommands.at(0)?.name;
        if (!commandName) return;
        return props.onCommandNameAccepted(commandName);
      }

      selectedIndex.increment();
    },
    overrideInput: true,
  });

  useRegisterKeybindCommand({
    command: "CommandCompletePrev",
    action: selectedIndex.decrement,
    keybindExpression: "Control + Tab",
    overrideInput: true,
  });

  useRegisterKeybindCommand({
    command: "CommandAutocompleteAccept",
    keybindExpression: "Enter",
    action() {
      const command = props.filteredCommands.at(selectedIndex.value());
      if (!command) return;
      props.onCommandNameAccepted(command.name);
    },
    overrideInput: true,
  });

  return (
    <div class="-left-2 absolute bottom-full flex max-h-52 flex-col-reverse overflow-y-auto rounded bg-white px-2">
      <For each={props.filteredCommands}>
        {(c, index) => (
          <AutocompleteOption
            index={index()}
            selectedIndex={selectedIndex.value()}
            commandName={c.name}
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
    <div ref={ref} class={cn(isActive() && "bg-blue-200")}>
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
      return "";
    }

    const matchingCommand = commands().find((suggestion) =>
      suggestion.name.startsWith(props.value),
    );

    if (!matchingCommand) {
      return "";
    }

    return matchingCommand?.name;
  };

  const toggleShowAutocomplete = useRegisterKeybindToggle({
    keybindExpression: "Control + Space",
    command: "CommandShowAutocomplete",
    overrideInput: true,
  });

  const filteredCommands = () =>
    commands().filter((c) => c.name.startsWith(props.value));

  useRegisterKeybindCommand({
    command: "CommandComplete",
    action() {
      if (filteredCommands().length === 1) {
        return props.onValueChanged(ghostText());
      }
      if (filteredCommands().length > 1) {
        return toggleShowAutocomplete.set(true);
      }
    },
    keybindExpression: "Tab",
    overrideInput: true,
  });

  return (
    <div class="relative w-full max-w-md">
      <div class="relative">
        <div
          class="pointer-events-none absolute inset-0 overflow-hidden whitespace-nowrap text-gray-400"
          style={{
            "font-family": "inherit",
            "font-size": "inherit",
            "line-height": "inherit",
          }}
        >
          <span class="invisible">{props.value}</span>

          <span>{ghostText().slice(props.value.length)}</span>
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
          class="relative w-full bg-transparent focus:outline-none"
          style={{ "caret-color": "black" }}
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
  const historyIndex = createCounterWithWrap(
    () => props.commandHistory().length - 1,
  );
  const [inputValue, setInputValue] = createSignal("");

  useRegisterKeybindCommand({
    keybindExpression: "Escape",
    command: "CommandLineClose",
    action: props.onClose,
    overrideInput: true,
  });

  useRegisterCommand({
    name: "CommandLineClearHistory",
    action() {
      props.setCommandHistory([]);
    },
  });

  useRegisterKeybindCommand({
    keybindExpression: "ArrowUp",
    command: "CommandLinePreviousCommand",
    overrideInput: true,
    action() {
      const history = props.commandHistory().at(historyIndex.value());
      if (!history) {
        return;
      }
      setInputValue(history);
      historyIndex.increment();
    },
  });

  useRegisterKeybindCommand({
    keybindExpression: "Enter",
    action() {
      const command = inputValue().trim();
      if (command.length === 0) {
        return props.onClose();
      }

      const [commandName, ...args] = command.split(" ");
      if (!commandName) return;

      props.setCommandHistory((prev) => {
        return [...prev, command];
      });

      commandContext.triggerCommand(commandName, ...args);
      props.onSelect();
    },
    command: "CommandAccept",
    overrideInput: true,
  });

  return (
    <div class="flex gap-0.5 px-2 py-1">
      <span>:</span>
      <Autocomplete value={inputValue()} onValueChanged={setInputValue} />
    </div>
  );
}

export function CommandLine() {
  const [commandHistory, setCommandHistory] = makePersisted(
    createSignal<string[]>([]),
    { name: "commandHistory" },
  );

  const toggle = useRegisterKeybindToggle({
    keybindExpression: ":",
    command: "CommandLineActivate",
  });

  createWatcher(toggle.value, ({ next }) => {
    if (next) {
      message.clear();
    }
  });

  return (
    <div class="absolute bottom-0 left-0 w-screen">
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
    </div>
  );
}
