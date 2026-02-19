import { loadConfig, getConfigPath, ensureConfigDir, writeDefaultConfig } from "./config";
import { startUI } from "./ui";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { Config } from "./types";

async function main() {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    console.log(`No config found at ${configPath}`);
    console.log("Creating default config...\n");

    const defaultConfig: Config = {
      sources: [
        {
          name: "personal",
          path: join(homedir(), "Projects/skills/.cursor/skills"),
        },
        {
          name: "kitchen",
          path: join(homedir(), "Projects/skills-kitchen"),
          recursive: true,
        },
      ],
      targets: [
        join(homedir(), ".cursor/skills"),
        join(homedir(), ".codex/skills"),
        join(homedir(), ".claude/skills"),
      ],
    };

    writeDefaultConfig(defaultConfig);
    console.log(`Config written to ${configPath}`);
    console.log("Edit it to match your setup, then run again.\n");
  }

  try {
    const config = loadConfig();
    await startUI(config);
  } catch (err: any) {
    console.error(err.message || err);
    process.exit(1);
  }
}

main();
