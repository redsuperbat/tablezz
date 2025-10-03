import { useState } from "react";
import { useRegisterKeybindCommand } from "./useRegisterKeybind";

export interface RegisterToggleKeybindOption {
  keybindExpression: string;
  name: string;
  initialValue?: boolean;
}

export function useRegisterKeybindToggle({
  keybindExpression,
  name,
  initialValue,
}: RegisterToggleKeybindOption) {
  const [show, setShow] = useState(initialValue ?? false);

  useRegisterKeybindCommand({
    command: name,
    keybindExpression,
    action() {
      setShow((s) => !s);
    },
  });

  return { value: show, set: setShow };
}
