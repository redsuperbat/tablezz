import { For, type ParentProps } from "solid-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { useKeybindContext } from "./KeybindProvider";
import { useRegisterKeybindCommand } from "./useRegisterKeybindCommand";
import { useRegisterKeybindToggle } from "./useRegisterToggleKeybind";

function Code(props: ParentProps) {
  return (
    <pre class="ml-auto w-fit rounded bg-gray-200 px-1">
      <code>{props.children}</code>
    </pre>
  );
}

export function KeybindHelp() {
  const toggle = useRegisterKeybindToggle({
    keybindExpression: "? | (Control + ?)",
    command: "KeybindHelpOpen",
  });

  useRegisterKeybindCommand({
    keybindExpression: "Escape",
    command: "KeybindHelpClose",
    action() {
      toggle.close();
    },
  });

  const binds = useKeybindContext();

  const sortedBinds = () =>
    binds.keybinds().sort((a, b) => a.command.localeCompare(b.command));

  return (
    <Dialog open={toggle.value()} onOpenChange={toggle.set}>
      <DialogContent
        aria-describedby="Keybinds"
        onEscapeKeyDown={(e) => e.preventDefault()}
        class="flex flex-col justify-start overflow-y-auto bg-white sm:max-w-fit"
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
