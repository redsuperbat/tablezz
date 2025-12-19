import { z } from "zod";
import { KeybindParser } from "../keybinds/KeybindParser.ts";
import { KeybindTokenizer } from "../keybinds/KeybindTokenizer.ts";

export const configuration = z
  .object({
    leaderKey: z
      .string()
      .meta({
        title: "Leader Key",
        description: "The leader key",
        examples: ["Control + a"],
      })
      .optional()
      .default("Space")
      .refine(
        (key) => {
          const tokens = new KeybindTokenizer(key).tokenize();
          const ast = new KeybindParser(tokens).parseKeybind();
          return ast.kind !== "leader";
        },
        { error: "Leader key can not be self referential" },
      ),

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
        examples: [
          {
            w: "WriteChanges",
            "Leader > d": {
              command: "PickerOpen databases",
              description: "Change database",
            },
          },
        ],
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
        examples: [
          {
            w: "WriteChanges",
            d: "DeleteRow",
          },
        ],
      })
      .optional()
      .default({}),

    editor: z
      .string()
      .meta({
        title: "Editor",
        description:
          "The terminal editor which will be invoked when editing cells",
        examples: ["vim", "emacs"],
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
