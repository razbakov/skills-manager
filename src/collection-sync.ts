import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { Skill, Source } from "./types";
import { buildInstalledSkillsManifest } from "./export";
import { normalizeSkillGroups, type NamedSkillGroup } from "./skill-groups";
import { normalizedGitHubUrl, parseGitHubRepoUrl } from "./source-url";

export interface CollectionCommitResult {
  committed: boolean;
  message: string;
}

export interface SyncResult {
  pulled: boolean;
  pushed: boolean;
  message: string;
}

export type CollectionAction = "add" | "update" | "remove" | "rename";

export interface CollectionSkillEntry {
  name: string;
  description: string;
  repoUrl?: string;
  skillPath?: string;
}

export interface CollectionPreview {
  name: string;
  file: string;
  skillNames: string[];
  skills: CollectionSkillEntry[];
}

export interface SyncCollectionsFromRepoInput {
  repoPath?: string;
  existingGroups: NamedSkillGroup[];
  skills: Skill[];
  sources: Source[];
  sourcesRoot: string;
}

export interface SyncCollectionsFromRepoResult {
  groups: NamedSkillGroup[];
  importedGroups: number;
  updated: boolean;
}

function compareByName(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function isPathWithin(path: string, root: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function groupsEqual(a: NamedSkillGroup[], b: NamedSkillGroup[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left.name !== right.name) return false;
    if (left.skillIds.length !== right.skillIds.length) return false;
    for (let j = 0; j < left.skillIds.length; j += 1) {
      if (left.skillIds[j] !== right.skillIds[j]) return false;
    }
  }

  return true;
}

function mergeGroupsByName(
  existingGroups: NamedSkillGroup[],
  repoGroups: NamedSkillGroup[],
): NamedSkillGroup[] {
  const existing = normalizeSkillGroups(existingGroups);
  const fromRepo = normalizeSkillGroups(repoGroups);
  const repoByLowerName = new Map(
    fromRepo.map((group) => [group.name.toLowerCase(), group] as const),
  );
  const merged: NamedSkillGroup[] = [];

  for (const group of existing) {
    const key = group.name.toLowerCase();
    const replacement = repoByLowerName.get(key);
    if (replacement) {
      merged.push(replacement);
      repoByLowerName.delete(key);
    } else {
      merged.push(group);
    }
  }

  for (const group of fromRepo) {
    const key = group.name.toLowerCase();
    if (!repoByLowerName.has(key)) continue;
    merged.push(group);
    repoByLowerName.delete(key);
  }

  return normalizeSkillGroups(merged);
}

function buildRepoRootsByUrl(sources: Source[]): Map<string, string[]> {
  const byUrl = new Map<string, string[]>();

  for (const source of sources) {
    const normalizedUrl = normalizedGitHubUrl(source.url);
    if (!normalizedUrl) continue;

    const current = byUrl.get(normalizedUrl) || [];
    current.push(resolve(source.path));
    byUrl.set(normalizedUrl, current);
  }

  return byUrl;
}

function candidateRepoRoots(
  repoUrl: string | undefined,
  byUrl: Map<string, string[]>,
  sourcesRoot: string,
): string[] {
  if (!repoUrl) return [];

  const roots: string[] = [];
  const normalizedUrl = normalizedGitHubUrl(repoUrl);
  if (normalizedUrl) {
    roots.push(...(byUrl.get(normalizedUrl) || []));
  }

  const parsed = parseGitHubRepoUrl(repoUrl);
  if (parsed) {
    roots.push(resolve(join(sourcesRoot, parsed.sourceName)));
  }

  return Array.from(new Set(roots.map((root) => resolve(root))));
}

function resolveCollectionSkillId(
  entry: CollectionSkillEntry,
  allSkillIdsByName: Map<string, string[]>,
  skillIdsByPath: Set<string>,
  repoRootsByUrl: Map<string, string[]>,
  sourcesRoot: string,
): string | null {
  const byRepoRoots = candidateRepoRoots(entry.repoUrl, repoRootsByUrl, sourcesRoot);
  const normalizedSkillPath =
    typeof entry.skillPath === "string" ? entry.skillPath.trim().replace(/^\/+/, "") : "";

  if (normalizedSkillPath && byRepoRoots.length > 0) {
    for (const root of byRepoRoots) {
      const candidatePath = resolve(join(root, normalizedSkillPath));
      if (!isPathWithin(candidatePath, root)) continue;
      if (skillIdsByPath.has(candidatePath)) return candidatePath;
    }

    const fallbackPath = resolve(join(byRepoRoots[0], normalizedSkillPath));
    if (isPathWithin(fallbackPath, byRepoRoots[0])) {
      return fallbackPath;
    }
  }

  const byName = allSkillIdsByName.get(entry.name.trim().toLowerCase()) || [];
  if (byName.length === 0) return null;

  if (byRepoRoots.length > 0) {
    for (const root of byRepoRoots) {
      const matchedByRoot = byName.find((skillId) => isPathWithin(skillId, root));
      if (matchedByRoot) return matchedByRoot;
    }
  }

  return byName[0];
}

export function syncCollectionsFromRepo(
  input: SyncCollectionsFromRepoInput,
): SyncCollectionsFromRepoResult {
  const existingGroups = normalizeSkillGroups(input.existingGroups);
  const repoPath = input.repoPath ? resolve(input.repoPath) : "";
  if (!repoPath) {
    return {
      groups: existingGroups,
      importedGroups: 0,
      updated: false,
    };
  }

  const collections = listCollectionFiles(repoPath);
  if (collections.length === 0) {
    return {
      groups: existingGroups,
      importedGroups: 0,
      updated: false,
    };
  }

  const sortedSkillIds = Array.from(
    new Set(input.skills.map((skill) => resolve(skill.sourcePath))),
  ).sort(compareByName);
  const skillIdsByPath = new Set(sortedSkillIds);
  const skillIdsByName = new Map<string, string[]>();
  for (const skill of input.skills) {
    const key = skill.name.trim().toLowerCase();
    if (!key) continue;
    const sourcePath = resolve(skill.sourcePath);
    const current = skillIdsByName.get(key) || [];
    if (!current.includes(sourcePath)) {
      current.push(sourcePath);
      current.sort(compareByName);
      skillIdsByName.set(key, current);
    }
  }

  const repoRootsByUrl = buildRepoRootsByUrl(input.sources);
  const sourcesRoot = resolve(input.sourcesRoot);
  const repoGroups: NamedSkillGroup[] = collections.map((collection) => {
    const skillIds = Array.from(
      new Set(
        collection.skills
          .map((entry) =>
            resolveCollectionSkillId(
              entry,
              skillIdsByName,
              skillIdsByPath,
              repoRootsByUrl,
              sourcesRoot,
            ),
          )
          .filter((skillId): skillId is string => !!skillId),
      ),
    ).sort(compareByName);

    return {
      name: collection.name,
      skillIds,
    };
  });

  const mergedGroups = mergeGroupsByName(existingGroups, repoGroups);
  return {
    groups: mergedGroups,
    importedGroups: repoGroups.length,
    updated: !groupsEqual(existingGroups, mergedGroups),
  };
}

export function listCollectionFiles(sourcePath: string): CollectionPreview[] {
  if (!existsSync(sourcePath)) return [];

  const entries: CollectionPreview[] = [];
  let files: string[];
  try {
    files = readdirSync(sourcePath).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  for (const file of files) {
    try {
      const raw = readFileSync(join(sourcePath, file), "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed.schemaVersion !== 3 || !Array.isArray(parsed.installedSkills)) continue;

      const skills: CollectionSkillEntry[] = [];
      for (const s of parsed.installedSkills as Array<Record<string, unknown>>) {
        const name = typeof s.name === "string" ? s.name : "";
        if (!name) continue;
        const install = s.install as Record<string, unknown> | undefined;
        skills.push({
          name,
          description: typeof s.description === "string" ? s.description : "",
          ...(typeof install?.repoUrl === "string" ? { repoUrl: install.repoUrl } : {}),
          ...(typeof install?.skillPath === "string" ? { skillPath: install.skillPath } : {}),
        });
      }

      entries.push({
        name: basename(file, ".json"),
        file,
        skillNames: skills.map((s) => s.name),
        skills,
      });
    } catch {
      continue;
    }
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export function collectionFilePath(repoPath: string, name: string): string {
  return join(repoPath, `${name}.json`);
}

export function writeCollectionFile(
  repoPath: string,
  name: string,
  skills: Skill[],
): void {
  const filePath = collectionFilePath(repoPath, name);
  const manifest = buildInstalledSkillsManifest(skills);
  const content = JSON.stringify(manifest, null, 2) + "\n";
  writeFileSync(filePath, content, "utf-8");
}

export function removeCollectionFile(repoPath: string, name: string): void {
  const filePath = collectionFilePath(repoPath, name);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

function cleanGitEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  delete env.GIT_ASKPASS;
  delete env.GIT_TERMINAL_PROMPT;
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.VSCODE_GIT_ASKPASS_MAIN;
  delete env.VSCODE_GIT_ASKPASS_NODE;
  delete env.VSCODE_GIT_ASKPASS_EXTRA_ARGS;
  delete env.VSCODE_GIT_IPC_HANDLE;
  return env;
}

const SSH_REWRITE_CONFIG = "url.git@github.com:.insteadOf=https://github.com/";

function formatGitFailure(result: ReturnType<typeof spawnSync>): string {
  const stderr = result.stderr?.toString().trim();
  const stdout = result.stdout?.toString().trim();
  if (stderr) return stderr;
  if (stdout) return stdout;
  if (result.error?.message) return result.error.message;
  return "Unknown git error.";
}

export function tryCommitCollectionChange(
  repoPath: string,
  collectionName: string,
  action: CollectionAction,
): CollectionCommitResult {
  const filePattern = `${collectionName}.json`;

  const addResult = spawnSync(
    "git",
    ["-C", repoPath, "add", "--all", "--", filePattern],
    { encoding: "utf-8" },
  );
  if (addResult.error || addResult.status !== 0) {
    return {
      committed: false,
      message: `Collection saved, but git add failed: ${formatGitFailure(addResult)}`,
    };
  }

  const diffResult = spawnSync(
    "git",
    ["-C", repoPath, "diff", "--cached", "--quiet", "--", filePattern],
    { encoding: "utf-8" },
  );
  if (diffResult.status === 0) {
    return {
      committed: false,
      message: "No changes to commit.",
    };
  }
  if (diffResult.error || diffResult.status !== 1) {
    return {
      committed: false,
      message: `Collection saved, but git diff failed: ${formatGitFailure(diffResult)}`,
    };
  }

  const commitMessage = `chore(collections): ${action} ${collectionName}`;
  const commitResult = spawnSync(
    "git",
    ["-C", repoPath, "commit", "-m", commitMessage, "--", filePattern],
    { encoding: "utf-8" },
  );
  if (commitResult.error || commitResult.status !== 0) {
    return {
      committed: false,
      message: `Collection saved, but git commit failed: ${formatGitFailure(commitResult)}`,
    };
  }

  return {
    committed: true,
    message: commitMessage,
  };
}

export function syncCollectionToRepo(
  repoPath: string | undefined,
  collectionName: string,
  skills: Skill[],
  action: CollectionAction,
): CollectionCommitResult | null {
  if (!repoPath) return null;

  if (action === "remove") {
    removeCollectionFile(repoPath, collectionName);
  } else {
    writeCollectionFile(repoPath, collectionName, skills);
  }

  return tryCommitCollectionChange(repoPath, collectionName, action);
}

export function syncPersonalRepo(repoPath: string): SyncResult {
  const env = cleanGitEnv();
  const opts = { encoding: "utf-8" as const, env };

  const pullResult = spawnSync(
    "git",
    ["-C", repoPath, "-c", SSH_REWRITE_CONFIG, "pull", "--rebase"],
    opts,
  );
  if (pullResult.error || pullResult.status !== 0) {
    return {
      pulled: false,
      pushed: false,
      message: `Pull failed: ${formatGitFailure(pullResult)}`,
    };
  }

  const pushResult = spawnSync(
    "git",
    ["-C", repoPath, "-c", SSH_REWRITE_CONFIG, "push"],
    opts,
  );
  if (pushResult.error || pushResult.status !== 0) {
    return {
      pulled: true,
      pushed: false,
      message: `Pulled, but push failed: ${formatGitFailure(pushResult)}`,
    };
  }

  return {
    pulled: true,
    pushed: true,
    message: "Synced with remote.",
  };
}
