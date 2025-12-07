import { BaseDirectory, readFile } from "@tauri-apps/plugin-fs";
import { z } from "zod";
import { tryCatch } from "@/lib/tryCatch";

const configuration = z.object({
  leaderKey: z.string().describe("The leader key").default("Space"),
  keybinds: z
    .record(
      z.string(),
      z.string().or(z.object({ command: z.string(), description: z.string() })),
    )
    .describe("Configure custom keybinds which trigger predefined commands")
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

export type Configuration = z.infer<typeof configuration>;

export const configurationFilename = "tablezz/config.json";

export async function initConfiguration(): Promise<Configuration> {
  const [error, configFile] = await tryCatch(
    readFile(configurationFilename, {
      baseDir: BaseDirectory.Home,
    }),
  );

  if (error) {
    return defaultConfig();
  }

  const [jsonError, json] = tryCatch(() =>
    JSON.parse(new TextDecoder().decode(configFile)),
  );

  if (jsonError) {
    return defaultConfig();
  }

  const parsed = configuration.safeParse(json);

  if (parsed.error) {
    return defaultConfig();
  }

  return parsed.data;
}

function defaultConfig() {
  return configuration.parse({});
}
