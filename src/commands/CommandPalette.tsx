import { createSignal, For, Show } from "solid-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRegisterKeybindCommand } from "@/keybinds/useRegisterKeybindCommand";
import { useRegisterKeybindToggle } from "@/keybinds/useRegisterToggleKeybind";
import { cn } from "@/lib/cn";
import { useWrapWithZero } from "@/lib/useWrapWithZero";
import type { Command } from "./Command";
import { useCommandsContext } from "./CommandsContext";

function AutocompleteOptions({
  filteredCommands,
  onCommandNameAccepted,
  onClose,
}: {
  filteredCommands: Command[];
  onCommandNameAccepted: (commandName: string) => void;
  onClose: () => void;
}) {
  const selectedIndex = useWrapWithZero(() => filteredCommands.length - 1);

  useRegisterKeybindCommand({
    command: "CommandAutocompleteHide",
    keybindExpression: "Escape",
    action: onClose,
    overrideInput: true,
  });

  useRegisterKeybindCommand({
    command: "CommandAutocompleteNext",
    keybindExpression: "Tab",
    action() {
      selectedIndex.increment();
    },
    overrideInput: true,
  });

  useRegisterKeybindCommand({
    command: "CommandCompletePrev",
    action() {
      selectedIndex.decrement();
    },
    keybindExpression: "Shift + Tab",
    overrideInput: true,
  });

  useRegisterKeybindCommand({
    command: "CommandAutocompleteAccept",
    keybindExpression: "Enter",
    action() {
      const command = filteredCommands.at(selectedIndex.value());
      if (!command) return;
      onCommandNameAccepted(command.name);
    },
    overrideInput: true,
  });

  return (
    <div class="-left-2 absolute top-full rounded bg-white px-2">
      <For each={filteredCommands}>
        {(c, index) => (
          <div class={cn(index() === selectedIndex.value() && "bg-blue-200")}>
            {c.name}
          </div>
        )}
      </For>
    </div>
  );
}

function Autocomplete({
  value,
  onValueChanged,
}: {
  value: string;
  onValueChanged: (v: string) => void;
}) {
  const commandContext = useCommandsContext();

  const commands = () => commandContext.listCommands();

  const ghostText = () => {
    if (value.trim() === "") {
      return "";
    }

    const matchingCommand = commands().find((suggestion) =>
      suggestion.name.startsWith(value),
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
    commands().filter((c) => c.name.startsWith(value));

  useRegisterKeybindCommand({
    command: "CommandComplete",
    action() {
      if (filteredCommands().length === 1) {
        return onValueChanged(ghostText());
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
          <span class="invisible">{value}</span>
          <span>{ghostText().slice(value.length)}</span>
        </div>

        <Show when={toggleShowAutocomplete.value()}>
          <AutocompleteOptions
            onClose={() => toggleShowAutocomplete.set(false)}
            onCommandNameAccepted={(commandName) => {
              onValueChanged(commandName);
              toggleShowAutocomplete.set(false);
            }}
            filteredCommands={commands()}
          />
        </Show>

        <input
          type="text"
          value={value}
          onChange={(e) => onValueChanged(e.target.value)}
          placeholder="Type to search..."
          class="relative w-full bg-transparent focus:outline-none"
          style={{ "caret-color": "black" }}
        />
      </div>
    </div>
  );
}

function DialogPaletteContent({
  onSelect,
  onClose,
}: {
  onClose: () => void;
  onSelect: () => void;
}) {
  const commandContext = useCommandsContext();
  const [inputValue, setInputValue] = createSignal("");

  useRegisterKeybindCommand({
    keybindExpression: "Escape",
    action() {
      onClose();
    },
    command: "CommandAccept",
    overrideInput: true,
  });

  useRegisterKeybindCommand({
    keybindExpression: "Enter",
    action() {
      commandContext.triggerCommand(inputValue());
      onSelect();
    },
    command: "CommandAccept",
    overrideInput: true,
  });

  return (
    <DialogHeader>
      <DialogTitle class="sr-only">Command palette</DialogTitle>
      <div class="flex gap-0.5 px-2 py-1">
        <span>:</span>
        <Autocomplete value={inputValue()} onValueChanged={setInputValue} />
      </div>
    </DialogHeader>
  );
}

export function CommandPalette() {
  const toggle = useRegisterKeybindToggle({
    keybindExpression: ":",
    command: "CommandPaletteOpen",
  });

  return (
    <Dialog modal open={toggle.value()} onOpenChange={toggle.set}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        class="flex flex-col justify-start rounded bg-white p-0"
        aria-describedby="Command palette"
      >
        <DialogPaletteContent onClose={toggle.close} onSelect={toggle.close} />
      </DialogContent>
    </Dialog>
  );
}
