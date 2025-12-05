import { For, Show } from "solid-js";
import { useKeybindContext } from "./KeybindProvider";
import {
  useRegisterKeybindCommand,
  useRegisterKeybindCommandOnMount,
} from "./useRegisterKeybindCommand";

export function KeybindHelp() {
  const keybindContext = useKeybindContext();
  const registerKeybindCommand = useRegisterKeybindCommand();

  const potentialKeybinds = () =>
    keybindContext
      .potentialKeybinds()
      ?.sort((a, b) => a.command.localeCompare(b.command));

  useRegisterKeybindCommandOnMount({
    command: "KeybindHelpShow",
    description: "Show available keyboard shortcuts.",
    keybindExpression: "?",
    overrideInput: true,
    action() {
      const disposable = registerKeybindCommand({
        command: "KeybindHelpClose",
        description: "Close the keyboard shortcuts help.",
        keybindExpression: "Escape",
        action() {
          disposable.dispose();
        },
      });

      keybindContext.showAllPotentialKeybinds();
    },
  });

  const columnCount = () => Math.ceil((potentialKeybinds()?.length ?? 0) / 10);

  return (
    <Show when={potentialKeybinds()}>
      {(binds) => (
        <div class="absolute right-2 bottom-2 z-50 border border-zinc-200 bg-white shadow-lg">
          <div
            class="grid font-mono text-sm"
            style={{ "grid-template-columns": `repeat(${columnCount()}, 1fr)` }}
          >
            <For each={binds()}>
              {(bind) => (
                <div class="flex items-center gap-2 border-zinc-100 border-b border-l px-3 py-1.5 first:border-l-0">
                  <span class="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                    {bind.bind}
                  </span>
                  <span class="text-zinc-400">→</span>
                  <div class="flex flex-col">
                    <span class="text-zinc-700">{bind.command}</span>
                    <span class="text-xs text-zinc-400">
                      {bind.description}
                    </span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      )}
    </Show>
  );
}
