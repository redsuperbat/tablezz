import { useState } from "react";
import { useRegisterKeybind } from "./useRegisterKeybind";

export interface RegisterToggleKeybindOption {
  keybindExpression: string;
  name: string;
  initialValue?: boolean;
}

export function useRegisterToggleKeybind({
  keybindExpression,
  name,
  initialValue,
}: RegisterToggleKeybindOption) {
  const [show, setShow] = useState(initialValue ?? false);

  useRegisterKeybind({
    name,
    keybindExpression,
    onTrigger() {
      setShow((s) => !s);
    },
  });

  return show;
}
