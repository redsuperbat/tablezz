import { createSignal } from "solid-js";
import {
  type KeybindCommand,
  useRegisterKeybindCommandOnMount,
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
  const [show, setShow] = createSignal(initialValue ?? false);

  const toggle = () => setShow((s) => !s);

  useRegisterKeybindCommandOnMount({
    command,
    keybindExpression,
    overrideInput,
    action: toggle,
  });

  return {
    value: show,
    set: setShow,
    close: () => setShow(false),
    toggle,
  };
}
