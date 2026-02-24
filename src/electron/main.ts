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
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "fs";
import { tmpdir } from "os";
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
  parseGitHubRepoUrl,
  removeSource,
  resolveGitHubRepoUrl,
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
import {
  extractSkillSetRequestFromArgv,
  normalizeSkillSetSource,
  selectSkillsForInstall,
  type SkillSetRequest,
} from "../skill-set";
import { buildActiveBudgetSummary, buildGroupBudgetSummary } from "../token-budget";
import type { Config, Skill, Source } from "../types";
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

interface AddSourceFromInputPayload {
  input?: unknown;
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

interface AddSourcePreviewSkill {
  index: number;
  name: string;
  description: string;
  skillPath: string;
}

interface AddSourcePreviewResponse {
  input: string;
  sourceName: string;
  sourcePath: string;
  skills: AddSourcePreviewSkill[];
  defaultSelectedIndexes: number[];
}

interface PrepareSkillSetInstallPayload {
  source?: unknown;
  requestedSkills?: unknown;
  installAll?: unknown;
}

interface ApplySkillSetInstallPayload {
  sourceId?: unknown;
  skillIds?: unknown;
}

const TARGET_NAME_MAP = new Map<string, string>(
  SUPPORTED_IDES.map((ide) => [expandTilde(ide.path), ide.name]),
);
const INSTALLED_GROUP_NAME = "Installed";
const SKILL_SET_LAUNCH_CHANNEL = "skills:launchSkillSet";

let mainWindow: BrowserWindow | null = null;
let latestSnapshotSkillIds = new Set<string>();
let rendererLoaded = false;
let pendingSecondInstanceSkillSetRequest: SkillSetRequest | null = null;
let startupSkillSetRequest = extractSkillSetRequestFromArgv(process.argv);

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
  const parsed = parseGitHubRepoUrl(raw);
  return parsed ? parsed.sourceName : null;
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }

  return unique;
}

function parseRequestedSkills(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return dedupeCaseInsensitive(
    raw.filter((entry): entry is string => typeof entry === "string"),
  );
}

function parseSkillSetPayload(
  payload: PrepareSkillSetInstallPayload | SkillSetRequest | null | undefined,
): SkillSetRequest {
  const rawSource = typeof payload?.source === "string" ? payload.source.trim() : "";
  if (!rawSource) {
    throw new Error("Missing skill set source.");
  }

  const source = normalizeSkillSetSource(rawSource);
  if (!parseGitHubSourceName(source)) {
    throw new Error("Skill set source must be a GitHub repo (owner/repo or URL).");
  }

  const requestedSkills = parseRequestedSkills(payload?.requestedSkills);
  const installAll = payload?.installAll === true;
  if (installAll && requestedSkills.length > 0) {
    throw new Error("Do not combine --all with explicit skill names.");
  }

  return {
    source,
    requestedSkills,
    installAll,
  };
}

