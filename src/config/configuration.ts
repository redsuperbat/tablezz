import { z } from "zod";

export const configuration = z.object({
  leaderKey: z.string().describe("The leader key").default("Space"),

  keybinds: z
    .record(
      z.string(),
      z
        .string()
        .or(
          z.object({ command: z.string(), description: z.string().optional() }),
        )
        .transform((k) => (typeof k === "string" ? { command: k } : k)),
    )
    .describe("Configure custom keybinds which trigger predefined commands")
    .default({}),

  commandAliases: z
    .record(z.string(), z.string())
    .describe("Specify aliases to alias long named commands")
    .default({}),

  editor: z
    .string()
    .describe("The terminal editor which will be invoked when editing cells")
    .default("nvim"),

  terminalFont: z
    .string()
    .describe("Font family for the terminal editor")
    .default("Fira Code"),
});
