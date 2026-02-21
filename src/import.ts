import { existsSync, readFileSync } from "fs";
import { isAbsolute, join, relative, resolve } from "path";
import { addGitHubSource, installSkill } from "./actions";
import { getSourcesRootPath } from "./config";
import { scan } from "./scanner";
import type { Config, Skill } from "./types";

interface ParsedGitHubRepo {
  owner: string;
  repo: string;
  canonicalUrl: string;
  sourceName: string;
}

export interface ImportedSkillDescriptor {
  name: string;
  description?: string;
  repoUrl?: string;
  skillPath?: string;
}

interface ImportManifest {
  installedSkills: unknown[];
}

export interface ImportInstalledSkillsResult {
  inputPath: string;
  requested: number;
  installed: number;
  alreadyInstalled: number;
  addedSources: number;
  missingRepoUrl: number;
  unsupportedRepoUrl: number;
  missingSkills: string[];
}

export interface ImportInstalledSkillsOptions {
  selectedIndexes?: number[];
}

function parseGitHubRepoUrl(input: string): ParsedGitHubRepo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (sshMatch) {
    const owner = sshMatch[1];
    const repo = sshMatch[2].replace(/\.git$/i, "");
    if (!owner || !repo) return null;
    return {
      owner,
      repo,
      canonicalUrl: `https://github.com/${owner}/${repo}`,
      sourceName: `${repo}@${owner}`,
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

function parseManifest(inputPath: string): ImportedSkillDescriptor[] {
  const resolvedPath = resolve(inputPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Import file not found: ${resolvedPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolvedPath, "utf-8")) as unknown;
  } catch (err: any) {
    throw new Error(`Could not parse JSON: ${err?.message || "Unknown error"}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid import file: expected a JSON object.");
  }

  const manifest = parsed as Partial<ImportManifest>;
  if (!Array.isArray(manifest.installedSkills)) {
    throw new Error("Invalid import file: expected installedSkills array.");
  }

  const parsedDescriptors: Array<ImportedSkillDescriptor | null> = manifest.installedSkills.map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    const install = (row.install as Record<string, unknown> | undefined) || {};
    const name = typeof row.name === "string" ? row.name : "";
    const description = typeof row.description === "string" ? row.description : undefined;

    const descriptor: ImportedSkillDescriptor = { name };
    if (description) {
      descriptor.description = description;
    }
    if (typeof install.repoUrl === "string") {
      descriptor.repoUrl = install.repoUrl;
    }
    if (typeof install.skillPath === "string") {
      descriptor.skillPath = install.skillPath;
    }
    return descriptor;
  });

  return parsedDescriptors.filter(
    (entry): entry is ImportedSkillDescriptor => !!entry && !!entry.name.trim(),
  );
}

export function previewInstalledSkillsManifest(inputPath: string): {
  inputPath: string;
  skills: ImportedSkillDescriptor[];
} {
  const resolvedInputPath = resolve(inputPath);
  return {
    inputPath: resolvedInputPath,
    skills: parseManifest(resolvedInputPath),
  };
}

function isPathWithin(path: string, root: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function findSkillForImport(
  skills: Skill[],
  descriptor: ImportedSkillDescriptor,
  repoRoot: string,
): Skill | undefined {
  const targetSkillPath = descriptor.skillPath
    ? resolve(join(repoRoot, descriptor.skillPath))
    : null;

  if (targetSkillPath) {
    const directMatch = skills.find((skill) => resolve(skill.sourcePath) === targetSkillPath);
    if (directMatch) return directMatch;
  }

  return skills.find(
    (skill) => skill.name === descriptor.name && isPathWithin(resolve(skill.sourcePath), repoRoot),
  );
}

export function defaultInstalledSkillsImportPath(cwd: string = process.cwd()): string {
  return resolve(cwd, "installed-skills.json");
}

export async function importInstalledSkills(
  config: Config,
  inputPath: string,
  options: ImportInstalledSkillsOptions = {},
): Promise<ImportInstalledSkillsResult> {
  const resolvedInputPath = resolve(inputPath);
  const allDescriptors = parseManifest(resolvedInputPath);
  const selectedIndexes = Array.isArray(options.selectedIndexes)
    ? new Set(
      options.selectedIndexes
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value < allDescriptors.length),
    )
    : null;
  const descriptors = selectedIndexes
    ? allDescriptors.filter((_, index) => selectedIndexes.has(index))
    : allDescriptors;
  const sourcesRoot = resolve(getSourcesRootPath(config));

  let missingRepoUrl = 0;
  let unsupportedRepoUrl = 0;
  let addedSources = 0;
  const repoRootByCanonicalUrl = new Map<string, string>();

  for (const descriptor of descriptors) {
    if (!descriptor.repoUrl) {
      missingRepoUrl += 1;
      continue;
    }

    const parsedRepo = parseGitHubRepoUrl(descriptor.repoUrl);
    if (!parsedRepo) {
      unsupportedRepoUrl += 1;
      continue;
    }

    const key = parsedRepo.canonicalUrl.toLowerCase();
    if (repoRootByCanonicalUrl.has(key)) continue;

    try {
      addGitHubSource(parsedRepo.canonicalUrl, config);
      addedSources += 1;
    } catch (err: any) {
      const message = (err?.message || "").toLowerCase();
      if (!message.includes("source already added")) {
        throw err;
      }
    }

    repoRootByCanonicalUrl.set(key, resolve(join(sourcesRoot, parsedRepo.sourceName)));
  }

  const skills = await scan(config);
  let installed = 0;
  let alreadyInstalled = 0;
  const missingSkills: string[] = [];

  for (const descriptor of descriptors) {
    if (!descriptor.repoUrl) continue;
    const parsedRepo = parseGitHubRepoUrl(descriptor.repoUrl);
    if (!parsedRepo) continue;

    const key = parsedRepo.canonicalUrl.toLowerCase();
    const repoRoot = repoRootByCanonicalUrl.get(key) || resolve(join(sourcesRoot, parsedRepo.sourceName));
    const skill = findSkillForImport(skills, descriptor, repoRoot);
    if (!skill) {
      missingSkills.push(descriptor.name);
      continue;
    }

    if (skill.installed) {
      alreadyInstalled += 1;
      continue;
    }

    installSkill(skill, config);
    installed += 1;
  }

  return {
    inputPath: resolvedInputPath,
    requested: descriptors.length,
    installed,
    alreadyInstalled,
    addedSources,
    missingRepoUrl,
    unsupportedRepoUrl,
    missingSkills,
  };
}
