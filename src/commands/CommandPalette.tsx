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
import { useCommandsContext } from "./CommandsContext";

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

  const filteredCommands = useMemo(() => {
    return commands.filter((c) => c.name.startsWith(value));
  }, [commands, value]);

  const selectedIndex = useWrapWithZero(filteredCommands.length - 1);

  const toggleShowAutocomplete = useRegisterKeybindToggle({
    keybindExpression: "Control + Space",
    command: "CommandShowAutocomplete",
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
      const command = filteredCommands.at(selectedIndex.value);
      if (!command) return;
      onValueChanged(command.name);
    },
  });

  useRegisterKeybindCommand({
    command: "CommandComplete",
    action() {
      onValueChanged(ghostText);
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

function DialogPaletteContent({ onSelect }: { onSelect: () => void }) {
  const commandContext = useCommandsContext();
  const [inputValue, setInputValue] = useState("");

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
    <Dialog open={toggle.value} onOpenChange={toggle.set}>
      <DialogContent
        forceMount
        className="flex flex-col justify-start p-0 rounded"
        showCloseButton={false}
        aria-describedby="Command palette"
      >
        <DialogPaletteContent onSelect={() => toggle.set(false)} />
      </DialogContent>
    </Dialog>
  );
}
