import { useQueryClient } from "@tanstack/solid-query";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { relaunch } from "@tauri-apps/plugin-process";
import z from "zod";
import { message } from "./commands/Messages";
import { useRegisterCommandOnMount } from "./commands/useRegisterCommand";
import { useEditor } from "./editor/useEditor";
import { useRegisterKeybindCommandOnMount } from "./keybinds/useRegisterKeybindCommand";
import { useBatchExecute } from "./useBatchExecute";

export function GlobalKeybinds() {
  const editor = useEditor();
  const queryClient = useQueryClient();
  const batchExecute = useBatchExecute();

  useRegisterKeybindCommandOnMount({
    keybindExpression: "Meta + Enter",
    command: "ToggleMaximize",
    description: "Toggle maximize window.",
    async action() {
      const window = getCurrentWindow();
      await window.toggleMaximize();
    },
  });

  useRegisterKeybindCommandOnMount({
    keybindExpression: "Meta + r",
    command: "ReloadFull",
    description: "Restart the application.",
    async action() {
      await relaunch();
    },
  });

  useRegisterCommandOnMount({
    command: "SqlExecute",
    description: "Execute a SQL statement without returning results.",
    actionArgs: [z.string().min(1).meta({ title: "<sql>" }).optional()],
    async action(sql) {
      if (sql === undefined) {
        sql = await editor.open({
          initialContent: "",
          extension: ".sql",
        });
      }

      if (sql.length === 0) {
        return;
      }

      try {
        await batchExecute.exec([sql]);
        queryClient.invalidateQueries();
      } catch (error) {
        message.error(String(error));
      }
    },
  });

  return null;
}