function dispatchSkillSetLaunchRequest(request: SkillSetRequest): void {
  if (!mainWindow || mainWindow.isDestroyed() || !rendererLoaded) {
    pendingSecondInstanceSkillSetRequest = request;
    return;
  }

  mainWindow.webContents.send(SKILL_SET_LAUNCH_CHANNEL, request);
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
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

async function findExistingGitHubSource(
  config: Config,
  repoUrl: string,
): Promise<SourceListEntry | null> {
  const displayedSources = getDisplayedSources(config);
  const normalizedTargetUrls = new Set<string>([
    normalizeRepoUrl(repoUrl).toLowerCase(),
  ]);
  const resolvedRepo = await resolveGitHubRepoUrl(repoUrl);
  if (resolvedRepo) {
    normalizedTargetUrls.add(normalizeRepoUrl(resolvedRepo.canonicalUrl).toLowerCase());
  }

  const matchedByUrl = displayedSources.find(
    (source) =>
      !!source.repoUrl &&
      normalizedTargetUrls.has(normalizeRepoUrl(source.repoUrl).toLowerCase()),
  );
  if (matchedByUrl) {
    return matchedByUrl;
  }

  const sourceName = resolvedRepo?.sourceName ?? parseGitHubSourceName(repoUrl);
  if (!sourceName) return null;
  const sourceNameLower = sourceName.toLowerCase();
  const formattedNameLower = formatPackageNameAsOwnerRepo(sourceName).toLowerCase();

  const matchedByName = displayedSources.find((source) => {
    const lowered = source.name.trim().toLowerCase();
    return lowered === sourceNameLower || lowered === formattedNameLower;
  });
  return matchedByName || null;
}

interface SourceSelectionEntry {
  skill: Skill;
  skillPath: string;
}

interface ResolvedSourcePreviewInput {
  input: string;
  sourceName: string;
  sourcePath: string;
  sourceUrl?: string;
  specificSkillPath?: string;
  specificSkillHint?: string;
  cleanupPath?: string;
}

interface ResolvedSourceApplyInput {
  input: string;
  sourceName: string;
  sourcePath: string;
  sourceUrl?: string;
  addLocalSource: boolean;
}

function cloneRepository(repoUrl: string, clonePath: string): void {
  const cloneResult = spawnSync(
    "git",
    ["clone", "--depth", "1", repoUrl, clonePath],
    { encoding: "utf-8" },
  );
  if (cloneResult.error || cloneResult.status !== 0) {
    if (existsSync(clonePath)) {
      rmSync(clonePath, { recursive: true, force: true });
    }

    const detail =
      cloneResult.error?.message ||
      cloneResult.stderr?.toString().trim() ||
      cloneResult.stdout?.toString().trim();
    if (detail) {
      throw new Error(`Could not download repository: ${detail}`);
    }
    throw new Error("Could not download repository.");
  }
}

function inferSpecificSkillHint(rawInput: string): string | undefined {
  const trimmed = rawInput.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
    if (segments.length === 0) return undefined;

    if (host === "skills.sh" || host === "www.skills.sh") {
      if (segments.length >= 3) {
        return decodeURIComponent(segments[segments.length - 1]);
      }
      return undefined;
    }

    if (host !== "github.com" && host !== "www.github.com") {
      return undefined;
    }

    if (segments.length >= 5 && (segments[2] === "tree" || segments[2] === "blob")) {
      const tail = segments.slice(4);
      if (tail.length === 0) return undefined;
      const last = decodeURIComponent(tail[tail.length - 1]);
      if (/^skill\.md$/i.test(last) && tail.length >= 2) {
        return decodeURIComponent(tail[tail.length - 2]);
      }
      return last;
    }

    if (segments.length > 2) {
      const last = decodeURIComponent(segments[segments.length - 1]);
      if (/^skill\.md$/i.test(last) && segments.length >= 2) {
        return decodeURIComponent(segments[segments.length - 2]);
      }
      return last;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function buildSourceSelectionEntries(
  skills: Skill[],
  sourceRoot: string,
): SourceSelectionEntry[] {
  const resolvedRoot = resolve(sourceRoot);
  return skills
    .filter((skill) => isPathWithin(resolve(skill.sourcePath), resolvedRoot))
    .map((skill) => ({
      skill,
      skillPath:
        relative(resolvedRoot, resolve(skill.sourcePath)).replace(/\\/g, "/") ||
        ".",
    }))
    .sort((a, b) => {
      const pathCompare = a.skillPath.localeCompare(b.skillPath, undefined, {
        sensitivity: "base",
        numeric: true,
      });
      if (pathCompare !== 0) return pathCompare;
      return a.skill.name.localeCompare(b.skill.name, undefined, {
        sensitivity: "base",
        numeric: true,
      });
    });
}

function pickDefaultSelectionIndexes(
  entries: SourceSelectionEntry[],
  options: {
    specificSkillPath?: string;
    specificSkillHint?: string;
  },
): number[] {
  if (entries.length === 0) return [];

  if (options.specificSkillPath) {
    const resolvedSpecific = resolve(options.specificSkillPath);
    const index = entries.findIndex(
      (entry) => resolve(entry.skill.sourcePath) === resolvedSpecific,
    );
    if (index >= 0) return [index];
  }

  if (options.specificSkillHint) {
    const hint = options.specificSkillHint.trim().toLowerCase();
    if (hint) {
      const exactByDirName = entries.findIndex(
        (entry) => basename(resolve(entry.skill.sourcePath)).toLowerCase() === hint,
      );
      if (exactByDirName >= 0) return [exactByDirName];

      const exactByPath = entries.findIndex((entry) =>
        entry.skillPath.toLowerCase().split("/").includes(hint),
      );
      if (exactByPath >= 0) return [exactByPath];
    }
  }

  return entries.map((_, index) => index);
}

function detectLocalSourceInput(rawInput: string): ResolvedSourcePreviewInput | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const resolvedInputPath = resolve(expandTilde(trimmed));
  if (!existsSync(resolvedInputPath)) return null;

  let stats: ReturnType<typeof statSync>;
  try {
    stats = statSync(resolvedInputPath);
  } catch {
    return null;
  }

  if (stats.isFile()) {
    if (basename(resolvedInputPath).toLowerCase() !== "skill.md") {
      throw new Error("File input must point to SKILL.md.");
    }
    const skillDir = dirname(resolvedInputPath);
    const sourceRoot = dirname(skillDir);
    return {
      input: trimmed,
      sourceName: basename(sourceRoot) || basename(skillDir) || "local-source",
      sourcePath: sourceRoot,
      specificSkillPath: skillDir,
    };
  }

  if (!stats.isDirectory()) {
    throw new Error("Input must be a directory, SKILL.md path, or repository URL.");
  }

  const skillMdPath = join(resolvedInputPath, "SKILL.md");
  const isSingleSkillPath = existsSync(skillMdPath);
  if (isSingleSkillPath) {
    const sourceRoot = dirname(resolvedInputPath);
    return {
      input: trimmed,
      sourceName:
        basename(sourceRoot) || basename(resolvedInputPath) || "local-source",
      sourcePath: sourceRoot,
      specificSkillPath: resolvedInputPath,
    };
  }

  return {
    input: trimmed,
    sourceName: basename(resolvedInputPath) || "local-source",
    sourcePath: resolvedInputPath,
  };
}

async function resolveSourcePreviewInput(
  rawInput: string,
  config: Config,
): Promise<ResolvedSourcePreviewInput> {
  const local = detectLocalSourceInput(rawInput);
  if (local) return local;

  const parsedRepo = await resolveGitHubRepoUrl(rawInput);
  if (!parsedRepo) {
    throw new Error("Enter a valid skill path, repository URL, or marketplace URL.");
  }

  const existingSource = await findExistingGitHubSource(
    config,
    parsedRepo.canonicalUrl,
  );
  if (existingSource) {
    return {
      input: rawInput.trim(),
      sourceName: existingSource.name,
      sourcePath: resolve(existingSource.path),
      sourceUrl: parsedRepo.canonicalUrl,
      specificSkillHint: inferSpecificSkillHint(rawInput),
    };
  }

  const previewRoot = mkdtempSync(join(tmpdir(), "skills-manager-preview-"));
  const clonePath = resolve(join(previewRoot, parsedRepo.sourceName));
  try {
    cloneRepository(parsedRepo.canonicalUrl, clonePath);
  } catch (error) {
    rmSync(previewRoot, { recursive: true, force: true });
    throw error;
  }

  return {
    input: rawInput.trim(),
    sourceName: parsedRepo.sourceName,
    sourcePath: clonePath,
    sourceUrl: parsedRepo.canonicalUrl,
    specificSkillHint: inferSpecificSkillHint(rawInput),
    cleanupPath: previewRoot,
  };
}

async function buildSourcePreview(
  rawInput: string,
  config: Config,
): Promise<AddSourcePreviewResponse> {
  const resolvedInput = await resolveSourcePreviewInput(rawInput, config);

  try {
    const previewConfig: Config = {
      sources: [
        {
          name: resolvedInput.sourceName,
          path: resolvedInput.sourcePath,
          recursive: true,
          ...(resolvedInput.sourceUrl ? { url: resolvedInput.sourceUrl } : {}),
        },
      ],
      targets: [],
      disabledSources: [],
      personalSkillsRepoPrompted: true,
    };

    const scannedSkills = await scan(previewConfig);
    const entries = buildSourceSelectionEntries(
      scannedSkills,
      resolvedInput.sourcePath,
    );
    if (entries.length === 0) {
      throw new Error("No skills found for this input.");
    }

    const defaultSelectedIndexes = pickDefaultSelectionIndexes(entries, {
      specificSkillPath: resolvedInput.specificSkillPath,
      specificSkillHint: resolvedInput.specificSkillHint,
    });
    const skills: AddSourcePreviewSkill[] = entries.map((entry, index) => ({
      index,
      name: entry.skill.name,
      description: entry.skill.description,
      skillPath: entry.skillPath,
    }));

    return {
      input: resolvedInput.input,
      sourceName: formatPackageNameAsOwnerRepo(resolvedInput.sourceName),
      sourcePath: resolvedInput.sourcePath,
      skills,
      defaultSelectedIndexes,
    };
  } finally {
    if (resolvedInput.cleanupPath) {
      rmSync(resolvedInput.cleanupPath, { recursive: true, force: true });
    }
  }
}

function ensureUniqueLocalSourceName(
  config: Config,
  preferredName: string,
  sourcePath: string,
): string {
  const normalizedPreferred = preferredName.trim() || basename(sourcePath) || "local-source";
  const existingNames = new Set(
    config.sources.map((source) => source.name.trim().toLowerCase()).filter(Boolean),
  );

  if (!existingNames.has(normalizedPreferred.toLowerCase())) {
    return normalizedPreferred;
  }

  let suffix = 2;
  while (existingNames.has(`${normalizedPreferred}-${suffix}`.toLowerCase())) {
    suffix += 1;
  }
  return `${normalizedPreferred}-${suffix}`;
}

function ensureLocalSource(
  config: Config,
  sourcePath: string,
  sourceName: string,
): Source {
  const resolvedPath = resolve(sourcePath);
  const existing = config.sources.find(
    (source) => resolve(source.path) === resolvedPath,
  );
  if (existing) {
    existing.recursive = true;
    return existing;
  }

  const nextSource: Source = {
    name: ensureUniqueLocalSourceName(config, sourceName, resolvedPath),
    path: resolvedPath,
    recursive: true,
  };
  config.sources.push(nextSource);
  return nextSource;
}

async function resolveSourceApplyInput(
  rawInput: string,
  config: Config,
): Promise<ResolvedSourceApplyInput> {
  const local = detectLocalSourceInput(rawInput);
  if (local) {
    return {
      input: local.input,
      sourceName: local.sourceName,
      sourcePath: local.sourcePath,
      addLocalSource: true,
    };
  }

  const parsedRepo = await resolveGitHubRepoUrl(rawInput);
  if (!parsedRepo) {
    throw new Error("Enter a valid skill path, repository URL, or marketplace URL.");
  }

  const existingSource = await findExistingGitHubSource(
    config,
    parsedRepo.canonicalUrl,
  );
  if (existingSource) {
    return {
      input: rawInput.trim(),
      sourceName: existingSource.name,
      sourcePath: resolve(existingSource.path),
      sourceUrl: parsedRepo.canonicalUrl,
      addLocalSource: false,
    };
  }

  const source = await addGitHubSource(parsedRepo.canonicalUrl, config);
  return {
    input: rawInput.trim(),
    sourceName: source.name,
    sourcePath: resolve(source.path),
    sourceUrl: parsedRepo.canonicalUrl,
    addLocalSource: false,
  };
}

function parseSelectedIndexes(
  value: unknown,
  maxExclusive: number,
): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => Number(entry))
        .filter(
          (index) =>
            Number.isInteger(index) && index >= 0 && index < maxExclusive,
        ),
    ),
  ).sort((a, b) => a - b);
}

