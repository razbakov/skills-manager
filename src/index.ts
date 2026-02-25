import { getConfigPath, getDefaultSourcesRootPath, loadConfig, writeDefaultConfig, SUPPORTED_IDES, expandTilde } from "./config";
import { scan } from "./scanner";
import { defaultInstalledSkillsExportPath, exportInstalledSkills } from "./export";
import { defaultInstalledSkillsImportPath, importInstalledSkills } from "./import";
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, symlinkSync } from "fs";
import { spawn, spawnSync } from "child_process";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import type { Config } from "./types";
import { updateApp, getAppVersion } from "./updater";
import { encodeSkillSetRequestArg, parseSkillSetRequest } from "./skill-set";
import type { SkillSetRequest } from "./skill-set";
import { shouldUseWslForInstall } from "./platform";

interface CliArgs {
  installCommand: boolean;
  updateCommand: boolean;
  skillSetRequest: SkillSetRequest | null;
  exportInstalled: boolean;
  importInstalled: boolean;
  outputPath: string;
  inputPath: string;
}

function parseArgs(argv: string[]): CliArgs {
  const command = argv[0];
  const skillSetRequest = parseSkillSetRequest(argv);
  const installCommand = argv.includes("--install") || argv[0] === "install";
  const updateCommand = command === "update";
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
    skillSetRequest,
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
  const globalBinDirOverride = process.env.SKILLS_MANAGER_GLOBAL_BIN_DIR?.trim();
  if (globalBinDirOverride) {
    return resolve(expandTilde(globalBinDirOverride));
  }

  const bunInstall = process.env.BUN_INSTALL?.trim();
  if (bunInstall) {
    return resolve(bunInstall, "bin");
  }

  return join(homedir(), ".bun", "bin");
}

function installGlobalCommand(): InstallCommandResult {
  if (shouldUseWslForInstall()) {
    throw new Error(
      "Native Windows install is not supported yet. Run this command from WSL.",
    );
  }

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

function launchElectronUi(skillSetRequest?: SkillSetRequest): void {
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(srcDir, "..");
  ensureUiBundle(projectRoot);
  const electronBin = join(projectRoot, "node_modules", ".bin", "electron");
  if (!existsSync(electronBin)) {
    throw new Error(`Electron binary not found at ${electronBin}. Run bun install and try again.`);
  }

  const env = { ...process.env };
  // Ensure the tsx loader is active for Node/Electron.
  env.NODE_OPTIONS = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} --import tsx` : "--import tsx";
  const electronArgs = ["src/electron/main.ts"];
  if (skillSetRequest) {
    electronArgs.push(encodeSkillSetRequestArg(skillSetRequest));
  }
  const child = spawn(electronBin, electronArgs, {
    cwd: projectRoot,
    stdio: "ignore",
    env,
    detached: true,
  });

  if (!child.pid) {
    throw new Error("Could not launch Electron UI.");
  }

  child.unref();
}

function resolveBunBinary(): string {
  const bunInstall = process.env.BUN_INSTALL?.trim();
  if (bunInstall) {
    const bunPath = resolve(bunInstall, "bin", "bun");
    if (existsSync(bunPath)) {
      return bunPath;
    }
  }

  const homeBunPath = join(homedir(), ".bun", "bin", "bun");
  if (existsSync(homeBunPath)) {
    return homeBunPath;
  }

  return "bun";
}

function ensureUiBundle(projectRoot: string): void {
  const bundleIndex = join(projectRoot, "src", "renderer", "dist", "index.html");
  if (existsSync(bundleIndex)) {
    return;
  }

  const bunBinary = resolveBunBinary();
  const buildResult = spawnSync(bunBinary, ["x", "vite", "build"], {
    cwd: join(projectRoot, "src", "renderer"),
    stdio: "inherit",
    encoding: "utf-8",
  });

  if (buildResult.error) {
    throw new Error(`Could not build UI bundle: ${buildResult.error.message}`);
  }

  if (typeof buildResult.status === "number" && buildResult.status !== 0) {
    throw new Error(`Could not build UI bundle: exited with code ${buildResult.status}.`);
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
  try {
    const args = parseArgs(process.argv.slice(2));

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
        disabledSources: [],
        personalSkillsRepoPrompted: false,
      };

      writeDefaultConfig(defaultConfig);
      console.log(`Config written to ${configPath}`);
      console.log("Edit it to match your setup, then run again.\n");
    }

    if (args.skillSetRequest) {
      const commandInstall = installGlobalCommand();
      if (!commandInstall.alreadyInstalled) {
        console.log(`Installed global command: ${commandInstall.commandPath}`);
      }

      launchElectronUi(args.skillSetRequest);
      console.log("Opened Skills Manager and queued skill set selection.");
      return;
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

    launchElectronUi();
  } catch (err: any) {
    console.error(err.message || err);
    process.exit(1);
  }
}

main();
