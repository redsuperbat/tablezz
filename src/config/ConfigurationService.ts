import { BaseDirectory, readFile } from "@tauri-apps/plugin-fs";
import { z } from "zod";

const configuration = z.object({
	databaseUrl: z.string().optional(),
	leaderKey: z.string().default("Space"),
	leaderKeyTimeoutMs: z.number().default(1000),
	keybindings: z.record(z.string(), z.string()).default({}),
});

export type Configuration = z.infer<typeof configuration>;

export class ConfigurationService {
	static readonly filename = "tablezz/config.json";
	#config: Configuration;

	constructor(config: Configuration) {
		this.#config = config;
	}

	static async init(
		onError: (error: string) => void,
	): Promise<ConfigurationService> {
		try {
			const configFile = await readFile(ConfigurationService.filename, {
				baseDir: BaseDirectory.Home,
			});

			const json = JSON.parse(new TextDecoder().decode(configFile));

			return new ConfigurationService(configuration.parse(json));
		} catch (error) {
			console.error(error);
			onError(String(error));
			return new ConfigurationService(configuration.parse({}));
		}
	}

	get<T extends keyof Configuration>(path: T) {
		return this.#config[path];
	}
}
