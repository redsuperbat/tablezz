import { useQueryClient } from "@tanstack/solid-query";
import z from "zod";
import { message } from "./commands/Messages";
import { useRegisterCommandOnMount } from "./commands/useRegisterCommand";
import { useDatabase } from "./database/useDatabase";
import { useRegisterKeybindCommandOnMount } from "./keybinds/useRegisterKeybindCommand";

export function SqlCommandKeybind() {
  const database = useDatabase();
  const queryClient = useQueryClient();

  useRegisterKeybindCommandOnMount({
    keybindExpression: "Meta + r",
    command: "ReloadFull",
    action() {
      queryClient.resetQueries();
      message.info("Reloaded all data");
    },
  });

  useRegisterCommandOnMount({
    command: "SqlExecute",
    actionArgs: [z.string().min(1).meta({ title: "<sql>" })],
    async action(sql) {
      try {
        await database.execute(sql);
        queryClient.invalidateQueries();
      } catch (error) {
        message.error(String(error));
      }
    },
  });

  return null;
}
