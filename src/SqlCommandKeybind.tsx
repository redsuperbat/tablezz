import { useQueryClient } from "@tanstack/solid-query";
import z from "zod";
import { message } from "./commands/Messages";
import { useRegisterCommand } from "./commands/useRegisterCommand";
import { useDatabase } from "./database/useDatabase";

export function SqlCommandKeybind() {
  const database = useDatabase();
  const queryClient = useQueryClient();

  useRegisterCommand({
    command: "SqlExecute",
    actionArgs: [z.string().min(1).meta({ title: "<sql>" })],
    async action(sql) {
      try {
        const result = await database.execute(sql);
        queryClient.invalidateQueries();
        message.info(String(result));
      } catch (error) {
        message.error(String(error));
      }
    },
  });

  return null;
}
