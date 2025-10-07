import { For, type ParentProps } from "solid-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { useKeybindContext } from "./KeybindProvider";
import { useRegisterKeybindToggle } from "./useRegisterToggleKeybind";

function Code({ children }: ParentProps) {
  return (
    <pre class="ml-auto bg-gray-200 rounded px-1 w-fit">
      <code>{children}</code>
    </pre>
  );
}

export function KeybindHelp() {
  const toggle = useRegisterKeybindToggle({
    keybindExpression: "? | (Control + ?)",
    command: "KeybindHelpOpen",
    overrideInput: true,
  });

  const binds = useKeybindContext();

  const sortedBinds = () =>
    binds.keybinds().sort((a, b) => a.command.localeCompare(b.command));

  return (
    <Dialog open={toggle.value()} onOpenChange={toggle.set}>
      <DialogContent
        aria-describedby="Keybinds"
        class="sm:max-w-fit flex flex-col justify-start overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Keybind help</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col gap-0.5">
          <For each={sortedBinds()}>
            {(key) => (
              <div
                class={cn("grid grid-cols-3 gap-3")}
                style={{ "grid-template-columns": "1fr auto 1fr" }}
              >
                <Code>{key.keybindExpression}</Code>
                <span>-&gt;</span>
                <span>{key.command}</span>
              </div>
            )}
          </For>
        </div>
      </DialogContent>
    </Dialog>
  );
}
