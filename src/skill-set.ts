import { basename, isAbsolute, join, relative, resolve } from "path";
import { readFileSync } from "fs";
import { addGitHubSource, enableSkill, installSkill, normalizedGitHubUrl, parseGitHubRepoUrl } from "./actions";
import { saveConfig } from "./config";
import { scan } from "./scanner";
import type { Config, Skill, Source } from "./types";

const SET_COMMAND_ALIASES = new Set(["set", "s"]);
const OWNER_REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const OWNER_REPO_FILE_PATTERN = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/(.+\.json)$/;
export const SKILL_SET_REQUEST_ARG = "--skill-set-request";

const SKILL_SET_USAGE =
  "Usage: skills set <owner/repo|github-url> [skill ...] [--skill <skill>] [--all]";

export interface SkillSetRequest {
  source: string;
  requestedSkills: string[];
  installAll: boolean;
  collectionFile?: string;
}

export interface SkillSetInstallResult {
  sourceName: string;
  sourceAdded: boolean;
  selectedCount: number;
  installedCount: number;
  enabledCount: number;
  alreadyInstalledCount: number;
}

export interface SkillSelectionResult {
  selectedSkills: Skill[];
  missingSkills: string[];
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = normalizeLookupKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }

  return unique;
}

function parseSerializedSkillSetRequest(serialized: string): SkillSetRequest | null {
  const trimmed = serialized.trim();
  if (!trimmed) return null;

  let parsed: Record<string, unknown>;
  try {
    const decoded = decodeURIComponent(trimmed);
    parsed = JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }

  const sourceValue = typeof parsed.source === "string" ? parsed.source.trim() : "";
  if (!sourceValue) return null;
  const source = normalizeSkillSetSource(sourceValue);
  if (!parseGitHubRepoUrl(source)) return null;

  const requestedSkills = Array.isArray(parsed.requestedSkills)
    ? dedupeCaseInsensitive(
        parsed.requestedSkills.filter((entry): entry is string => typeof entry === "string"),
      )
    : [];
  const installAll = parsed.installAll === true;
  if (installAll && requestedSkills.length > 0) return null;

  const collectionFile =
    typeof parsed.collectionFile === "string" && parsed.collectionFile.trim()
      ? parsed.collectionFile.trim()
      : undefined;

  return {
    source,
    requestedSkills,
    installAll,
    ...(collectionFile ? { collectionFile } : {}),
  };
}

export function encodeSkillSetRequestArg(request: SkillSetRequest): string {
  const serialized = JSON.stringify({
    source: request.source,
    requestedSkills: request.requestedSkills,
    installAll: request.installAll,
    ...(request.collectionFile ? { collectionFile: request.collectionFile } : {}),
  });
  return `${SKILL_SET_REQUEST_ARG}=${encodeURIComponent(serialized)}`;
}

export function extractSkillSetRequestFromArgv(argv: string[]): SkillSetRequest | null {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith(`${SKILL_SET_REQUEST_ARG}=`)) {
      return parseSerializedSkillSetRequest(token.slice(`${SKILL_SET_REQUEST_ARG}=`.length));
    }

    if (token === SKILL_SET_REQUEST_ARG) {
      const next = argv[index + 1];
      if (!next || next.startsWith("-")) return null;
      return parseSerializedSkillSetRequest(next);
    }
  }

  return null;
}

function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const rel = relative(resolve(rootPath), resolve(candidatePath));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function sourceLooksLikeSkillSet(value: string): boolean {
  const normalized = normalizeSkillSetSource(value);
  return parseGitHubRepoUrl(normalized) !== null;
}

function parseSkillList(args: string[], startIndex: number): {
  requestedSkills: string[];
  installAll: boolean;
} {
  const requested: string[] = [];
  let installAll = false;

  for (let index = startIndex; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--all") {
      installAll = true;
      continue;
    }

    if (token === "--skill" || token === "-k") {
      const next = args[index + 1];
      if (!next || next.startsWith("-")) {
        throw new Error(`${token} requires a skill name.`);
      }
      requested.push(next);
      index += 1;
      continue;
    }

    if (token.startsWith("--skill=")) {
      const value = token.slice("--skill=".length).trim();
      if (!value) {
        throw new Error("--skill requires a skill name.");
      }
      requested.push(value);
      continue;
    }

    if (token.startsWith("-")) {
      throw new Error(`Unknown option: ${token}`);
    }

    requested.push(token);
  }

  const requestedSkills = dedupeCaseInsensitive(requested);
  if (installAll && requestedSkills.length > 0) {
    throw new Error("Do not combine --all with explicit skill names.");
  }

  return { requestedSkills, installAll };
}

export interface ParsedSkillSetSource {
  source: string;
  collectionFile?: string;
}

export function normalizeSkillSetSource(input: string): string {
  return parseSkillSetSource(input).source;
}

export function parseSkillSetSource(input: string): ParsedSkillSetSource {
  const trimmed = input.trim();

  const fileMatch = trimmed.match(OWNER_REPO_FILE_PATTERN);
  if (fileMatch) {
    const [, ownerRepo, filePath] = fileMatch;
    return {
      source: `https://github.com/${ownerRepo}`,
      collectionFile: filePath,
    };
  }

  if (OWNER_REPO_PATTERN.test(trimmed)) {
    const [owner, repo] = trimmed.split("/");
    return { source: `https://github.com/${owner}/${repo}` };
  }

  return { source: trimmed };
}