async function addSourceFromInput(
  payload: AddSourceFromInputPayload,
): Promise<{
  snapshot: Snapshot;
  sourceName: string;
  selectedCount: number;
  installedCount: number;
  alreadyInstalledCount: number;
}> {
  const rawInput =
    typeof payload?.input === "string" ? payload.input.trim() : "";
  if (!rawInput) {
    throw new Error("Enter a valid skill path, repository URL, or marketplace URL.");
  }

  const config = loadConfig();
  const preview = await buildSourcePreview(rawInput, config);
  const selectedIndexes = parseSelectedIndexes(
    payload?.selectedIndexes,
    preview.skills.length,
  );
  if (selectedIndexes.length === 0) {
    throw new Error("Select at least one skill.");
  }

  const resolvedInput = await resolveSourceApplyInput(rawInput, config);
  if (resolvedInput.addLocalSource) {
    ensureLocalSource(config, resolvedInput.sourcePath, resolvedInput.sourceName);
    saveConfig(config);
  }

  const selectedSet = new Set(selectedIndexes);
  const scannedSkills = await scan(config);
  const entries = buildSourceSelectionEntries(
    scannedSkills,
    resolvedInput.sourcePath,
  );
  if (entries.length === 0) {
    throw new Error("No skills found for this source.");
  }

  let installedCount = 0;
  let alreadyInstalledCount = 0;
  for (let index = 0; index < entries.length; index += 1) {
    if (!selectedSet.has(index)) continue;
    const skill = entries[index].skill;
    if (skill.installed) {
      alreadyInstalledCount += 1;
      continue;
    }
    installSkill(skill, config);
    installedCount += 1;
  }

  const snapshot = await createSnapshot(config);
  return {
    snapshot,
    sourceName: formatPackageNameAsOwnerRepo(resolvedInput.sourceName),
    selectedCount: selectedIndexes.length,
    installedCount,
    alreadyInstalledCount,
  };
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
  const baseName = slug ? `${slug}-skills.json` : "skill-collection-skills.json";
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
    throw new Error("Enter a collection name.");
  }
  if (isInstalledAutoGroupName(groupName)) {
    throw new Error(`"${INSTALLED_GROUP_NAME}" is reserved.`);
  }

  const config = loadConfig();
  const groups = normalizedGroups(config);
  if (findSkillGroupByName(groups, groupName)) {
    throw new Error("Collection already exists.");
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
    throw new Error("Select a collection.");
  }
  if (typeof payload?.active !== "boolean") {
    throw new Error("Missing collection state.");
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
    throw new Error("Collection not found.");
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
    throw new Error("Select a collection.");
  }
  if (!nextName) {
    throw new Error("Enter a collection name.");
  }
  if (isInstalledAutoGroupName(nextName)) {
    throw new Error(`"${INSTALLED_GROUP_NAME}" is reserved.`);
  }

  const config = loadConfig();
  const groups = normalizedGroups(config);
  const selectedGroup = findSkillGroupByName(groups, requestedName);
  if (!selectedGroup) {
    throw new Error("Collection not found.");
  }

  const duplicate = findSkillGroupByName(groups, nextName);
  if (
    duplicate &&
    duplicate.name.toLowerCase() !== selectedGroup.name.toLowerCase()
  ) {
    throw new Error("A collection with this name already exists.");
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
    throw new Error("Could not rename collection.");
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
    throw new Error("Select a collection.");
  }

  const config = loadConfig();
  const groups = normalizedGroups(config);
  const selectedGroup = findSkillGroupByName(groups, requestedName);
  if (!selectedGroup) {
    throw new Error("Collection not found.");
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
    throw new Error("Select a collection.");
  }
  if (isInstalledAutoGroupName(requestedGroupName)) {
    throw new Error("This collection is managed automatically.");
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
    throw new Error("Collection not found.");
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

function findDisplayedSourceByPath(
  config: Config,
  sourcePath: string,
): SourceListEntry | null {
  const resolvedTarget = resolve(sourcePath);
  const displayed = getDisplayedSources(config);
  return (
    displayed.find((source) => resolve(source.path) === resolvedTarget) || null
  );
}

function ensureSkillSetSource(
  config: Config,
  source: string,
): { source: SourceListEntry; sourceAdded: boolean } {
  const existingSource = findExistingGitHubSource(config, source);
  if (existingSource) {
    return { source: existingSource, sourceAdded: false };
  }

  const createdSource = addGitHubSource(source, config);
  config.sources.push(createdSource);
  saveConfig(config);
  const displayedSource = findDisplayedSourceByPath(config, createdSource.path);
  if (!displayedSource) {
    throw new Error("Source was added, but could not be resolved.");
  }
  return { source: displayedSource, sourceAdded: true };
}

async function prepareSkillSetInstall(payload: PrepareSkillSetInstallPayload): Promise<{
  snapshot: Snapshot;
  sourceAdded: boolean;
  sourceName: string;
  sourceId: string;
  sourceUrl: string;
  skills: Array<{
    id: string;
    name: string;
    description: string;
    installName: string;
    installed: boolean;
    disabled: boolean;
  }>;
  selectedSkillIds: string[];
  missingSkills: string[];
}> {
  const request = parseSkillSetPayload(payload);
  const config = loadConfig();
  const sourceResult = ensureSkillSetSource(config, request.source);
  const sourceEntry =
    findDisplayedSourceByPath(config, sourceResult.source.path) ||
    sourceResult.source;

  const scannedSkills = await scan(config);
  const visibleSkills = visibleSkillsFromScan(scannedSkills, config);
  const sourceSkills = getSkillsForSource(sourceEntry, visibleSkills);

  if (sourceSkills.length === 0) {
    throw new Error(`No skills were found in source '${sourceEntry.name}'.`);
  }

  const selection = selectSkillsForInstall(
    sourceSkills,
    request.requestedSkills,
    request.installAll,
  );

  let selectedSkills = selection.selectedSkills;
  if (request.requestedSkills.length === 0 && !request.installAll) {
    // Default selection mirrors "what still needs action": install missing + re-enable disabled.
    selectedSkills = sourceSkills.filter((skill) => !skill.installed || skill.disabled);
    if (selectedSkills.length === 0) {
      selectedSkills = sourceSkills;
    }
  }

  const selectedSkillIds = selectedSkills.map((skill) => resolve(skill.sourcePath));
  const snapshot = await createSnapshot(config);

  return {
    snapshot,
    sourceAdded: sourceResult.sourceAdded,
    sourceName: sourceEntry.name,
    sourceId: resolve(sourceEntry.path),
    sourceUrl: request.source,
    skills: sourceSkills.map((skill) => ({
      id: resolve(skill.sourcePath),
      name: skill.name,
      description: skill.description || "",
      installName: skill.installName || basename(skill.sourcePath),
      installed: skill.installed,
      disabled: skill.disabled,
    })),
    selectedSkillIds,
    missingSkills: selection.missingSkills,
  };
}

async function applySkillSetInstall(payload: ApplySkillSetInstallPayload): Promise<{
  snapshot: Snapshot;
  selectedCount: number;
  installedCount: number;
  enabledCount: number;
  alreadyInstalledCount: number;
  missingCount: number;
}> {
  const rawSkillIds = Array.isArray(payload?.skillIds)
    ? payload.skillIds
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => resolve(entry))
    : [];
  const skillIds = Array.from(new Set(rawSkillIds));
  if (skillIds.length === 0) {
    throw new Error("Select at least one skill to install.");
  }

  const sourceId =
    typeof payload?.sourceId === "string" && payload.sourceId.trim()
      ? resolve(payload.sourceId)
      : null;

  const config = loadConfig();
  const skills = await scan(config);
  const skillById = new Map(skills.map((skill) => [resolve(skill.sourcePath), skill]));

  let installedCount = 0;
  let enabledCount = 0;
  let alreadyInstalledCount = 0;
  let missingCount = 0;

  for (const skillId of skillIds) {
    const skill = skillById.get(skillId);
    if (!skill) {
      missingCount += 1;
      continue;
    }

    if (sourceId && !isPathWithin(resolve(skill.sourcePath), sourceId)) {
      missingCount += 1;
      continue;
    }

    if (!skill.installed) {
      installSkill(skill, config);
      installedCount += 1;
      continue;
    }

    if (skill.disabled) {
      enableSkill(skill, config);
      enabledCount += 1;
      continue;
    }

    alreadyInstalledCount += 1;
  }

  const snapshot = await createSnapshot(config);
  return {
    snapshot,
    selectedCount: skillIds.length,
    installedCount,
    enabledCount,
    alreadyInstalledCount,
    missingCount,
  };
}

