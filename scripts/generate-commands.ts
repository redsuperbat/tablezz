import fs from "node:fs/promises";
import path from "node:path";
import { type ObjectLiteralExpression, Project, SyntaxKind } from "ts-morph";

const GITHUB_REPO = "https://github.com/redsuperbat/tablezz";
const GITHUB_BRANCH = "main";

interface CommandEntry {
  command: string;
  description: string | undefined;
  keybindExpression: string | undefined;
  sourceFile: string;
  line: number;
}

const HOOKS_WITH_KEYBIND = [
  "useRegisterKeybindCommandOnMount",
  "useRegisterKeybindToggle",
  "useRegisterKeybindValue",
];

const HOOKS_COMMAND_ONLY = ["useRegisterCommandOnMount"];

const HOOKS_CONDITIONAL = ["useRegisterKeybindCommandOnConditional"];

function getStringProperty(
  obj: ObjectLiteralExpression,
  name: string,
): string | undefined {
  const prop = obj.getProperty(name);
  if (!prop) return undefined;

  if (prop.isKind(SyntaxKind.PropertyAssignment)) {
    const initializer = prop.getInitializer();
    if (initializer?.isKind(SyntaxKind.StringLiteral)) {
      return initializer.getLiteralValue();
    }
  }
  return undefined;
}

function extractFromObjectLiteral(
  obj: ObjectLiteralExpression,
  sourceFile: string,
  line: number,
  hasKeybind: boolean,
): CommandEntry | undefined {
  const command = getStringProperty(obj, "command");
  if (!command) return undefined;

  return {
    command,
    description: getStringProperty(obj, "description"),
    keybindExpression: hasKeybind
      ? getStringProperty(obj, "keybindExpression")
      : undefined,
    sourceFile,
    line,
  };
}

function extractConditionalEntries(
  obj: ObjectLiteralExpression,
  sourceFile: string,
  line: number,
): CommandEntry[] {
  const entries: CommandEntry[] = [];

  for (const branch of ["true", "false"]) {
    const prop = obj.getProperty(branch);
    if (prop?.isKind(SyntaxKind.PropertyAssignment)) {
      const initializer = prop.getInitializer();
      if (initializer?.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const entry = extractFromObjectLiteral(
          initializer,
          sourceFile,
          line,
          true,
        );
        if (entry) entries.push(entry);
      }
    }
  }

  return entries;
}

async function main() {
  const project = new Project({
    tsConfigFilePath: "tsconfig.json",
  });

  const entries: CommandEntry[] = [];

  for (const sourceFile of project.getSourceFiles("src/**/*.{ts,tsx}")) {
    const relativePath = path.relative(process.cwd(), sourceFile.getFilePath());

    const callExpressions = sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression,
    );

    for (const call of callExpressions) {
      const expr = call.getExpression();
      const funcName = expr.getText();
      const args = call.getArguments();
      const line = call.getStartLineNumber();

      if (args.length === 0) continue;
      const firstArg = args[0];
      if (!firstArg.isKind(SyntaxKind.ObjectLiteralExpression)) continue;

      if (HOOKS_WITH_KEYBIND.includes(funcName)) {
        const entry = extractFromObjectLiteral(
          firstArg,
          relativePath,
          line,
          true,
        );
        if (entry) entries.push(entry);
      } else if (HOOKS_COMMAND_ONLY.includes(funcName)) {
        const entry = extractFromObjectLiteral(
          firstArg,
          relativePath,
          line,
          false,
        );
        if (entry) entries.push(entry);
      } else if (HOOKS_CONDITIONAL.includes(funcName)) {
        const conditionalEntries = extractConditionalEntries(
          firstArg,
          relativePath,
          line,
        );
        entries.push(...conditionalEntries);
      }
    }
  }

  const seen = new Set<string>();
  const uniqueEntries = entries.filter((entry) => {
    if (seen.has(entry.command)) return false;
    seen.add(entry.command);
    return true;
  });

  // Sort alphabetically
  uniqueEntries.sort((a, b) => a.command.localeCompare(b.command));

  // Generate markdown
  const lines: string[] = [
    "# Commands",
    "",
    "This file is auto-generated. Do not edit manually.",
    "",
    "| Command | Description | Keybind | Source |",
    "|---------|-------------|---------|--------|",
  ];

  for (const entry of uniqueEntries) {
    const description = entry.description ?? "";
    const keybind = entry.keybindExpression
      ? `\`${entry.keybindExpression}\``
      : "-";
    const sourceLink = `[${entry.sourceFile}:${entry.line}](${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${entry.sourceFile}#L${entry.line})`;

    lines.push(
      `| ${entry.command} | ${description} | ${keybind} | ${sourceLink} |`,
    );
  }

  lines.push("");

  await fs.mkdir("config", { recursive: true });
  await fs.writeFile("config/commands.md", lines.join("\n"));

  console.log(
    `Generated config/commands.md with ${uniqueEntries.length} commands`,
  );
}

main();
