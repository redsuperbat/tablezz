import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRegisterKeybindCommand } from "@/keybinds/useRegisterKeybindCommand";
import { useRegisterKeybindToggle } from "@/keybinds/useRegisterToggleKeybind";
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
  const filteredCommands = useMemo(() => {
    return commandContext.listCommands();
  }, [value]);

  const ghostText = useMemo(() => {
    if (value.trim() === "") {
      return "";
    }

    const match = filteredCommands.find((suggestion) =>
      suggestion.name.startsWith(value),
    );

    if (!match) {
      return "";
    }

    return match?.name;
  }, [filteredCommands, value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" || e.key === "ArrowRight") {
      if (ghostText && ghostText !== value) {
        e.preventDefault();
        onValueChanged(ghostText);
      }
    } else if (e.key === "Enter") {
      if (ghostText && ghostText !== value) {
        e.preventDefault();
        onValueChanged(ghostText);
      }
    }
  };

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

        <input
          type="text"
          value={value}
          onChange={(e) => onValueChanged(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type to search..."
          className="relative w-full focus:outline-none bg-transparent"
          style={{ caretColor: "black" }}
        />
      </div>
    </div>
  );
}

export function CommandPalette() {
  const commandContext = useCommandsContext();
  const [inputValue, setInputValue] = useState("");

  const toggle = useRegisterKeybindToggle({
    keybindExpression: ":",
    name: "CommandPaletteOpen",
  });

  useRegisterKeybindCommand({
    keybindExpression: "Enter",
    disabled: !toggle.value,
    action() {
      commandContext.triggerCommand(inputValue);
      toggle.set(false);
    },
    command: "CommandAccept",
    overrideInput: true,
  });

  return (
    <Dialog open={toggle.value} onOpenChange={toggle.set}>
      <DialogContent
        className="flex flex-col justify-start p-0 rounded"
        showCloseButton={false}
        aria-describedby="Command palette"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <div className="flex px-2 py-1 gap-0.5">
            <span>:</span>
            <Autocomplete value={inputValue} onValueChanged={setInputValue} />
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
