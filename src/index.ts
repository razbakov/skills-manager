import { loadConfig, getConfigPath, writeDefaultConfig } from "./config";
import { startUI } from "./ui";
import { scan } from "./scanner";
import { defaultInstalledSkillsExportPath, exportInstalledSkills } from "./export";
import { chmodSync, existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync } from "fs";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import type { Config } from "./types";

interface CliArgs {
  installCommand: boolean;
  exportInstalled: boolean;
  outputPath: string;
}

function parseArgs(argv: string[]): CliArgs {
  const installCommand = argv.includes("--install") || argv[0] === "install";
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
    installCommand,
    exportInstalled,
    outputPath: outputPath || defaultInstalledSkillsExportPath(),
  };
}

interface InstallCommandResult {
  commandPath: string;
  alreadyInstalled: boolean;
}

function resolveGlobalBinDir(): string {
  const bunInstall = process.env.BUN_INSTALL?.trim();
  if (bunInstall) {
    return resolve(bunInstall, "bin");
  }

  return join(homedir(), ".bun", "bin");
}

function installGlobalCommand(): InstallCommandResult {
  const launcherPath = resolve(fileURLToPath(new URL("../bin/skills", import.meta.url)));
  if (!existsSync(launcherPath)) {
    throw new Error(`Launcher script not found at ${launcherPath}`);
  }

  // Ensure the launcher stays executable when symlinked into the global bin.
  chmodSync(launcherPath, 0o755);

  const globalBinDir = resolveGlobalBinDir();
  mkdirSync(globalBinDir, { recursive: true });

  const commandPath = join(globalBinDir, "skills");

  let existingLinkStat: ReturnType<typeof lstatSync> | null = null;
  try {
    existingLinkStat = lstatSync(commandPath);
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      throw err;
    }
  }

  if (existingLinkStat) {
    if (existingLinkStat.isSymbolicLink()) {
      const currentTarget = resolve(dirname(commandPath), readlinkSync(commandPath));
      if (currentTarget === launcherPath) {
        return { commandPath, alreadyInstalled: true };
      }

      throw new Error(
        `Existing symlink at ${commandPath} points to ${currentTarget}. Remove it and retry.`,
      );
    }

    throw new Error(`Path already exists at ${commandPath}. Remove it and retry.`);
  }

  symlinkSync(launcherPath, commandPath);
  return { commandPath, alreadyInstalled: false };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  try {
    if (args.installCommand) {
      const result = installGlobalCommand();
      if (result.alreadyInstalled) {
        console.log(`Global command already installed: ${result.commandPath}`);
      } else {
        console.log(`Installed global command: ${result.commandPath}`);
      }
      return;
    }

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
