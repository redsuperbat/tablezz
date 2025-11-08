import { For, Show } from "solid-js";
import { useKeybindContext } from "./KeybindProvider";

export function KeybindHelp() {
  const binds = useKeybindContext();

  const potentialKeybinds = () => binds.potentialKeybinds();

  return (
    <div class="absolute right-0.5 bottom-0.5 border bg-white p-1">
      <Show when={potentialKeybinds()}>
        {(binds) => (
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
        )}
      </Show>
    </div>
  );
}
