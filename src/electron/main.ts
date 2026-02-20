import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawnSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { addGitHubSource, disableSkill, enableSkill, installSkill, uninstallSkill } from "../actions";
import { getSourcesRootPath, loadConfig, saveConfig, SUPPORTED_IDES, expandTilde } from "../config";
import { defaultInstalledSkillsExportPath, exportInstalledSkills } from "../export";
import { buildRecommendations, type RecommendationProgressEvent } from "../recommendations";
import { scan } from "../scanner";
import type { Config, Skill } from "../types";
import { updateApp, getAppVersion } from "../index";

interface SkillViewModel {
  id: string;
  name: string;
  description: string;
  sourcePath: string;
  sourceName: string;
  pathLabel: string;
  installName: string;
  installed: boolean;
  disabled: boolean;
}

interface SourceViewModel {
  id: string;
  name: string;
  path: string;
  recursive: boolean;
  repoUrl?: string;
  installedCount: number;
  totalCount: number;
  skills: SkillViewModel[];
}

interface SettingViewModel {
  id: string;
  name: string;
  targetPath: string;
  isTarget: boolean;
  isDetected: boolean;
}

interface Snapshot {
  generatedAt: string;
  exportDefaultPath: string;
  skills: SkillViewModel[];
  installedSkills: SkillViewModel[];
  availableSkills: SkillViewModel[];
  sources: SourceViewModel[];
  settings: SettingViewModel[];
}

interface SourceListEntry {
  name: string;
  path: string;
  recursive: boolean;
  repoUrl?: string;
}

interface RecommendationRequestPayload {
  mode?: unknown;
  projectPath?: unknown;
  limit?: unknown;
}

let mainWindow: BrowserWindow | null = null;
let latestSnapshotSkillIds = new Set<string>();

function sortSkillsByName(list: Skill[]): Skill[] {
  return [...list].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
}

