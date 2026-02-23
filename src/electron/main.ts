import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "electron";
import { spawnSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "path";
import { fileURLToPath } from "url";
import {
  addGitHubSource,
  adoptSkill,
  cleanupBrokenTargetSymlinks,
  cleanupInvalidSourceEntries,
  disableSkill,
  disableSource,
  enableSkill,
  enableSource,
  fixPartialInstalls,
  installSkill,
  removeSource,
  uninstallSkill,
} from "../actions";
import {
  ensurePersonalSkillsRepoSource,
  getSourcesRootPath,
  loadConfig,
  saveConfig,
  SUPPORTED_IDES,
  SUGGESTED_SOURCES,
  expandTilde,
} from "../config";
import {
  defaultInstalledSkillsExportPath,
  exportInstalledSkills,
} from "../export";
import {
  defaultInstalledSkillsImportPath,
  importInstalledSkills,
  previewInstalledSkillsManifest,
} from "../import";
import {
  buildRecommendations,
  type RecommendationProgressEvent,
} from "../recommendations";
import { loadSavedSkillReview, reviewSkill } from "../skill-review";
import {
  findSkillGroupByName,
  getSkillGroupNamesForSkillId,
  normalizeActiveGroups,
  normalizeSkillGroupName,
  normalizeSkillGroups,
  planSkillGroupToggle,
} from "../skill-groups";
import { scan } from "../scanner";
import { buildActiveBudgetSummary, buildGroupBudgetSummary } from "../token-budget";
import type { Config, Skill } from "../types";
import { updateApp, getAppVersion } from "../updater";

interface TargetLabel {
  name: string;
  status: "installed" | "disabled";
}

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
  partiallyInstalled: boolean;
  unmanaged: boolean;
  targetLabels: TargetLabel[];
  groupNames: string[];
}

