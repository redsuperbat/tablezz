import { BaseDirectory, readFile } from "@tauri-apps/plugin-fs";
import { z } from "zod";
import { tryCatch } from "@/lib/tryCatch";

const configuration = z.object({
  leaderKey: z.string().default("Space"),
  leaderKeyTimeoutMs: z.number().default(1000),
  keybindings: z.record(z.string(), z.string()).default({}),
  editor: z.string().default("nvim"),
});

export type Configuration = z.infer<typeof configuration>;

export class FileNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "FileNotFoundError";
  }
}

export class InvalidJsonError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidJsonError";
  }
}

export class InvalidConfigError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidConfigError";
  }
}

export type ConfigurationInitError =
  | FileNotFoundError
  | InvalidJsonError
  | InvalidConfigError;

export class ConfigurationService {
  static readonly filename = "tablezz/config.json";
  #config: Configuration;

  constructor(config: Configuration) {
    this.#config = config;
  }

  static async init(): Promise<ConfigurationService> {
    const [error, configFile] = await tryCatch(
      readFile(ConfigurationService.filename, {
        baseDir: BaseDirectory.Home,
      }),
    );

    if (error) {
      throw new FileNotFoundError();
    }

    const [jsonError, json] = tryCatch(() =>
      JSON.parse(new TextDecoder().decode(configFile)),
    );

    if (jsonError) {
      throw new InvalidJsonError();
    }

    const parsed = configuration.safeParse(json);
    if (parsed.error) {
      throw new InvalidConfigError(
        `Invalid configuration error: ${z.prettifyError(parsed.error)}`,
      );
    }

    return new ConfigurationService(parsed.data);
  }

  static default() {
    return new ConfigurationService(configuration.parse({}));
  }

  get<T extends keyof Configuration>(path: T) {
    return this.#config[path];
  }
}
