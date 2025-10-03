import { useId, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRegisterKeybindToggle } from "@/keybinds/useRegisterToggleKeybind";
import { useCommandsContext } from "./CommandsContext";

export function CommandPalette() {
  const [searchTerm, setSearchTerm] = useState("");
  const commandContext = useCommandsContext();

  // biome-ignore lint/correctness/useExhaustiveDependencies: this will lazily show commands when user types
  const _filteredCommands = useMemo(() => {
    return commandContext
      .listCommands()
      .filter((c) => c.name.startsWith(searchTerm));
  }, [searchTerm]);

  const toggle = useRegisterKeybindToggle({
    keybindExpression: ":",
    name: "OpenCommandPalette",
  });
  const id = useId();

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
            <input
              list={id}
              autoFocus
              type="text"
              value={searchTerm}
              className="outline-none"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <datalist id={id}>
              <option value="New York" />
              <option value="Los Angeles" />
              <option value="Chicago" />
              <option value="Houston" />
              <option value="Phoenix" />
            </datalist>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
