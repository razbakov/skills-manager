import { getConfigPath, getDefaultSourcesRootPath, loadConfig, writeDefaultConfig, SUPPORTED_IDES, expandTilde } from "./config";
import { startUI } from "./ui";
import { scan } from "./scanner";
import { defaultInstalledSkillsExportPath, exportInstalledSkills } from "./export";
import { defaultInstalledSkillsImportPath, importInstalledSkills } from "./import";
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, symlinkSync, readFileSync } from "fs";
import { spawnSync } from "child_process";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import type { Config } from "./types";
import { updateApp, getAppVersion } from "./updater";

interface CliArgs {
  installCommand: boolean;
  updateCommand: boolean;
  launchDesktopUi: boolean;
  exportInstalled: boolean;
  importInstalled: boolean;
  outputPath: string;
  inputPath: string;
}

function parseArgs(argv: string[]): CliArgs {
  const command = argv[0];
  const installCommand = argv.includes("--install") || argv[0] === "install";
  const updateCommand = command === "update";
  const launchDesktopUi = command === "ui" || argv.includes("--ui");
  let exportInstalled = false;
  let outputPath: string | undefined;
  let importInstalled = false;
  let inputPath: string | undefined;

  const exportFlagIndex = argv.indexOf("--export-installed");
  if (exportFlagIndex >= 0) {
    exportInstalled = true;
    const providedPath = argv[exportFlagIndex + 1];
    if (providedPath && !providedPath.startsWith("-")) {
      outputPath = providedPath;
    }
  }

  if (command === "export-installed" || command === "export") {
    exportInstalled = true;
    const providedPath = argv[1];
    if (providedPath && !providedPath.startsWith("-")) {
      outputPath = providedPath;
    }
  }

  const importFlagIndex = argv.indexOf("--import-installed");
  if (importFlagIndex >= 0) {
    importInstalled = true;
    const providedPath = argv[importFlagIndex + 1];
    if (providedPath && !providedPath.startsWith("-")) {
      inputPath = providedPath;
    }
  }

  const genericImportFlagIndex = argv.indexOf("--import");
  if (genericImportFlagIndex >= 0) {
    importInstalled = true;
    const providedPath = argv[genericImportFlagIndex + 1];
    if (providedPath && !providedPath.startsWith("-")) {
      inputPath = providedPath;
    }
  }

  if (command === "import-installed" || command === "import") {
    importInstalled = true;
    const providedPath = argv[1];
    if (providedPath && !providedPath.startsWith("-")) {
      inputPath = providedPath;
    }
  }

  return {
    installCommand,
    updateCommand,
    launchDesktopUi,
    exportInstalled,
    importInstalled,
    outputPath: outputPath || defaultInstalledSkillsExportPath(),
    inputPath: inputPath || defaultInstalledSkillsImportPath(),
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

function launchElectronUi(): void {
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(srcDir, "..");
  const electronBin = join(projectRoot, "node_modules", ".bin", "electron");

  const env = { ...process.env };
  // Ensure the tsx loader is active for Node/Electron 
  env.NODE_OPTIONS = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} --import tsx` : "--import tsx";

  const result = spawnSync(electronBin, ["src/electron/main.ts"], {
    cwd: projectRoot,
    stdio: "inherit",
    env,
  });

  if (result.error) {
    throw new Error(`Could not launch Electron UI: ${result.error.message}`);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`Electron UI exited with code ${result.status}.`);
  }
}

function defaultSourceNameFromDirectory(dirName: string): string {
  return dirName.replace(/\.git$/i, "");
}

function buildDefaultSources(): Config["sources"] {
  const sources: Config["sources"] = [];
  const seenPaths = new Set<string>();
  const sourcesRoot = resolve(getDefaultSourcesRootPath());

  function addSource(name: string, path: string, recursive: boolean = false): void {
    const resolvedPath = resolve(path);
    if (seenPaths.has(resolvedPath)) return;
    seenPaths.add(resolvedPath);
    sources.push({ name, path: resolvedPath, ...(recursive ? { recursive: true } : {}) });
  }

  if (existsSync(sourcesRoot)) {
    try {
      for (const entry of readdirSync(sourcesRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".")) continue;
        addSource(defaultSourceNameFromDirectory(entry.name), join(sourcesRoot, entry.name), true);
      }
    } catch {
      // Keep defaults resilient if the root is inaccessible.
    }
  }

  const personalPath = join(homedir(), "Projects/skills/.cursor/skills");
  if (existsSync(personalPath)) {
    addSource("personal", personalPath, false);
  }

  if (sources.length === 0) {
    addSource("sources", sourcesRoot, true);
  }

  return sources.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
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

    if (args.updateCommand) {
      console.log(`[Skills Manager v${getAppVersion()}] Updating...`);
      const result = updateApp();
      console.log(result.message);
      if (result.updated) {
        console.log(`Successfully updated to v${result.version}`);
        // Explicitly exit with the new version printed as the "restart" terminal header effect
        process.exit(0);
      }
      return;
    }

    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
      console.log(`No config found at ${configPath}`);
      console.log("Creating default config...\n");

      const defaultConfig: Config = {
        sources: buildDefaultSources(),
        targets: SUPPORTED_IDES.map((ide) => expandTilde(ide.path)).filter((targetPath) =>
          existsSync(dirname(targetPath)),
        ),
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

    if (args.importInstalled) {
      const result = await importInstalledSkills(config, args.inputPath);
      console.log(
        `Imported ${result.installed} skill${result.installed === 1 ? "" : "s"} from ${result.inputPath}`,
      );
      console.log(
        `Requested: ${result.requested}, already installed: ${result.alreadyInstalled}, added sources: ${result.addedSources}`,
      );
      if (result.missingRepoUrl > 0) {
        console.log(`Skipped (missing repo URL): ${result.missingRepoUrl}`);
      }
      if (result.unsupportedRepoUrl > 0) {
        console.log(`Skipped (unsupported repo URL): ${result.unsupportedRepoUrl}`);
      }
      if (result.missingSkills.length > 0) {
        console.log(`Not found in scanned sources: ${result.missingSkills.join(", ")}`);
      }
      return;
    }

    if (args.launchDesktopUi) {
      launchElectronUi();
      return;
    }

    await startUI(config);
  } catch (err: any) {
    console.error(err.message || err);
    process.exit(1);
  }
}

main();
