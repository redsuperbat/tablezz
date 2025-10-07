import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRegisterKeybindCommand } from "@/keybinds/useRegisterKeybindCommand";
import { useRegisterKeybindToggle } from "@/keybinds/useRegisterToggleKeybind";
import { useWrapWithZero } from "@/lib/useWrapWithZero";
import { cn } from "@/lib/utils";
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
  const selectedIndex = useWrapWithZero(filteredCommands.length - 1);

  useRegisterKeybindCommand({
    command: "CommandAutocompleteHide",
    keybindExpression: "Escape",
    action: onClose,
    overrideInput: true,
  });

  console.log("registering next");
  useRegisterKeybindCommand({
    command: "CommandAutocompleteNext",
    keybindExpression: "Tab",
    action() {
      console.log("incrementing");
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
      const command = filteredCommands.at(selectedIndex.value);
      if (!command) return;
      onCommandNameAccepted(command.name);
    },
    overrideInput: true,
  });

  return (
    <div className="absolute top-full bg-white -left-2 px-2 rounded">
      {filteredCommands.map((c, index) => (
        <div
          key={c.name}
          className={cn(index === selectedIndex.value && "bg-blue-200")}
        >
          {c.name}
        </div>
      ))}
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: this will lazily show commands when user types
  const commands = useMemo(() => {
    return commandContext.listCommands();
  }, [value]);

  const ghostText = useMemo(() => {
    if (value.trim() === "") {
      return "";
    }

    const matchingCommand = commands.find((suggestion) =>
      suggestion.name.startsWith(value),
    );

    if (!matchingCommand) {
      return "";
    }

    return matchingCommand?.name;
  }, [commands, value]);

  const toggleShowAutocomplete = useRegisterKeybindToggle({
    keybindExpression: "Control + Space",
    command: "CommandShowAutocomplete",
    overrideInput: true,
  });

  const filteredCommands = useMemo(() => {
    return commands.filter((c) => c.name.startsWith(value));
  }, [commands, value]);

  console.log("registering command complete");
  useRegisterKeybindCommand({
    command: "CommandComplete",
    action() {
      if (filteredCommands.length === 1) {
        return onValueChanged(ghostText);
      }
      if (filteredCommands.length > 1) {
        return toggleShowAutocomplete.set(true);
      }
    },
    keybindExpression: "Tab",
    overrideInput: true,
  });

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <div
          className="absolute inset-0  pointer-events-none text-gray-400 whitespace-nowrap overflow-hidden"
          style={{
            fontFamily: "inherit",
            fontSize: "inherit",
            lineHeight: "inherit",
          }}
        >
          <span className="invisible">{value}</span>
          <span>{ghostText.slice(value.length)}</span>
        </div>

        {toggleShowAutocomplete.value && (
          <AutocompleteOptions
            onClose={() => toggleShowAutocomplete.set(false)}
            onCommandNameAccepted={(commandName) => {
              onValueChanged(commandName);
              toggleShowAutocomplete.set(false);
            }}
            filteredCommands={commands}
          />
        )}

        <input
          type="text"
          value={value}
          onChange={(e) => onValueChanged(e.target.value)}
          placeholder="Type to search..."
          className="relative w-full focus:outline-none bg-transparent"
          style={{ caretColor: "black" }}
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
  const [inputValue, setInputValue] = useState("");

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
      commandContext.triggerCommand(inputValue);
      onSelect();
    },
    command: "CommandAccept",
    overrideInput: true,
  });

  return (
    <DialogHeader>
      <DialogTitle className="sr-only">Command palette</DialogTitle>
      <div className="flex px-2 py-1 gap-0.5">
        <span>:</span>
        <Autocomplete value={inputValue} onValueChanged={setInputValue} />
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
    <Dialog modal open={toggle.value} onOpenChange={toggle.set}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        forceMount
        className="flex flex-col justify-start p-0 rounded"
        showCloseButton={false}
        aria-describedby="Command palette"
      >
        <DialogPaletteContent onClose={toggle.close} onSelect={toggle.close} />
      </DialogContent>
    </Dialog>
  );
}
