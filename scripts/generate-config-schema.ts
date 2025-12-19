import fs from "node:fs/promises";
import { jsonschema2md } from "@adobe/jsonschema2md";
import { toJSONSchema } from "zod";
import { configuration } from "../src/config/configuration.ts";

// Main
await fs.mkdir("config", { recursive: true });

const jsonSchema = toJSONSchema(configuration, {
  io: "input",
});

await fs.writeFile("config/schema.json", JSON.stringify(jsonSchema, null, 2));

const { markdown } = jsonschema2md(JSON.parse(JSON.stringify(jsonSchema)), {
  includeReadme: true,
});
const definition = markdown.find((m) => m.fileName === "definition.md");

await fs.writeFile(`config/${definition?.fileName}`, definition?.content ?? "");

console.log("Generated config/schema.json and config/definition.md");
