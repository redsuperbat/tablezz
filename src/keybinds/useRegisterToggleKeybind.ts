import { useState } from "react";
import {
  type KeybindCommand,
  useRegisterKeybindCommand,
} from "./useRegisterKeybindCommand";

export interface RegisterToggleKeybindOption
  extends Omit<KeybindCommand, "action"> {
  initialValue?: boolean;
}

export function useRegisterKeybindToggle({
  keybindExpression,
  command,
  initialValue,
  overrideInput,
}: RegisterToggleKeybindOption) {
  const [show, setShow] = useState(initialValue ?? false);

  useRegisterKeybindCommand({
    command,
    keybindExpression,
    overrideInput,
    action() {
      setShow((s) => !s);
    },
  });

  return { value: show, set: setShow, close: () => setShow(false) };
}
