import { Show } from "solid-js";
import { KeybindHelp } from "./KeybindHelp";
import { useKeybindContext } from "./KeybindProvider";

export function PotentialKeybindHelp() {
  const keybindContext = useKeybindContext();

  const allPotentialKeybinds = () => keybindContext.potentialKeybinds();

  return (
    <Show when={allPotentialKeybinds()}>
      {(keybinds) => <KeybindHelp keybinds={keybinds()} />}
    </Show>
  );
}
