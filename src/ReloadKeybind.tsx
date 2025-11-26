import { useRegisterKeybindCommandOnMount } from "./keybinds/useRegisterKeybindCommand";

export function ReloadKeybind(props: { reload: () => void }) {
  useRegisterKeybindCommandOnMount({
    command: "ReloadTable",
    keybindExpression: "r",
    action() {
      props.reload();
    },
  });

  return null;
}
