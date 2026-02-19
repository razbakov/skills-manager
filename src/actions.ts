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
import { findKitchenSource } from "./config";
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

function resolveKitchenRoot(config: Config): string {
  const kitchenSource = findKitchenSource(config);
  if (!kitchenSource) {
    throw new Error("Kitchen source is not configured.");
  }

  return resolve(kitchenSource.path);
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

  const kitchenRoot = resolveKitchenRoot(config);
  ensureDir(kitchenRoot);
  const clonePath = resolve(join(kitchenRoot, parsed.sourceName));

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

    if (existsSync(linkPath)) continue;

    // Also check .disabled — if it's there, enable it instead
    const disabledPath = join(target, ".disabled", dirName);
    if (existsSync(disabledPath)) {
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
    const linkPath = join(target, dirName);
    if (!existsSync(linkPath)) continue;

    const disabledDir = join(target, ".disabled");
    ensureDir(disabledDir);

    const disabledPath = join(disabledDir, dirName);
    renameSync(linkPath, disabledPath);
  }

  skill.disabled = true;
  for (const target of config.targets) {
    if (skill.targetStatus[target] === "installed") {
      skill.targetStatus[target] = "disabled";
    }
  }
}

export function enableSkill(skill: Skill, config: Config): void {
  const dirName = getInstallDirName(skill);

  for (const target of config.targets) {
    const disabledPath = join(target, ".disabled", dirName);
    if (!existsSync(disabledPath)) continue;

    const linkPath = join(target, dirName);
    renameSync(disabledPath, linkPath);
  }

  skill.disabled = false;
  for (const target of config.targets) {
    if (skill.targetStatus[target] === "disabled") {
      skill.targetStatus[target] = "installed";
    }
  }
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
