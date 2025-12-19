import { BaseDirectory, readFile } from "@tauri-apps/plugin-fs";
import { prettifyError, type z } from "zod";
import { message } from "@/commands/Messages";
import { tryCatch } from "@/lib/tryCatch";
import { configuration } from "./configuration";

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
    message.error(`Configuration error: ${prettifyError(parsed.error)}`);
    return defaultConfig();
  }

  return parsed.data;
}

function defaultConfig() {
  return configuration.parse({});
}