interface SourceViewModel {
  id: string;
  name: string;
  path: string;
  recursive: boolean;
  repoUrl?: string;
  enabled: boolean;
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

interface SuggestedSourceViewModel {
  name: string;
  url: string;
}

interface PersonalRepoViewModel {
  configured: boolean;
  path: string;
  exists: boolean;
  isGitRepo: boolean;
}

interface SkillGroupViewModel {
  name: string;
  skillCount: number;
  active: boolean;
  skillIds: string[];
  isAuto: boolean;
  enabledCount: number;
  estimatedTokens: number;
  budgetMethod: string;
}

interface Snapshot {
  generatedAt: string;
  exportDefaultPath: string;
  activeBudget: {
    enabledCount: number;
    estimatedTokens: number;
    method: string;
  };
  skillGroups: SkillGroupViewModel[];
  activeGroups: string[];
  skills: SkillViewModel[];
  installedSkills: SkillViewModel[];
  availableSkills: SkillViewModel[];
  sources: SourceViewModel[];
  suggestedSources: SuggestedSourceViewModel[];
  settings: SettingViewModel[];
  personalRepo: PersonalRepoViewModel;
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

interface ImportInstalledPayload {
  inputPath?: unknown;
  selectedIndexes?: unknown;
}

interface ExportSkillGroupPayload {
  name?: unknown;
}

interface CreateSkillGroupPayload {
  name?: unknown;
}

interface ToggleSkillGroupPayload {
  name?: unknown;
  active?: unknown;
}

interface RenameSkillGroupPayload {
  name?: unknown;
  nextName?: unknown;
}

interface DeleteSkillGroupPayload {
  name?: unknown;
}

interface UpdateSkillGroupMembershipPayload {
  groupName?: unknown;
  skillId?: unknown;
  member?: unknown;
}

const TARGET_NAME_MAP = new Map<string, string>(
  SUPPORTED_IDES.map((ide) => [expandTilde(ide.path), ide.name]),
);
const INSTALLED_GROUP_NAME = "Installed";

let mainWindow: BrowserWindow | null = null;
let latestSnapshotSkillIds = new Set<string>();

function getGitRepoRoot(candidatePath: string): string | null {
  const result = spawnSync(
    "git",
    ["-C", candidatePath, "rev-parse", "--show-toplevel"],
    { encoding: "utf-8" },
  );
  if (result.error || result.status !== 0) {
    return null;
  }

  const rootPath = result.stdout?.toString().trim();
  if (!rootPath) return null;
  return resolve(rootPath);
}

function buildPersonalRepoViewModel(config: Config): PersonalRepoViewModel {
  const repoPath = config.personalSkillsRepo
    ? resolve(config.personalSkillsRepo)
    : "";

  if (!repoPath) {
    return {
      configured: false,
      path: "",
      exists: false,
      isGitRepo: false,
    };
  }

  const exists = existsSync(repoPath);
  const repoRoot = exists ? getGitRepoRoot(repoPath) : null;

  return {
    configured: true,
    path: repoPath,
    exists,
    isGitRepo: Boolean(repoRoot && resolve(repoRoot) === repoPath),
  };
}

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
  const githubSsh = trimmed.match(
    /^[^@]+@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i,
  );
  if (githubSsh) {
    return `https://github.com/${githubSsh[1]}/${githubSsh[2]}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.pathname.endsWith(".git")
    ) {
      parsed.pathname = parsed.pathname.replace(/\.git$/i, "");
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

function parseGitHubSourceName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const githubSsh = trimmed.match(
    /^[^@]+@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i,
  );
  if (githubSsh) {
    const owner = githubSsh[1];
    const repo = githubSsh[2].replace(/\.git$/i, "");
    if (!owner || !repo) return null;
    return `${repo}@${owner}`;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") {
      return null;
    }

    const segments = parsed.pathname
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
    if (segments.length !== 2) return null;

    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/i, "");
    if (!owner || !repo) return null;
    return `${repo}@${owner}`;
  } catch {
    return null;
  }
}

function removePersonalRepoSourceAlias(config: Config, repoPath: string | null): void {
  if (!repoPath) return;
  const resolvedRepoPath = resolve(repoPath);
  config.sources = config.sources.filter((source) => {
    const sourcePath = resolve(source.path);
    const sourceName = source.name.trim().toLowerCase();
    return !(sourcePath === resolvedRepoPath && sourceName === "personal");
  });
}

function findExistingGitHubSource(
  config: Config,
  repoUrl: string,
): SourceListEntry | null {
  const displayedSources = getDisplayedSources(config);
  const normalizedTargetUrl = normalizeRepoUrl(repoUrl).toLowerCase();

  const matchedByUrl = displayedSources.find(
    (source) =>
      !!source.repoUrl &&
      normalizeRepoUrl(source.repoUrl).toLowerCase() === normalizedTargetUrl,
  );
  if (matchedByUrl) {
    return matchedByUrl;
  }

  const sourceName = parseGitHubSourceName(repoUrl);
  if (!sourceName) return null;
  const sourceNameLower = sourceName.toLowerCase();
  const formattedNameLower = formatPackageNameAsOwnerRepo(sourceName).toLowerCase();

  const matchedByName = displayedSources.find((source) => {
    const lowered = source.name.trim().toLowerCase();
    return lowered === sourceNameLower || lowered === formattedNameLower;
  });
  return matchedByName || null;
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
      for (const entry of readdirSync(resolvedSourcesRoot, {
        withFileTypes: true,
      })) {
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

function getDisplaySourceName(
  skill: Skill,
  resolvedSourcesRoot: string,
): string {
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

function getSkillPathLabel(
  skill: Skill,
  config: Config,
  resolvedSourcesRoot: string,
): string {
  const resolvedSkillPath = resolve(skill.sourcePath);

  if (isPathWithin(resolvedSkillPath, resolvedSourcesRoot)) {
    const relParts = relative(resolvedSourcesRoot, resolvedSkillPath)
      .split(/[\\/]/)
      .filter(Boolean);
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

    const relParts = relative(sourceRoot, resolvedSkillPath)
      .split(/[\\/]/)
      .filter(Boolean);
    if (relParts.length >= 1) {
      return relParts[0];
    }
  }

  return basename(resolvedSkillPath);
}

function toSkillViewModel(
  skill: Skill,
  config: Config,
  resolvedSourcesRoot: string,
  skillGroups: { name: string; skillIds: string[] }[],
): SkillViewModel {
  const sourcePath = resolve(skill.sourcePath);

  const targetLabels: TargetLabel[] = [];
  for (const targetPath of config.targets) {
    const status = skill.targetStatus[targetPath];
    if (status === "installed" || status === "disabled") {
      const ideName = TARGET_NAME_MAP.get(targetPath) || basename(targetPath);
      targetLabels.push({ name: ideName, status });
    }
  }

  const partiallyInstalled =
    config.targets.length > 1 &&
    skill.installed &&
    !skill.disabled &&
    !config.targets.every((t) => skill.targetStatus[t] === "installed");

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
    partiallyInstalled,
    unmanaged: skill.unmanaged,
    targetLabels,
    groupNames: getSkillGroupNamesForSkillId(skillGroups, sourcePath),
  };
}

function isSourceDisabled(sourcePath: string, config: Config): boolean {
  const resolved = resolve(sourcePath);
  return config.disabledSources.some((p) => resolve(p) === resolved);
}

function isSkillUnderDisabledSource(skill: Skill, config: Config): boolean {
  for (const disabledPath of config.disabledSources) {
    const resolved = resolve(disabledPath);
    const skillResolved = resolve(skill.sourcePath);
    if (
      skillResolved === resolved ||
      skillResolved.startsWith(resolved + "/")
    ) {
      return true;
    }
  }
  return false;
}

function visibleSkillsFromScan(
  allScannedSkills: Skill[],
  config: Config,
): Skill[] {
  return allScannedSkills.filter(
    (skill) => !isSkillUnderDisabledSource(skill, config),
  );
}

function normalizedGroups(config: Config): { name: string; skillIds: string[] }[] {
  return normalizeSkillGroups(config.skillGroups || []);
}

function isInstalledAutoGroupName(rawName: string): boolean {
  return (
    normalizeSkillGroupName(rawName).toLowerCase() ===
    INSTALLED_GROUP_NAME.toLowerCase()
  );
}

function normalizedActiveGroupNames(
  config: Config,
  groups: { name: string; skillIds: string[] }[],
): string[] {
  return normalizeActiveGroups(config.activeGroups || [], groups);
}

function sortedSkillGroupModels(
  groups: { name: string; skillIds: string[] }[],
  activeGroups: string[],
  installedSkillsById: Map<string, Skill>,
): SkillGroupViewModel[] {
  const activeLower = new Set(activeGroups.map((name) => name.toLowerCase()));
  return groups.map((group) => {
    const installedMembers = group.skillIds.filter((skillId) =>
      installedSkillsById.has(skillId),
    );
    const memberSkills = installedMembers
      .map((skillId) => installedSkillsById.get(skillId))
      .filter((skill): skill is Skill => !!skill);
    const budget = buildGroupBudgetSummary(memberSkills);
    return {
      name: group.name,
      skillCount: installedMembers.length,
      active: activeLower.has(group.name.toLowerCase()),
      skillIds: installedMembers,
      isAuto: false,
      enabledCount: budget.enabledCount,
      estimatedTokens: budget.estimatedTokens,
      budgetMethod: budget.method,
    };
  });
}

function buildInstalledAutoGroupModel(
  installedSkillModels: SkillViewModel[],
  installedBudget: {
    enabledCount: number;
    estimatedTokens: number;
    method: string;
  },
): SkillGroupViewModel {
  const skillIds = installedSkillModels.map((skill) => skill.id);
  return {
    name: INSTALLED_GROUP_NAME,
    skillCount: skillIds.length,
    active: skillIds.length > 0 && installedBudget.enabledCount === skillIds.length,
    skillIds,
    isAuto: true,
    enabledCount: installedBudget.enabledCount,
    estimatedTokens: installedBudget.estimatedTokens,
    budgetMethod: installedBudget.method,
  };
}

function defaultSkillGroupExportPath(groupName: string, cwd: string = process.cwd()): string {
  const normalized = normalizeSkillGroupName(groupName);
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const baseName = slug ? `${slug}-skills.json` : "skill-group-skills.json";
  return resolve(cwd, baseName);
}

async function createSnapshot(config: Config): Promise<Snapshot> {
  const allScannedSkills = sortSkillsByName(await scan(config));
  const skills = visibleSkillsFromScan(allScannedSkills, config);
  const groups = normalizedGroups(config);
  const activeGroups = normalizedActiveGroupNames(config, groups);
  const resolvedSourcesRoot = resolve(getSourcesRootPath(config));
  const allSkillModels = skills.map((skill) =>
    toSkillViewModel(skill, config, resolvedSourcesRoot, groups),
  );
  const skillById = new Map<string, SkillViewModel>();

  for (const skill of allSkillModels) {
    skillById.set(skill.id, skill);
  }
  latestSnapshotSkillIds = new Set(allSkillModels.map((skill) => skill.id));

  const sources = getDisplayedSources(config).map((source) => {
    const enabled = !isSourceDisabled(source.path, config);
    const sourceSkills = getSkillsForSource(
      source,
      enabled ? skills : allScannedSkills,
    )
      .map(
        (skill) =>
          skillById.get(resolve(skill.sourcePath)) ||
          toSkillViewModel(skill, config, resolvedSourcesRoot, groups),
      )
      .filter((skill): skill is SkillViewModel => !!skill);

    const installedCount = sourceSkills.filter(
      (skill) => skill.installed,
    ).length;
    return {
      id: resolve(source.path),
      name: source.name,
      path: source.path,
      recursive: source.recursive,
      ...(source.repoUrl ? { repoUrl: source.repoUrl } : {}),
      enabled,
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

  const existingUrls = new Set(
    sources
      .map((s) => s.repoUrl)
      .filter((url): url is string => !!url)
      .map((url) => normalizeRepoUrl(url)),
  );

  const suggestedSources = SUGGESTED_SOURCES.filter(
    (s) => !existingUrls.has(normalizeRepoUrl(s.url)),
  ).map((s) => ({ name: s.name, url: s.url }));

  const personalRepo = buildPersonalRepoViewModel(config);
  const activeBudget = buildActiveBudgetSummary(skills);
  const installedSkills = skills.filter((skill) => skill.installed);
  const installedBudget = buildGroupBudgetSummary(installedSkills);
  const installedSkillsById = new Map(
    installedSkills.map((skill) => [resolve(skill.sourcePath), skill]),
  );
  const installedSkillModels = allSkillModels.filter((skill) => skill.installed);
  const skillGroups = [
    buildInstalledAutoGroupModel(installedSkillModels, installedBudget),
    ...sortedSkillGroupModels(groups, activeGroups, installedSkillsById),
  ];

  return {
    generatedAt: new Date().toISOString(),
    exportDefaultPath: defaultInstalledSkillsExportPath(),
    activeBudget,
    skillGroups,
    activeGroups,
    skills: allSkillModels,
    installedSkills: installedSkillModels,
    availableSkills: allSkillModels.filter((skill) => !skill.installed),
    sources,
    suggestedSources,
    settings,
    personalRepo,
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
    throw new Error(
      `Could not read SKILL.md: ${err?.message || "Unknown error"}`,
    );
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
    const detail =
      result.stderr?.toString().trim() || result.stdout?.toString().trim();
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

function parseSkillGroupName(value: unknown): string {
  if (typeof value !== "string") return "";
  return normalizeSkillGroupName(value);
}

function writeSkillGroupState(
  config: Config,
  groups: { name: string; skillIds: string[] }[],
  activeGroups: string[],
): void {
  if (groups.length > 0) {
    config.skillGroups = groups;
  } else {
    delete config.skillGroups;
  }

  if (activeGroups.length > 0) {
    config.activeGroups = activeGroups;
  } else {
    delete config.activeGroups;
  }
}

function setAllInstalledSkillsEnabled(
  skills: Skill[],
  config: Config,
  enabled: boolean,
): void {
  for (const skill of skills) {
    if (!skill.installed) continue;
    if (enabled) {
      if (skill.disabled) {
        enableSkill(skill, config);
      }
      continue;
    }

    if (!skill.disabled) {
      disableSkill(skill, config);
    }
  }
}

function isSkillCoveredByActiveGroups(
  groups: { name: string; skillIds: string[] }[],
  activeGroups: string[],
  skillId: string,
): boolean {
  const activeLower = new Set(activeGroups.map((name) => name.toLowerCase()));
  return groups.some(
    (group) =>
      activeLower.has(group.name.toLowerCase()) &&
      group.skillIds.includes(skillId),
  );
}

async function createSkillGroup(payload: CreateSkillGroupPayload): Promise<{
  snapshot: Snapshot;
  groupName: string;
}> {
  const groupName = parseSkillGroupName(payload?.name);
  if (!groupName) {
    throw new Error("Enter a group name.");
  }
  if (isInstalledAutoGroupName(groupName)) {
    throw new Error(`"${INSTALLED_GROUP_NAME}" is reserved.`);
  }

  const config = loadConfig();
  const groups = normalizedGroups(config);
  if (findSkillGroupByName(groups, groupName)) {
    throw new Error("Group already exists.");
  }

  const updatedGroups = normalizeSkillGroups([
    ...groups,
    { name: groupName, skillIds: [] },
  ]);
  const activeGroups = normalizedActiveGroupNames(config, updatedGroups);
  writeSkillGroupState(config, updatedGroups, activeGroups);
  saveConfig(config);

  const created = findSkillGroupByName(updatedGroups, groupName);
  const snapshot = await createSnapshot(config);
  return {
    snapshot,
    groupName: created ? created.name : groupName,
  };
}

async function toggleSkillGroup(payload: ToggleSkillGroupPayload): Promise<{
  snapshot: Snapshot;
  groupName: string;
  active: boolean;
  skippedMissing: number;
}> {
  const requestedName = parseSkillGroupName(payload?.name);
  if (!requestedName) {
    throw new Error("Select a group.");
  }
  if (typeof payload?.active !== "boolean") {
    throw new Error("Missing group state.");
  }

  const config = loadConfig();
  const allScannedSkills = await scan(config);
  const skills = visibleSkillsFromScan(allScannedSkills, config);
  const groups = normalizedGroups(config);
  if (isInstalledAutoGroupName(requestedName)) {
    setAllInstalledSkillsEnabled(skills, config, payload.active);
    writeSkillGroupState(
      config,
      groups,
      payload.active ? groups.map((group) => group.name) : [],
    );
    saveConfig(config);
    return {
      snapshot: await createSnapshot(config),
      groupName: INSTALLED_GROUP_NAME,
      active: payload.active,
      skippedMissing: 0,
    };
  }

  const selectedGroup = findSkillGroupByName(groups, requestedName);
  if (!selectedGroup) {
    throw new Error("Group not found.");
  }

  const plan = planSkillGroupToggle(
    skills,
    groups,
    config.activeGroups || [],
    selectedGroup.name,
    payload.active,
  );
  for (const skill of plan.toEnable) {
    enableSkill(skill, config);
  }
  for (const skill of plan.toDisable) {
    disableSkill(skill, config);
  }

  writeSkillGroupState(config, groups, plan.activeGroups);
  saveConfig(config);
  return {
    snapshot: await createSnapshot(config),
    groupName: selectedGroup.name,
    active: payload.active,
    skippedMissing: plan.missingSkillIds.length,
  };
}

async function renameSkillGroup(payload: RenameSkillGroupPayload): Promise<{
  snapshot: Snapshot;
  groupName: string;
}> {
  const requestedName = parseSkillGroupName(payload?.name);
  const nextName = parseSkillGroupName(payload?.nextName);
  if (!requestedName) {
    throw new Error("Select a group.");
  }
  if (!nextName) {
    throw new Error("Enter a group name.");
  }
  if (isInstalledAutoGroupName(nextName)) {
    throw new Error(`"${INSTALLED_GROUP_NAME}" is reserved.`);
  }

  const config = loadConfig();
  const groups = normalizedGroups(config);
  const selectedGroup = findSkillGroupByName(groups, requestedName);
  if (!selectedGroup) {
    throw new Error("Group not found.");
  }

  const duplicate = findSkillGroupByName(groups, nextName);
  if (
    duplicate &&
    duplicate.name.toLowerCase() !== selectedGroup.name.toLowerCase()
  ) {
    throw new Error("A group with this name already exists.");
  }

  const updatedGroups = normalizeSkillGroups(
    groups.map((group) =>
      group.name.toLowerCase() === selectedGroup.name.toLowerCase()
        ? { name: nextName, skillIds: group.skillIds }
        : group
    ),
  );
  const renamed = findSkillGroupByName(updatedGroups, nextName);
  if (!renamed) {
    throw new Error("Could not rename group.");
  }

  const currentActive = normalizedActiveGroupNames(config, groups);
  const remappedActive = currentActive.map((activeName) =>
    activeName.toLowerCase() === selectedGroup.name.toLowerCase()
      ? renamed.name
      : activeName
  );
  const activeGroups = normalizeActiveGroups(remappedActive, updatedGroups);

  writeSkillGroupState(config, updatedGroups, activeGroups);
  saveConfig(config);
  return {
    snapshot: await createSnapshot(config),
    groupName: renamed.name,
  };
}

async function deleteSkillGroup(payload: DeleteSkillGroupPayload): Promise<{
  snapshot: Snapshot;
  deletedGroup: string;
}> {
  const requestedName = parseSkillGroupName(payload?.name);
  if (!requestedName) {
    throw new Error("Select a group.");
  }

  const config = loadConfig();
  const groups = normalizedGroups(config);
  const selectedGroup = findSkillGroupByName(groups, requestedName);
  if (!selectedGroup) {
    throw new Error("Group not found.");
  }

  const updatedGroups = groups.filter(
    (group) => group.name.toLowerCase() !== selectedGroup.name.toLowerCase(),
  );
  const activeGroups = normalizeActiveGroups(
    (config.activeGroups || []).filter(
      (name) => name.toLowerCase() !== selectedGroup.name.toLowerCase(),
    ),
    updatedGroups,
  );

  writeSkillGroupState(config, updatedGroups, activeGroups);
  saveConfig(config);
  return {
    snapshot: await createSnapshot(config),
    deletedGroup: selectedGroup.name,
  };
}

async function updateSkillGroupMembership(
  payload: UpdateSkillGroupMembershipPayload,
): Promise<{
  snapshot: Snapshot;
  groupName: string;
  member: boolean;
}> {
  const requestedGroupName = parseSkillGroupName(payload?.groupName);
  if (!requestedGroupName) {
    throw new Error("Select a group.");
  }
  if (isInstalledAutoGroupName(requestedGroupName)) {
    throw new Error("This group is managed automatically.");
  }
  if (typeof payload?.member !== "boolean") {
    throw new Error("Missing membership state.");
  }
  if (typeof payload?.skillId !== "string" || !payload.skillId.trim()) {
    throw new Error("Missing skill identifier.");
  }

  const resolvedSkillId = resolve(payload.skillId);
  const config = loadConfig();
  const groups = normalizedGroups(config);
  const selectedGroup = findSkillGroupByName(groups, requestedGroupName);
  if (!selectedGroup) {
    throw new Error("Group not found.");
  }

  const activeGroups = normalizedActiveGroupNames(config, groups);
  const coveredBefore = isSkillCoveredByActiveGroups(
    groups,
    activeGroups,
    resolvedSkillId,
  );

  const updatedGroups = normalizeSkillGroups(
    groups.map((group) => {
      if (group.name.toLowerCase() !== selectedGroup.name.toLowerCase()) {
        return group;
      }
      const ids = new Set(group.skillIds);
      if (payload.member) {
        ids.add(resolvedSkillId);
      } else {
        ids.delete(resolvedSkillId);
      }
      return {
        name: group.name,
        skillIds: Array.from(ids).sort((a, b) =>
          a.localeCompare(b, undefined, {
            sensitivity: "base",
            numeric: true,
          }),
        ),
      };
    }),
  );
  const normalizedActive = normalizeActiveGroups(activeGroups, updatedGroups);
  const coveredAfter = isSkillCoveredByActiveGroups(
    updatedGroups,
    normalizedActive,
    resolvedSkillId,
  );

  const allScannedSkills = await scan(config);
  const skills = visibleSkillsFromScan(allScannedSkills, config);
  const skill = findSkillById(skills, resolvedSkillId);
  if (skill?.installed) {
    if (!coveredBefore && coveredAfter && skill.disabled) {
      enableSkill(skill, config);
    } else if (coveredBefore && !coveredAfter && !skill.disabled) {
      disableSkill(skill, config);
    }
  }

  writeSkillGroupState(config, updatedGroups, normalizedActive);
  saveConfig(config);
  return {
    snapshot: await createSnapshot(config),
    groupName: selectedGroup.name,
    member: payload.member,
  };
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
    const sourceCleanup = cleanupInvalidSourceEntries(config);
    if (
      sourceCleanup.removedSources > 0 ||
      sourceCleanup.removedDisabledSources > 0 ||
      sourceCleanup.clearedPersonalRepo
    ) {
      saveConfig(config);
    }
    cleanupBrokenTargetSymlinks(config);
    const skills = await scan(config);
    fixPartialInstalls(skills, config);
    return createSnapshot(config);
  });

  ipcMain.handle(
    "skills:getRecommendations",
    async (event, payload: RecommendationRequestPayload) => {
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
    },
  );

  ipcMain.handle("skills:reviewSkill", async (_event, skillId: unknown) => {
    if (typeof skillId !== "string" || !skillId.trim()) {
      throw new Error("Missing skill identifier.");
    }

    const config = loadConfig();
    const skills = await scan(config);
    const skill = findSkillById(skills, skillId);
    if (!skill) {
      throw new Error("Skill not found. Refresh and try again.");
    }

    return reviewSkill(skill, { projectPath: process.cwd() });
  });

  ipcMain.handle("skills:getSkillReview", async (_event, skillId: unknown) => {
    if (typeof skillId !== "string" || !skillId.trim()) {
      throw new Error("Missing skill identifier.");
    }

    const resolvedSkillId = resolve(skillId);
    if (!latestSnapshotSkillIds.has(resolvedSkillId)) {
      throw new Error("Skill not found. Refresh and try again.");
    }

    return loadSavedSkillReview(resolvedSkillId);
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

  ipcMain.handle(
    "skills:createSkillGroup",
    async (_event, payload: CreateSkillGroupPayload) =>
      createSkillGroup(payload),
  );

  ipcMain.handle(
    "skills:toggleSkillGroup",
    async (_event, payload: ToggleSkillGroupPayload) =>
      toggleSkillGroup(payload),
  );

  ipcMain.handle(
    "skills:renameSkillGroup",
    async (_event, payload: RenameSkillGroupPayload) =>
      renameSkillGroup(payload),
  );

  ipcMain.handle(
    "skills:deleteSkillGroup",
    async (_event, payload: DeleteSkillGroupPayload) =>
      deleteSkillGroup(payload),
  );

  ipcMain.handle(
    "skills:updateSkillGroupMembership",
    async (_event, payload: UpdateSkillGroupMembershipPayload) =>
      updateSkillGroupMembership(payload),
  );

  ipcMain.handle("skills:adopt", async (_event, skillId: unknown) => {
    if (typeof skillId !== "string" || !skillId.trim()) {
      throw new Error("Missing skill identifier.");
    }

    const config = loadConfig();
    const skills = await scan(config);
    const skill = findSkillById(skills, skillId);
    if (!skill) {
      throw new Error("Skill not found. Refresh and try again.");
    }

    const adoption = adoptSkill(skill, config, getSourcesRootPath(config));
    const snapshot = await createSnapshot(config);
    return { snapshot, adoption };
  });

  ipcMain.handle("skills:addSource", async (_event, repoUrl: unknown) => {
    if (typeof repoUrl !== "string" || !repoUrl.trim()) {
      throw new Error("Enter a GitHub repository URL.");
    }

    const config = loadConfig();
    const source = addGitHubSource(repoUrl, config);
    const snapshot = await createSnapshot(config);
    return { snapshot, sourceName: formatPackageNameAsOwnerRepo(source.name) };
  });

  ipcMain.handle("skills:disableSource", async (_event, sourceId: unknown) => {
    if (typeof sourceId !== "string" || !sourceId.trim()) {
      throw new Error("Missing source identifier.");
    }
    const config = loadConfig();
    disableSource(sourceId, config);
    return createSnapshot(config);
  });

  ipcMain.handle("skills:enableSource", async (_event, sourceId: unknown) => {
    if (typeof sourceId !== "string" || !sourceId.trim()) {
      throw new Error("Missing source identifier.");
    }
    const config = loadConfig();
    enableSource(sourceId, config);
    return createSnapshot(config);
  });

  ipcMain.handle("skills:removeSource", async (_event, sourceId: unknown) => {
    if (typeof sourceId !== "string" || !sourceId.trim()) {
      throw new Error("Missing source identifier.");
    }
    const config = loadConfig();
    const skills = await scan(config);
    removeSource(sourceId, config, skills);
    return createSnapshot(config);
  });

  ipcMain.handle("skills:exportInstalled", async () => {
    const defaultPath = defaultInstalledSkillsExportPath();
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const saveDialogOptions: SaveDialogOptions = {
      title: "Export Installed Skills",
      defaultPath,
      buttonLabel: "Export",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["showOverwriteConfirmation", "createDirectory"],
    };
    const selection = focusedWindow
      ? await dialog.showSaveDialog(focusedWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);

    if (selection.canceled || !selection.filePath) {
      return { canceled: true };
    }

    const selectedPath =
      extname(selection.filePath).toLowerCase() === ".json"
        ? selection.filePath
        : `${selection.filePath}.json`;
    const config = loadConfig();
    const skills = await scan(config);
    const outputPath = exportInstalledSkills(skills, selectedPath);
    const installedCount = skills.filter((skill) => skill.installed).length;
    return { canceled: false, outputPath, installedCount };
  });

  ipcMain.handle(
    "skills:exportSkillGroup",
    async (_event, payload: ExportSkillGroupPayload) => {
      const rawName = typeof payload?.name === "string" ? payload.name : "";
      const groupName = normalizeSkillGroupName(rawName);
      if (!groupName) {
        throw new Error("Select a group to export.");
      }

      const config = loadConfig();
      const groups = normalizedGroups(config);
      const group = findSkillGroupByName(groups, groupName);
      if (!group) {
        throw new Error(`Group \"${groupName}\" not found.`);
      }

