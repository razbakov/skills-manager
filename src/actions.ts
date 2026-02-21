import {
  symlinkSync,
  unlinkSync,
  mkdirSync,
  renameSync,
  existsSync,
  lstatSync,
  rmSync,
} from "fs";
import { spawnSync } from "child_process";
import { join, basename, resolve } from "path";
import { getSourcesRootPath, saveConfig } from "./config";
import type { Config, Skill, Source } from "./types";

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getInstallDirName(skill: Skill): string {
  return skill.installName || basename(skill.sourcePath);
}

interface ParsedGitHubRepo {
  owner: string;
  repo: string;
  canonicalUrl: string;
  sourceName: string;
}

function parseGitHubRepoUrl(input: string): ParsedGitHubRepo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (sshMatch) {
    const owner = sshMatch[1];
    const repo = sshMatch[2];
    const canonicalRepo = repo.replace(/\.git$/i, "");
    if (!owner || !canonicalRepo) return null;
    return {
      owner,
      repo: canonicalRepo,
      canonicalUrl: `https://github.com/${owner}/${canonicalRepo}`,
      sourceName: `${canonicalRepo}@${owner}`,
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;

  const segments = parsedUrl.pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  if (segments.length !== 2) return null;

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");
  if (!owner || !repo) return null;

  return {
    owner,
    repo,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
    sourceName: `${repo}@${owner}`,
  };
}

function normalizedGitHubUrl(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = parseGitHubRepoUrl(value);
  return parsed ? parsed.canonicalUrl.toLowerCase() : null;
}

function resolveSourcesRoot(config: Config): string {
  return resolve(getSourcesRootPath(config));
}

export function addGitHubSource(repoUrl: string, config: Config): Source {
  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error("Invalid GitHub repository URL.");
  }

  const sourceNameLower = parsed.sourceName.toLowerCase();
  const canonicalUrlLower = parsed.canonicalUrl.toLowerCase();
  const duplicate = config.sources.some(
    (source) =>
      source.name.toLowerCase() === sourceNameLower ||
      normalizedGitHubUrl(source.url) === canonicalUrlLower,
  );

  if (duplicate) {
    throw new Error("Source already added");
  }

  const sourcesRoot = resolveSourcesRoot(config);
  ensureDir(sourcesRoot);
  const clonePath = resolve(join(sourcesRoot, parsed.sourceName));

  if (existsSync(clonePath)) {
    throw new Error("Source already added");
  }

  const cloneResult = spawnSync(
    "git",
    ["clone", "--depth", "1", parsed.canonicalUrl, clonePath],
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

  const source: Source = {
    name: parsed.sourceName,
    path: clonePath,
    recursive: true,
    url: parsed.canonicalUrl,
  };

  return source;
}

export function installSkill(skill: Skill, config: Config): void {
  const dirName = getInstallDirName(skill);

  for (const target of config.targets) {
    ensureDir(target);
    const linkPath = join(target, dirName);

    if (entryExists(linkPath)) continue;

    // Also check .disabled — if it's there, enable it instead
    const disabledPath = join(target, ".disabled", dirName);
    if (entryExists(disabledPath)) {
      renameSync(disabledPath, linkPath);
      continue;
    }

    symlinkSync(skill.sourcePath, linkPath);
  }

  skill.installed = true;
  skill.disabled = false;
  for (const target of config.targets) {
    skill.targetStatus[target] = "installed";
  }
}

export function uninstallSkill(skill: Skill, config: Config): void {
  const dirName = getInstallDirName(skill);

  for (const target of config.targets) {
    const linkPath = join(target, dirName);
    removeIfSymlink(linkPath);

    const disabledPath = join(target, ".disabled", dirName);
    removeIfSymlink(disabledPath);
  }

  skill.installed = false;
  skill.disabled = false;
  for (const target of config.targets) {
    skill.targetStatus[target] = "not-installed";
  }
}

export function disableSkill(skill: Skill, config: Config): void {
  const dirName = getInstallDirName(skill);

  for (const target of config.targets) {
    ensureDir(target);
    const disabledDir = join(target, ".disabled");
    ensureDir(disabledDir);
    const disabledPath = join(disabledDir, dirName);

    if (entryExists(disabledPath)) continue;

    const linkPath = join(target, dirName);
    if (entryExists(linkPath)) {
      // Active → move to disabled
      renameSync(linkPath, disabledPath);
    } else {
      // Not installed at all → create directly in .disabled/
      symlinkSync(skill.sourcePath, disabledPath);
    }
  }

  skill.installed = true;
  skill.disabled = true;
  for (const target of config.targets) {
    skill.targetStatus[target] = "disabled";
  }
}

export function enableSkill(skill: Skill, config: Config): void {
  const dirName = getInstallDirName(skill);

  for (const target of config.targets) {
    ensureDir(target);
    const linkPath = join(target, dirName);

    if (entryExists(linkPath)) continue;

    const disabledPath = join(target, ".disabled", dirName);
    if (entryExists(disabledPath)) {
      // Disabled → move to active
      renameSync(disabledPath, linkPath);
    } else {
      // Not installed at all → create symlink
      symlinkSync(skill.sourcePath, linkPath);
    }
  }

  skill.installed = true;
  skill.disabled = false;
  for (const target of config.targets) {
    skill.targetStatus[target] = "installed";
  }
}

export function fixPartialInstalls(skills: Skill[], config: Config): void {
  if (config.targets.length <= 1) return;

  for (const skill of skills) {
    if (!skill.installed) continue;
    if (skill.unmanaged) continue;

    const isPartialActive =
      !skill.disabled &&
      !config.targets.every((t) => skill.targetStatus[t] === "installed");

    const isPartialDisabled =
      skill.disabled &&
      !config.targets.every((t) => skill.targetStatus[t] === "disabled");

    if (isPartialActive) {
      enableSkill(skill, config);
    } else if (isPartialDisabled) {
      disableSkill(skill, config);
    }
  }
}

// Unlike existsSync, returns true even for broken symlinks.
function entryExists(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

export function adoptSkill(skill: Skill, config: Config, sourcesRoot: string): void {
  if (!skill.unmanaged) return;

  const dirName = getInstallDirName(skill);
  const adoptDir = join(resolve(sourcesRoot), "local");
  ensureDir(adoptDir);
  const newSourcePath = join(adoptDir, dirName);

  if (entryExists(newSourcePath)) {
    throw new Error(
      `A skill named "${dirName}" already exists in the local source. Rename it first.`,
    );
  }

  // Find where the skill lives as a real (non-symlink) directory
  let originalPath: string | null = null;
  for (const target of config.targets) {
    for (const candidate of [join(target, dirName), join(target, ".disabled", dirName)]) {
      try {
        const st = lstatSync(candidate);
        if (!st.isSymbolicLink()) {
          originalPath = candidate;
          break;
        }
      } catch { /* not present */ }
    }
    if (originalPath) break;
  }

  if (!originalPath) {
    throw new Error("Cannot find the skill directory to adopt.");
  }

  // Move to the managed sources directory
  renameSync(originalPath, newSourcePath);

  // Replace original location with a symlink
  symlinkSync(newSourcePath, originalPath);

  // Update skill state so installSkill works correctly
  skill.sourcePath = newSourcePath;
  skill.unmanaged = false;

  // Propagate to all remaining targets
  installSkill(skill, config);
}

function removeIfSymlink(path: string): void {
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      unlinkSync(path);
    }
  } catch {
    // doesn't exist or can't access
  }
}

export function disableSource(sourcePath: string, config: Config): void {
  const resolved = resolve(sourcePath);
  if (!config.disabledSources.includes(resolved)) {
    config.disabledSources.push(resolved);
  }
  saveConfig(config);
}

export function enableSource(sourcePath: string, config: Config): void {
  const resolved = resolve(sourcePath);
  config.disabledSources = config.disabledSources.filter((p) => resolve(p) !== resolved);
  saveConfig(config);
}

export function removeSource(sourcePath: string, config: Config, skills: Skill[]): void {
  const resolved = resolve(sourcePath);

  for (const skill of skills) {
    const skillResolved = resolve(skill.sourcePath);
    if (skillResolved === resolved || skillResolved.startsWith(resolved + "/")) {
      if (skill.installed || skill.disabled) {
        uninstallSkill(skill, config);
      }
    }
  }

  if (existsSync(resolved)) {
    rmSync(resolved, { recursive: true, force: true });
  }

  config.disabledSources = config.disabledSources.filter((p) => resolve(p) !== resolved);
  saveConfig(config);
}
