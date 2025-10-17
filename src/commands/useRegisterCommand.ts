import { onMount } from "solid-js";
import type { ZodType } from "zod";
import type { Command } from "./Command";
import { useCommandsContext } from "./CommandsContext";

export function useRegisterCommand<const T extends ZodType[]>(
  command: Command<T>,
) {
  const commandContext = useCommandsContext();

  onMount(() => {
    commandContext.registerCommand(command);
  });
}
