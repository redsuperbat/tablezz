import z from "zod";
import { message } from "./commands/Messages";
import { useRegisterCommand } from "./commands/useRegisterCommand";
import { useDatabase } from "./database/useDatabase";

export function SqlCommandKeybind() {
  const database = useDatabase();

  useRegisterCommand({
    command: "Sql",
    actionArgs: [z.string().min(1).meta({ title: "<sql>" })],
    async action(sql) {
      try {
        const result = await database.execute(sql);
        message.info(String(result));
      } catch (error) {
        message.error(String(error));
      }
    },
  });

  return null;
}
