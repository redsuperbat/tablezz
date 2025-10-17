import { onMount } from "solid-js";
import { type RegisterCommand, useCommandsContext } from "./CommandsContext";

export function useRegisterCommand(command: RegisterCommand) {
  const commandContext = useCommandsContext();
  onMount(() => {
    commandContext.registerCommand(command);
  });
}
