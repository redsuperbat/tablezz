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

  return (
    <Show when={potentialKeybinds()}>
      {(binds) => (
        <div class="absolute right-0.5 bottom-0.5 z-50 border bg-white p-1">
          <table class="w-full font-mono text-sm">
            <tbody>
              <For each={binds()}>
                {(bind) => (
                  <tr class="border-zinc-800 [&:not(:last-child)]:border-b">
                    <td class="whitespace-nowrap px-3 py-2 text-zinc-400">
                      {bind.bind}
                    </td>
                    <td class="w-8 px-2 py-2 text-center text-zinc-500">→</td>
                    <td class="px-3 py-2 text-zinc-500">{bind.command}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      )}
    </Show>
  );
}
