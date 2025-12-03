import { BaseDirectory, readFile } from "@tauri-apps/plugin-fs";
import { z } from "zod";
import { tryCatch } from "@/lib/tryCatch";

const configuration = z.object({
  leaderKey: z.string().default("Space"),
  leaderKeyTimeoutMs: z.number().default(1000),
  keybinds: z
    .record(
      z.string(),
      z.string().or(z.object({ command: z.string(), description: z.string() })),
    )
    .default({}),
  editor: z.string().default("nvim"),
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