export function parseSkillSetRequest(argv: string[]): SkillSetRequest | null {
  if (argv.length === 0) return null;

  const first = argv[0];
  let source: string | undefined;
  let optionStartIndex = 1;

  if (SET_COMMAND_ALIASES.has(first)) {
    source = argv[1];
    optionStartIndex = 2;
  } else if (sourceLooksLikeSkillSet(first)) {
    source = first;
    optionStartIndex = 1;
  } else {
    return null;
  }

  if (!source) {
    throw new Error(SKILL_SET_USAGE);
  }

  const parsed = parseSkillSetSource(source);
  if (!parseGitHubRepoUrl(parsed.source)) {
    throw new Error("Skill set source must be a GitHub repo (owner/repo or URL).");
  }

  const { requestedSkills, installAll } = parseSkillList(argv, optionStartIndex);
  return {
    source: parsed.source,
    requestedSkills,
    installAll,
    ...(parsed.collectionFile ? { collectionFile: parsed.collectionFile } : {}),
  };
}

function resolveSource(config: Config, request: SkillSetRequest): {
  source: Source;
  sourceAdded: boolean;
} {
  const parsed = parseGitHubRepoUrl(request.source);
  if (!parsed) {
    throw new Error("Skill set source must be a GitHub repo (owner/repo or URL).");
  }

  const canonicalUrl = parsed.canonicalUrl.toLowerCase();
  const sourceName = parsed.sourceName.toLowerCase();
  const existing = config.sources.find(
    (entry) =>
      normalizedGitHubUrl(entry.url) === canonicalUrl ||
      entry.name.toLowerCase() === sourceName,
  );
  if (existing) {
    return { source: existing, sourceAdded: false };
  }

  const source = addGitHubSource(parsed.canonicalUrl, config);
  config.sources.push(source);
  saveConfig(config);
  return { source, sourceAdded: true };
}

export function selectSkillsForInstall(
  sourceSkills: Skill[],
  requestedSkills: string[],
  installAll: boolean,
): SkillSelectionResult {
  if (installAll || requestedSkills.length === 0) {
    return { selectedSkills: sourceSkills, missingSkills: [] };
  }

  const lookup = new Map<string, Skill>();
  for (const skill of sourceSkills) {
    const keys = [skill.name, skill.installName, basename(skill.sourcePath)];
    for (const key of keys) {
      if (!key) continue;
      const lookupKey = normalizeLookupKey(key);
      if (!lookupKey || lookup.has(lookupKey)) continue;
      lookup.set(lookupKey, skill);
    }
  }

  const selectedSkills: Skill[] = [];
  const selectedPaths = new Set<string>();
  const missingSkills: string[] = [];

  for (const requested of requestedSkills) {
    const match = lookup.get(normalizeLookupKey(requested));
    if (!match) {
      missingSkills.push(requested);
      continue;
    }

    const matchPath = resolve(match.sourcePath);
    if (selectedPaths.has(matchPath)) continue;
    selectedPaths.add(matchPath);
    selectedSkills.push(match);
  }

  return { selectedSkills, missingSkills };
}

export function readCollectionSkillNames(
  sourcePath: string,
  collectionFile: string,
): string[] {
  const filePath = join(resolve(sourcePath), collectionFile);
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(`Collection file not found: ${collectionFile}`);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid JSON in collection file: ${collectionFile}`);
  }

  const installedSkills = parsed.installedSkills;
  if (!Array.isArray(installedSkills)) {
    throw new Error(`Collection file has no installedSkills array: ${collectionFile}`);
  }

  return installedSkills
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .map((entry) => (typeof entry.name === "string" ? entry.name : ""))
    .filter(Boolean);
}

export async function installSkillSet(
  config: Config,
  request: SkillSetRequest,
): Promise<SkillSetInstallResult> {
  if (config.targets.length === 0) {
    throw new Error("No install targets configured. Add targets in config and retry.");
  }

  const { source, sourceAdded } = resolveSource(config, request);

  let requestedSkills = request.requestedSkills;
  let installAll = request.installAll;
  if (request.collectionFile) {
    const collectionSkills = readCollectionSkillNames(source.path, request.collectionFile);
    if (collectionSkills.length === 0) {
      throw new Error(`Collection file is empty: ${request.collectionFile}`);
    }
    requestedSkills = collectionSkills;
    installAll = false;
  }

  const allSkills = await scan(config);
  const sourceSkills = allSkills.filter((skill) =>
    isPathWithin(source.path, skill.sourcePath),
  );

  if (sourceSkills.length === 0) {
    throw new Error(`No skills were found in source '${source.name}'.`);
  }

  const selection = selectSkillsForInstall(
    sourceSkills,
    requestedSkills,
    installAll,
  );

  if (selection.missingSkills.length > 0) {
    const available = sourceSkills
      .map((skill) => skill.installName || basename(skill.sourcePath))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    throw new Error(
      `Skill(s) not found: ${selection.missingSkills.join(", ")}. Available: ${available.join(", ")}`,
    );
  }

  let installedCount = 0;
  let enabledCount = 0;
  let alreadyInstalledCount = 0;

  for (const skill of selection.selectedSkills) {
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

  return {
    sourceName: source.name,
    sourceAdded,
    selectedCount: selection.selectedSkills.length,
    installedCount,
    enabledCount,
    alreadyInstalledCount,
  };
}
