import { useRegisterKeybindCommandOnMount } from "./keybinds/useRegisterKeybindCommand";

const elements = ["input", "textarea"] as const;

function onFirstFind(
  cb: (el: { blur: () => void; focus: () => void }) => void,
) {
  for (const tag of elements) {
    const el = document.querySelector(tag);
    if (!el) continue;
    return cb(el);
  }
}

export function FocusInputKeybind() {
  useRegisterKeybindCommandOnMount({
    command: "InputModeExit",
    keybindExpression: "Escape",
    action() {
      onFirstFind((e) => e.blur());
    },
    overrideInput: true,
  });

  useRegisterKeybindCommandOnMount({
    command: "InputModeEnter",
    keybindExpression: "i",
    action() {
      onFirstFind((e) => e.focus());
    },
  });

  return null;
}
