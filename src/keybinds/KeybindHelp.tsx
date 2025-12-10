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

  const columnCount = () =>
    Math.min(3, Math.ceil((potentialKeybinds()?.length ?? 0) / 10));

  const columns = () => {
    const binds = potentialKeybinds();
    if (!binds) return [];
    type PotentialKeybind = (typeof binds)[number];
    const cols = columnCount();

    const rows = Math.ceil(binds.length / cols);
    const result: PotentialKeybind[][] = [];

    for (let col = 0; col < cols; col++) {
      const column: PotentialKeybind[] = [];

      for (let row = 0; row < rows; row++) {
        const index = col * rows + row;

        if (index < binds.length) {
          const bind = binds[index];
          if (!bind) continue;

          column.push(bind);
        }
      }
      result.push(column);
    }

    return result;
  };

  return (
    <Show when={potentialKeybinds()}>
      <div class="absolute right-2 bottom-2 z-50 flex border border-zinc-200 bg-white font-mono text-sm shadow-lg">
        <For each={columns()}>
          {(column) => (
            <div
              class="grid border-zinc-100 border-l first:border-l-0"
              style={{ "grid-template-columns": "auto 1fr" }}
            >
              <For each={column}>
                {(bind) => (
                  <>
                    <span class="pt-1 pl-2 text-zinc-700">{bind.command}</span>
                    <span class="px-2 pt-1 text-right">
                      <span class="rounded bg-zinc-100 px-1 py-0.5 text-xs text-zinc-600">
                        {bind.bind}
                      </span>
                    </span>
                    <span class="col-span-2 border-zinc-100 border-b px-2 pb-1 text-xs text-zinc-400">
                      {bind.description}
                    </span>
                  </>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
