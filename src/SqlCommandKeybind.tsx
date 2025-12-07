import { useQueryClient } from "@tanstack/solid-query";
import { getCurrentWindow } from "@tauri-apps/api/window";
import z from "zod";
import { message } from "./commands/Messages";
import { useRegisterCommandOnMount } from "./commands/useRegisterCommand";
import { useDatabase } from "./database/useDatabase";
import { useEditor } from "./editor/useEditor";
import { useRegisterKeybindCommandOnMount } from "./keybinds/useRegisterKeybindCommand";

export function SqlCommandKeybind() {
  const database = useDatabase();
  const editor = useEditor();
  const queryClient = useQueryClient();

  useRegisterKeybindCommandOnMount({
    keybindExpression: "Meta + Enter",
    command: "ToggleFullscreen",
    description: "Toggle fullscreen mode.",
    async action() {
      const window = getCurrentWindow();
      const isFullscreen = await window.isFullscreen();
      await window.setFullscreen(!isFullscreen);
    },
  });

  useRegisterKeybindCommandOnMount({
    keybindExpression: "Meta + r",
    command: "ReloadFull",
    description: "Reload all data from the database.",
    action() {
      queryClient.resetQueries();
      message.info("Reloaded all data");
    },
  });

  useRegisterCommandOnMount({
    command: "SqlExecute",
    description: "Execute a SQL statement without returning results.",
    actionArgs: [z.string().min(1).meta({ title: "<sql>" }).optional()],
    async action(sql) {
      if (sql === undefined) {
        sql = await editor.open({
          initialContent: `-- Add your sql statement below \n\n\n`,
          extension: ".sql",
        });
      }

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
