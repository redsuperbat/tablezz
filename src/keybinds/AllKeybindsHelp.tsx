import { Show } from "solid-js";
import { KeybindHelp } from "./KeybindHelp";
import { useKeybindContext } from "./KeybindProvider";
import { useRegisterKeybindCommandOnMount } from "./useRegisterKeybindCommand";
import { useRegisterKeybindToggle } from "./useRegisterKeybindToggle";

function AllKeybindsHelpBody(props: { onClose: () => void }) {
  const keybindContext = useKeybindContext();

  useRegisterKeybindCommandOnMount({
    command: "AllKeybindHelpClose",
    description: "Close the keyboard shortcuts help.",
    keybindExpression: "Escape",
    overrideInput: true,
    action: props.onClose,
  });

  return <KeybindHelp keybinds={keybindContext.allKeybinds()} enableSearch />;
}

export function AllKeybindsHelp() {
  const toggle = useRegisterKeybindToggle({
    command: "KeybindHelpShow",
    description: "Show available keyboard shortcuts.",
    keybindExpression: "?",
    overrideInput: true,
  });

  return (
    <Show when={toggle.value()}>
      <AllKeybindsHelpBody onClose={toggle.close} />
    </Show>
  );
}
