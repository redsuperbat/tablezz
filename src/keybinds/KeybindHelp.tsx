import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { type PropsWithChildren, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useKeybindContext } from "./KeybindProvider";
import { useRegisterKeybind } from "./useRegisterKeybind";

function Code({ children }: PropsWithChildren) {
  return (
    <pre className="ml-auto bg-gray-200 rounded px-1 w-fit">
      <code>{children}</code>
    </pre>
  );
}

export function KeybindHelp() {
  const [open, setOpen] = useState(false);

  useRegisterKeybind({
    keybindExpression: "?",
    name: "OpenKeybindHelp",
    onTrigger() {
      setOpen((o) => !o);
    },
  });

  const binds = useKeybindContext();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby="Keybinds"
        className="sm:max-w-fit flex flex-col justify-start overflow-y-auto"
        showCloseButton={false}
      >
        <DialogHeader>
          <VisuallyHidden>
            <DialogTitle>Keybind help</DialogTitle>
          </VisuallyHidden>
        </DialogHeader>
        <div className="flex flex-col gap-0.5">
          {Object.values(binds.keybinds())
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((key) => (
              <div
                className={cn("grid grid-cols-3 gap-3")}
                style={{ gridTemplateColumns: "1fr auto 1fr" }}
                key={key.name}
              >
                <Code>{key.keybindExpression}</Code>
                <span>-&gt;</span>
                <span>{key.name}</span>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