function normalizeRepoUrl(raw: string): string {
  const trimmed = raw.trim();
  const githubSsh = trimmed.match(/^[^@]+@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (githubSsh) {
    return `https://github.com/${githubSsh[1]}/${githubSsh[2]}`;
  }

  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.pathname.endsWith(".git")) {
      parsed.pathname = parsed.pathname.replace(/\.git$/i, "");
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

function getRepoUrl(sourcePath: string): string | null {
  const result = spawnSync(
    "git",
    ["-C", sourcePath, "remote", "get-url", "origin"],
    { encoding: "utf-8" },
  );

  if (result.error || result.status !== 0) {
    return null;
  }

  const rawUrl = result.stdout?.toString().trim();
  if (!rawUrl) {
    return null;
  }

  return normalizeRepoUrl(rawUrl);
}

function isPathWithin(path: string, root: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function getSkillsForSource(source: SourceListEntry, skills: Skill[]): Skill[] {
  const sourceRoot = resolve(source.path);
  const matchedSkills = skills.filter((skill) => {
    const skillPath = resolve(skill.sourcePath);
    if (!isPathWithin(skillPath, sourceRoot)) return false;

    if (source.recursive) return true;

    const rel = relative(sourceRoot, skillPath);
    return rel === "" || (!rel.includes("/") && !rel.includes("\\"));
  });
  return sortSkillsByName(matchedSkills);
}

function getDisplayedSources(config: Config): SourceListEntry[] {
  const rows: SourceListEntry[] = [];
  const seenPaths = new Set<string>();
  const resolvedSourcesRoot = resolve(getSourcesRootPath(config));

  if (existsSync(resolvedSourcesRoot)) {
    try {
      for (const entry of readdirSync(resolvedSourcesRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".")) continue;

        const sourcePath = resolve(join(resolvedSourcesRoot, entry.name));
        if (seenPaths.has(sourcePath)) continue;
        seenPaths.add(sourcePath);
        rows.push({
          name: formatPackageNameAsOwnerRepo(entry.name),
          path: sourcePath,
          recursive: true,
          repoUrl: getRepoUrl(sourcePath) ?? undefined,
        });
      }
    } catch {
      // Ignore inaccessible directories and fall back to configured sources.
    }
  }

  for (const source of config.sources) {
    const sourcePath = resolve(source.path);
    if (sourcePath === resolvedSourcesRoot) continue;
    if (seenPaths.has(sourcePath)) continue;

    seenPaths.add(sourcePath);
    rows.push({
      name: formatPackageNameAsOwnerRepo(source.name),
      path: sourcePath,
      recursive: source.recursive ?? false,
      repoUrl: getRepoUrl(sourcePath) ?? undefined,
    });
  }

  rows.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
  return rows;
}

function formatPackageNameAsOwnerRepo(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^([^@\/]+)@([^@\/]+)$/);
  if (!match) return trimmed;
  const repo = match[1];
  const owner = match[2];
  return `${owner}/${repo}`;
}

function getDisplaySourceName(skill: Skill, resolvedSourcesRoot: string): string {
  const sourceName = (skill.sourceName || "").trim();
  if (sourceName && sourceName.toLowerCase() !== "sources") {
    return formatPackageNameAsOwnerRepo(sourceName);
  }

  const sourcePath = resolve(skill.sourcePath);
  if (isPathWithin(sourcePath, resolvedSourcesRoot)) {
    const rel = relative(resolvedSourcesRoot, sourcePath);
    const packageName = rel.split(/[\\/]/).filter(Boolean)[0];
    if (packageName) {
      return formatPackageNameAsOwnerRepo(packageName);
    }
  }

  return formatPackageNameAsOwnerRepo(sourceName || "unknown");
}

function getSkillPathLabel(skill: Skill, config: Config, resolvedSourcesRoot: string): string {
  const resolvedSkillPath = resolve(skill.sourcePath);

  if (isPathWithin(resolvedSkillPath, resolvedSourcesRoot)) {
    const relParts = relative(resolvedSourcesRoot, resolvedSkillPath).split(/[\\/]/).filter(Boolean);
    if (relParts.length >= 2) {
      return relParts[1];
    }
    if (relParts.length === 1) {
      return relParts[0];
    }
  }

  for (const source of config.sources) {
    const sourceRoot = resolve(source.path);
    if (!isPathWithin(resolvedSkillPath, sourceRoot)) continue;

    const relParts = relative(sourceRoot, resolvedSkillPath).split(/[\\/]/).filter(Boolean);
    if (relParts.length >= 1) {
      return relParts[0];
    }
  }

  return basename(resolvedSkillPath);
}

function toSkillViewModel(skill: Skill, config: Config, resolvedSourcesRoot: string): SkillViewModel {
  const sourcePath = resolve(skill.sourcePath);
  return {
    id: sourcePath,
    name: skill.name,
    description: skill.description || "",
    sourcePath,
    sourceName: getDisplaySourceName(skill, resolvedSourcesRoot),
    pathLabel: getSkillPathLabel(skill, config, resolvedSourcesRoot),
    installName: skill.installName || "",
    installed: skill.installed,
    disabled: skill.disabled,
  };
}

async function createSnapshot(config: Config): Promise<Snapshot> {
  const skills = sortSkillsByName(await scan(config));
  const resolvedSourcesRoot = resolve(getSourcesRootPath(config));
  const allSkillModels = skills.map((skill) => toSkillViewModel(skill, config, resolvedSourcesRoot));
  const skillById = new Map<string, SkillViewModel>();

  for (const skill of allSkillModels) {
    skillById.set(skill.id, skill);
  }
  latestSnapshotSkillIds = new Set(allSkillModels.map((skill) => skill.id));

  const sources = getDisplayedSources(config).map((source) => {
    const sourceSkills = getSkillsForSource(source, skills)
      .map((skill) => skillById.get(resolve(skill.sourcePath)))
      .filter((skill): skill is SkillViewModel => !!skill);

    const installedCount = sourceSkills.filter((skill) => skill.installed).length;
    return {
      id: resolve(source.path),
      name: source.name,
      path: source.path,
      recursive: source.recursive,
      ...(source.repoUrl ? { repoUrl: source.repoUrl } : {}),
      installedCount,
      totalCount: sourceSkills.length,
      skills: sourceSkills,
    };
  });

  const settings = SUPPORTED_IDES.map((ide) => {
    const targetPath = expandTilde(ide.path);
    return {
      id: targetPath,
      name: ide.name,
      targetPath,
      isTarget: config.targets.includes(targetPath),
      isDetected: existsSync(dirname(targetPath)),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    exportDefaultPath: defaultInstalledSkillsExportPath(),
    skills: allSkillModels,
    installedSkills: allSkillModels.filter((skill) => skill.installed),
    availableSkills: allSkillModels.filter((skill) => !skill.installed),
    sources,
    settings,
  };
}

function readSkillMarkdownFromSkillId(skillId: unknown): string {
  if (typeof skillId !== "string" || !skillId.trim()) {
    throw new Error("Missing skill identifier.");
  }

  const resolvedSkillId = resolve(skillId);
  if (!latestSnapshotSkillIds.has(resolvedSkillId)) {
    throw new Error("Skill not found. Refresh and try again.");
  }

  const skillMdPath = join(resolvedSkillId, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    throw new Error("SKILL.md not found for selected skill.");
  }

  try {
    return readFileSync(skillMdPath, "utf-8");
  } catch (err: any) {
    throw new Error(`Could not read SKILL.md: ${err?.message || "Unknown error"}`);
  }
}

function openSkillFolderInCursor(skillId: unknown): void {
  if (typeof skillId !== "string" || !skillId.trim()) {
    throw new Error("Missing skill identifier.");
  }

  const resolvedSkillId = resolve(skillId);
  if (!latestSnapshotSkillIds.has(resolvedSkillId)) {
    throw new Error("Skill not found. Refresh and try again.");
  }

  const skillMdPath = join(resolvedSkillId, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    throw new Error("SKILL.md not found in selected skill folder.");
  }

  const result = spawnSync("cursor", [resolvedSkillId], { encoding: "utf-8" });
  if (result.error) {
    throw new Error(`Could not run cursor: ${result.error.message}`);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    const detail = result.stderr?.toString().trim() || result.stdout?.toString().trim();
    throw new Error(detail || `cursor exited with code ${result.status}.`);
  }
}

function findSkillById(skills: Skill[], skillId: string): Skill | undefined {
  const resolvedSkillId = resolve(skillId);
  return skills.find((skill) => resolve(skill.sourcePath) === resolvedSkillId);
}

function parseRecommendationMode(value: unknown): "standard" | "explore-new" {
  return value === "explore-new" ? "explore-new" : "standard";
}

function parseRecommendationLimit(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(3, Math.min(Math.round(value), 15));
}

async function mutateSkill(
  skillId: unknown,
  mutate: (skill: Skill, config: Config) => void,
): Promise<Snapshot> {
  if (typeof skillId !== "string" || !skillId.trim()) {
    throw new Error("Missing skill identifier.");
  }

  const config = loadConfig();
  const skills = await scan(config);
  const skill = findSkillById(skills, skillId);
  if (!skill) {
    throw new Error("Skill not found. Refresh and try again.");
  }

  mutate(skill, config);
  return createSnapshot(config);
}

function registerIpcHandlers(): void {
  ipcMain.handle("skills:getSnapshot", async () => {
    const config = loadConfig();
    return createSnapshot(config);
  });

  ipcMain.handle("skills:refresh", async () => {
    const config = loadConfig();
    return createSnapshot(config);
  });

  ipcMain.handle("skills:getRecommendations", async (event, payload: RecommendationRequestPayload) => {
    const emitProgress = (progress: RecommendationProgressEvent) => {
      event.sender.send("skills:recommendationProgress", progress);
    };

    emitProgress({
      stage: "scan-skills",
      message: "Scanning skills inventory...",
      percent: 4,
    });

    try {
      const config = loadConfig();
      const skills = await scan(config);
      const mode = parseRecommendationMode(payload?.mode);
      const projectPath =
        typeof payload?.projectPath === "string" && payload.projectPath.trim()
          ? payload.projectPath
          : process.cwd();
      const limit = parseRecommendationLimit(payload?.limit);
      const requestedRecommendations = typeof limit === "number" ? limit : 7;

      emitProgress({
        stage: "scan-skills",
        message: `Scanned ${skills.length} skills.`,
        percent: 12,
        stats: {
          scannedSkills: skills.length,
          requestedRecommendations,
        },
      });

      return await buildRecommendations(
        skills,
        {
          mode,
          scope: "all",
          projectPath,
          ...(typeof limit === "number" ? { limit } : {}),
        },
        {
          onProgress: (progress) => emitProgress(progress),
        },
      );
    } catch (err: any) {
      emitProgress({
        stage: "error",
        message: err?.message || "Could not generate recommendations.",
        percent: 100,
      });
      throw err;
    }
  });

  ipcMain.handle("skills:install", async (_event, skillId: unknown) =>
    mutateSkill(skillId, (skill, config) => installSkill(skill, config)),
  );

  ipcMain.handle("skills:disable", async (_event, skillId: unknown) =>
    mutateSkill(skillId, (skill, config) => disableSkill(skill, config)),
  );

  ipcMain.handle("skills:enable", async (_event, skillId: unknown) =>
    mutateSkill(skillId, (skill, config) => enableSkill(skill, config)),
  );

  ipcMain.handle("skills:uninstall", async (_event, skillId: unknown) =>
    mutateSkill(skillId, (skill, config) => uninstallSkill(skill, config)),
  );

  ipcMain.handle("skills:addSource", async (_event, repoUrl: unknown) => {
    if (typeof repoUrl !== "string" || !repoUrl.trim()) {
      throw new Error("Enter a GitHub repository URL.");
    }

    const config = loadConfig();
    const source = addGitHubSource(repoUrl, config);
    const snapshot = await createSnapshot(config);
    return { snapshot, sourceName: formatPackageNameAsOwnerRepo(source.name) };
  });

  ipcMain.handle("skills:exportInstalled", async () => {
    const config = loadConfig();
    const skills = await scan(config);
    const outputPath = exportInstalledSkills(skills, defaultInstalledSkillsExportPath());
    const installedCount = skills.filter((skill) => skill.installed).length;
    return { outputPath, installedCount };
  });

  ipcMain.handle("skills:getSkillMarkdown", async (_event, skillId: unknown) => {
    return readSkillMarkdownFromSkillId(skillId);
  });

  ipcMain.handle("skills:editSkill", async (_event, skillId: unknown) => {
    openSkillFolderInCursor(skillId);
  });

  ipcMain.handle("shell:openPath", async (_event, targetPath: unknown) => {
    if (typeof targetPath !== "string" || !targetPath.trim()) {
      return;
    }

    const openError = await shell.openPath(targetPath);
    if (openError) {
      throw new Error(openError);
    }
  });

  ipcMain.handle("shell:openExternal", async (_event, targetUrl: unknown) => {
    if (typeof targetUrl !== "string" || !targetUrl.trim()) {
      return;
    }

    await shell.openExternal(targetUrl);
  });

  ipcMain.handle("skills:toggleTarget", async (_event, targetPath: unknown) => {
    if (typeof targetPath !== "string" || !targetPath.trim()) return createSnapshot(loadConfig());
    const config = loadConfig();
    const index = config.targets.indexOf(targetPath);
    if (index >= 0) {
      config.targets.splice(index, 1);
    } else {
      config.targets.push(targetPath);
    }
    saveConfig(config);
    return createSnapshot(config);
  });

  ipcMain.handle("skills:updateApp", async () => {
    const result = updateApp();
    if (result.updated) {
      app.relaunch();
      app.exit(0);
    }
    return result;
  });
}

function createMainWindow(): void {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 620,
    backgroundColor: "#0d1216",
    title: `Skills Manager v${getAppVersion()}`,
    webPreferences: {
      preload: join(currentDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  void mainWindow.loadFile(join(currentDir, "renderer.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

registerIpcHandlers();

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
