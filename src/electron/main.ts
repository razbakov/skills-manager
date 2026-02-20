import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawnSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { dirname, isAbsolute, join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { addGitHubSource, disableSkill, enableSkill, installSkill, uninstallSkill } from "../actions";
import { getSourcesRootPath, loadConfig } from "../config";
import { defaultInstalledSkillsExportPath, exportInstalledSkills } from "../export";
import { scan } from "../scanner";
import type { Config, Skill } from "../types";

interface SkillViewModel {
  id: string;
  name: string;
  description: string;
  sourcePath: string;
  sourceName: string;
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

interface Snapshot {
  generatedAt: string;
  exportDefaultPath: string;
  skills: SkillViewModel[];
  installedSkills: SkillViewModel[];
  availableSkills: SkillViewModel[];
  sources: SourceViewModel[];
}

interface SourceListEntry {
  name: string;
  path: string;
  recursive: boolean;
  repoUrl?: string;
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
          name: entry.name,
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
      name: source.name,
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

function getDisplaySourceName(skill: Skill, resolvedSourcesRoot: string): string {
  const sourceName = (skill.sourceName || "").trim();
  if (sourceName && sourceName.toLowerCase() !== "sources") {
    return sourceName;
  }

  const sourcePath = resolve(skill.sourcePath);
  if (isPathWithin(sourcePath, resolvedSourcesRoot)) {
    const rel = relative(resolvedSourcesRoot, sourcePath);
    const packageName = rel.split(/[\\/]/).filter(Boolean)[0];
    if (packageName) {
      return packageName;
    }
  }

  return sourceName || "unknown";
}

function toSkillViewModel(skill: Skill, resolvedSourcesRoot: string): SkillViewModel {
  const sourcePath = resolve(skill.sourcePath);
  return {
    id: sourcePath,
    name: skill.name,
    description: skill.description || "",
    sourcePath,
    sourceName: getDisplaySourceName(skill, resolvedSourcesRoot),
    installName: skill.installName || "",
    installed: skill.installed,
    disabled: skill.disabled,
  };
}

async function createSnapshot(config: Config): Promise<Snapshot> {
  const skills = sortSkillsByName(await scan(config));
  const resolvedSourcesRoot = resolve(getSourcesRootPath(config));
  const allSkillModels = skills.map((skill) => toSkillViewModel(skill, resolvedSourcesRoot));
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

  return {
    generatedAt: new Date().toISOString(),
    exportDefaultPath: defaultInstalledSkillsExportPath(),
    skills: allSkillModels,
    installedSkills: allSkillModels.filter((skill) => skill.installed),
    availableSkills: allSkillModels.filter((skill) => !skill.installed),
    sources,
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
    return { snapshot, sourceName: source.name };
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
}

function createMainWindow(): void {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 620,
    backgroundColor: "#0d1216",
    title: "Skills Manager",
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
