import { useRegisterCommandOnMount } from "./commands/useRegisterCommand";

export function ReloadKeybind(props: { reload: () => void }) {
  useRegisterCommandOnMount({
    command: "ReloadTable",
    action() {
      props.reload();
    },
  });

  return null;
}
