import { loadConfig, getConfigPath, writeDefaultConfig } from "./config";
import { startUI } from "./ui";
import { scan } from "./scanner";
import { defaultInstalledSkillsExportPath, exportInstalledSkills } from "./export";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { Config } from "./types";

interface CliArgs {
  exportInstalled: boolean;
  outputPath: string;
}

function parseArgs(argv: string[]): CliArgs {
  let exportInstalled = false;
  let outputPath: string | undefined;

  const exportFlagIndex = argv.indexOf("--export-installed");
  if (exportFlagIndex >= 0) {
    exportInstalled = true;
    const providedPath = argv[exportFlagIndex + 1];
    if (providedPath && !providedPath.startsWith("-")) {
      outputPath = providedPath;
    }
  }

  const command = argv[0];
  if (command === "export-installed" || command === "export") {
    exportInstalled = true;
    const providedPath = argv[1];
    if (providedPath && !providedPath.startsWith("-")) {
      outputPath = providedPath;
    }
  }

  return {
    exportInstalled,
    outputPath: outputPath || defaultInstalledSkillsExportPath(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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
    if (args.exportInstalled) {
      const skills = await scan(config);
      const outputPath = exportInstalledSkills(skills, args.outputPath);
      const installedCount = skills.filter((skill) => skill.installed).length;
      console.log(
        `Exported ${installedCount} installed skill${installedCount === 1 ? "" : "s"} to ${outputPath}`,
      );
      return;
    }

    await startUI(config);
  } catch (err: any) {
    console.error(err.message || err);
    process.exit(1);
  }
}

main();