      const defaultPath = defaultSkillGroupExportPath(group.name);
      const focusedWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
      const saveDialogOptions: SaveDialogOptions = {
        title: `Export ${group.name} Skill Group`,
        defaultPath,
        buttonLabel: "Export",
        filters: [{ name: "JSON", extensions: ["json"] }],
        properties: ["showOverwriteConfirmation", "createDirectory"],
      };
      const selection = focusedWindow
        ? await dialog.showSaveDialog(focusedWindow, saveDialogOptions)
        : await dialog.showSaveDialog(saveDialogOptions);

      if (selection.canceled || !selection.filePath) {
        return { canceled: true };
      }

      const selectedPath =
        extname(selection.filePath).toLowerCase() === ".json"
          ? selection.filePath
          : `${selection.filePath}.json`;

      const groupSkillIds = new Set(group.skillIds);
      const allSkills = await scan(config);
      const groupSkills = allSkills.filter(
        (skill) =>
          skill.installed && groupSkillIds.has(resolve(skill.sourcePath)),
      );
      const outputPath = exportInstalledSkills(groupSkills, selectedPath);
      return {
        canceled: false,
        outputPath,
        installedCount: groupSkills.length,
        groupName: group.name,
      };
    },
  );

  ipcMain.handle("skills:pickImportBundle", async () => {
    const dialogOptions: OpenDialogOptions = {
      title: "Import Skill Bundle",
      defaultPath: defaultInstalledSkillsImportPath(),
      properties: ["openFile"],
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    };

    const selection = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    const inputPath = selection.filePaths[0];
    if (selection.canceled || !inputPath) {
      return { cancelled: true };
    }

    const preview = previewInstalledSkillsManifest(inputPath);
    const skills = preview.skills.map((skill, index) => ({
      index,
      name: skill.name,
      description: skill.description || "",
      repoUrl: skill.repoUrl || "",
      skillPath: skill.skillPath || "",
    }));

    return {
      cancelled: false,
      inputPath: preview.inputPath,
      skills,
    };
  });

  ipcMain.handle(
    "skills:importInstalled",
    async (_event, payload: ImportInstalledPayload) => {
      const inputPath =
        typeof payload?.inputPath === "string" ? payload.inputPath.trim() : "";
      if (!inputPath) {
        throw new Error("Missing import file path.");
      }

      const selectedIndexes = Array.isArray(payload?.selectedIndexes)
        ? payload.selectedIndexes
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 0)
        : undefined;

      const config = loadConfig();
      const result = await importInstalledSkills(config, inputPath, {
        ...(selectedIndexes ? { selectedIndexes } : {}),
      });
      const snapshot = await createSnapshot(config);
      return { cancelled: false, ...result, snapshot };
    },
  );

  ipcMain.handle(
    "skills:getSkillMarkdown",
    async (_event, skillId: unknown) => {
      return readSkillMarkdownFromSkillId(skillId);
    },
  );

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
    if (typeof targetPath !== "string" || !targetPath.trim())
      return createSnapshot(loadConfig());
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

  ipcMain.handle(
    "skills:setPersonalSkillsRepoFromUrl",
    async (_event, repoUrl: unknown) => {
      if (typeof repoUrl !== "string" || !repoUrl.trim()) {
        throw new Error("Enter a GitHub repository URL.");
      }

      const rawRepoUrl = repoUrl.trim();
      let sourcePath: string | null = null;
      let sourceName: string | null = null;
      let addedSource = false;

      const config = loadConfig();
      const existingSource = findExistingGitHubSource(config, rawRepoUrl);
      if (existingSource) {
        sourcePath = resolve(existingSource.path);
        sourceName = existingSource.name;
      } else {
        try {
          const source = addGitHubSource(rawRepoUrl, config);
          sourcePath = resolve(source.path);
          sourceName = formatPackageNameAsOwnerRepo(source.name);
          addedSource = true;
        } catch (err: any) {
          if (err?.message !== "Source already added") {
            throw err;
          }

          const duplicateSource = findExistingGitHubSource(config, rawRepoUrl);
          if (!duplicateSource) {
            throw new Error(
              "Source already exists, but could not be resolved. Refresh and try again.",
            );
          }
          sourcePath = resolve(duplicateSource.path);
          sourceName = duplicateSource.name;
        }
      }

      if (!sourcePath) {
        throw new Error("Could not determine source path for this repository.");
      }

      const sourceRepoRoot = getGitRepoRoot(sourcePath);
      if (!sourceRepoRoot) {
        throw new Error(
          `Selected source is not a git repository: ${sourcePath}`,
        );
      }

      const repoRoot = resolve(sourceRepoRoot);
      const previousRepoPath = config.personalSkillsRepo
        ? resolve(config.personalSkillsRepo)
        : null;
      if (previousRepoPath && previousRepoPath !== repoRoot) {
        removePersonalRepoSourceAlias(config, previousRepoPath);
      }

      config.personalSkillsRepo = repoRoot;
      config.personalSkillsRepoPrompted = true;
      ensurePersonalSkillsRepoSource(config);
      saveConfig(config);
      const snapshot = await createSnapshot(config);

      return {
        snapshot,
        repoPath: repoRoot,
        sourceName: sourceName || formatPackageNameAsOwnerRepo(basename(repoRoot)),
        addedSource,
      };
    },
  );

  ipcMain.handle("skills:clearPersonalSkillsRepo", async () => {
    const config = loadConfig();
    const previousRepoPath = config.personalSkillsRepo
      ? resolve(config.personalSkillsRepo)
      : null;
    removePersonalRepoSourceAlias(config, previousRepoPath);
    delete config.personalSkillsRepo;
    config.personalSkillsRepoPrompted = true;
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
    backgroundColor: "#ffffff",
    title: `Skills Manager v${getAppVersion()}`,
    webPreferences: {
      preload: join(currentDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  void mainWindow.loadFile(join(currentDir, "..", "electron-v2", "dist", "index.html"));
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
  app.quit();
});
