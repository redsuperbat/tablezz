import { useRegisterKeybindCommand } from "./keybinds/useRegisterKeybindCommand";

export function FocusInputKeybind() {
  useRegisterKeybindCommand({
    command: "EnterInputMode",
    keybindExpression: "i",
    action() {
      document.querySelector("input")?.focus();
    },
  });
  return null;
}