function registerIpcHandlers(): void {
  ipcMain.handle("skills:consumeLaunchSkillSetRequest", async () => {
    const pending = startupSkillSetRequest;
    startupSkillSetRequest = null;
    return pending;
  });

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
      throw new Error("Enter a repository or marketplace URL.");
    }

    const config = loadConfig();
    const source = await addGitHubSource(repoUrl, config);
    const snapshot = await createSnapshot(config);
    return { snapshot, sourceName: formatPackageNameAsOwnerRepo(source.name) };
  });

  ipcMain.handle("skills:previewAddSourceInput", async (_event, input: unknown) => {
    if (typeof input !== "string" || !input.trim()) {
      throw new Error("Enter a valid skill path, repository URL, or marketplace URL.");
    }

    const config = loadConfig();
    return buildSourcePreview(input, config);
  });

  ipcMain.handle(
    "skills:addSourceFromInput",
    async (_event, payload: AddSourceFromInputPayload) => {
      return addSourceFromInput(payload);
    },
  );

  ipcMain.handle(
    "skills:prepareSkillSetInstall",
    async (_event, payload: PrepareSkillSetInstallPayload) =>
      prepareSkillSetInstall(payload),
  );

  ipcMain.handle(
    "skills:applySkillSetInstall",
    async (_event, payload: ApplySkillSetInstallPayload) =>
      applySkillSetInstall(payload),
  );

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
        throw new Error("Select a collection to export.");
      }

      const config = loadConfig();
      const groups = normalizedGroups(config);
      const group = findSkillGroupByName(groups, groupName);
      if (!group) {
        throw new Error(`Collection \"${groupName}\" not found.`);
      }

      const defaultPath = defaultSkillGroupExportPath(group.name);
      const focusedWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
      const saveDialogOptions: SaveDialogOptions = {
        title: `Export ${group.name} Collection`,
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
        throw new Error("Enter a repository or marketplace URL.");
      }

      const rawRepoUrl = repoUrl.trim();
      let sourcePath: string | null = null;
      let sourceName: string | null = null;
      let addedSource = false;

      const config = loadConfig();
      const existingSource = await findExistingGitHubSource(config, rawRepoUrl);
      if (existingSource) {
        sourcePath = resolve(existingSource.path);
        sourceName = existingSource.name;
      } else {
        try {
          const source = await addGitHubSource(rawRepoUrl, config);
          sourcePath = resolve(source.path);
          sourceName = formatPackageNameAsOwnerRepo(source.name);
          addedSource = true;
        } catch (err: any) {
          if (err?.message !== "Source already added") {
            throw err;
          }

          const duplicateSource = await findExistingGitHubSource(config, rawRepoUrl);
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

  rendererLoaded = false;
  mainWindow.setMenuBarVisibility(false);
  void mainWindow.loadFile(join(currentDir, "..", "renderer", "dist", "index.html"));
  mainWindow.webContents.on("did-finish-load", () => {
    rendererLoaded = true;
    if (pendingSecondInstanceSkillSetRequest) {
      dispatchSkillSetLaunchRequest(pendingSecondInstanceSkillSetRequest);
      pendingSecondInstanceSkillSetRequest = null;
    }
  });
  mainWindow.on("closed", () => {
    rendererLoaded = false;
    mainWindow = null;
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  registerIpcHandlers();

  app.on("second-instance", (_event, commandLine) => {
    focusMainWindow();
    const request = extractSkillSetRequestFromArgv(commandLine);
    if (request) {
      dispatchSkillSetLaunchRequest(request);
    }
  });

  app.whenReady().then(() => {
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else {
        focusMainWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
