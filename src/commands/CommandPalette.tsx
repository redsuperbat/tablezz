import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRegisterKeybindToggle } from "@/keybinds/useRegisterToggleKeybind";
import { useCommandsContext } from "./CommandsContext";

export function CommandPalette() {
  const [searchTerm, setSearchTerm] = useState("");
  const commandContext = useCommandsContext();

  const filteredCommands = useMemo(() => {
    return commandContext.listCommands();
  }, [commandContext]);

  const open = useRegisterKeybindToggle({
    keybindExpression: ":",
    name: "OpenCommandPalette",
  });

  return (
    <Dialog open={open.value} onOpenChange={open.set}>
      <DialogContent
        className="flex flex-col justify-start"
        showCloseButton={false}
        aria-describedby="Command palette"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <Input
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </DialogHeader>
        <div className="flex flex-col h-80 overflow-y-auto">
          {filteredCommands.map(({ name }) => (
            <div key={name}>{name}</div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
