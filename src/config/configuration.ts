import { z } from "zod";

export const configuration = z
  .object({
    leaderKey: z
      .string()
      .meta({
        title: "Leader Key",
        description: "The leader key",
      })
      .optional()
      .default("Space"),

    keybinds: z
      .record(
        z.string(),
        z.string().or(
          z.object({
            command: z.string(),
            description: z.string().optional(),
          }),
        ),
      )
      .optional()
      .meta({
        title: "Keybinds",
        description:
          "Configure custom keybinds which trigger predefined commands",
      })
      .default({})
      .transform((k) => {
        const binds: Record<string, { command: string; description?: string }> =
          {};

        for (const [bind, command] of Object.entries(k)) {
          if (typeof command === "string") {
            binds[bind] = { command };

            continue;
          }
          binds[bind] = command;
        }

        return binds;
      }),

    commandAliases: z
      .record(z.string(), z.string())
      .meta({
        title: "Command Aliases",
        description: "Specify aliases to alias long named commands",
      })
      .optional()
      .default({}),

    editor: z
      .string()
      .meta({
        title: "Editor",
        description:
          "The terminal editor which will be invoked when editing cells",
      })
      .optional()
      .default("nvim"),

    terminalFont: z
      .string()
      .meta({
        title: "Terminal Font",
        description: "Font family for the terminal editor",
      })
      .optional()
      .default("Fira Code"),
  })
  .meta({
    title: "Tablezz Configuration",
    description: "All configuration options to configure Tablezz",
  });
