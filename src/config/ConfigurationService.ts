import { z } from "zod";

const configuration = z.object({
	leaderKey: z.string(),
	keybinds: z.object({}).array(),
});

export class ConfigurationService {}
