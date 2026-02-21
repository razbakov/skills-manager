import { spawnSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, relative, resolve } from "path";
import type { Skill } from "./types";

export interface SkillInstallExport {
  repoUrl?: string;
  skillPath?: string;
}

export interface InstalledSkillExport {
  name: string;
  description: string;
  install: SkillInstallExport;
}

export interface InstalledSkillsManifest {
  schemaVersion: 3;
  generatedAt: string;
  installedSkills: InstalledSkillExport[];
}

export function normalizeRepoUrl(raw: string): string {
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

interface RepoInstallMeta {
  repoUrl: string;
  skillPath?: string;
}

function detectRepoInstallMeta(sourcePath: string): RepoInstallMeta | null {
  const repoRootResult = spawnSync(
    "git",
    ["-C", sourcePath, "rev-parse", "--show-toplevel"],
    { encoding: "utf-8" },
  );
  if (repoRootResult.error || repoRootResult.status !== 0) return null;

  const repoRoot = repoRootResult.stdout?.toString().trim();
  if (!repoRoot) return null;

  const repoUrlResult = spawnSync(
    "git",
    ["-C", repoRoot, "remote", "get-url", "origin"],
    { encoding: "utf-8" },
  );
  if (repoUrlResult.error || repoUrlResult.status !== 0) return null;

  const rawRepoUrl = repoUrlResult.stdout?.toString().trim();
  if (!rawRepoUrl) return null;

  const skillPathRel = relative(repoRoot, sourcePath).replace(/\\/g, "/");
  const skillPath =
    skillPathRel && skillPathRel !== "." && !skillPathRel.startsWith("..")
      ? skillPathRel
      : undefined;

  return {
    repoUrl: normalizeRepoUrl(rawRepoUrl),
    ...(skillPath ? { skillPath } : {}),
  };
}

function buildInstallExport(skill: Skill): SkillInstallExport {
  const repo = detectRepoInstallMeta(skill.sourcePath);
  if (!repo) return {};

  return {
    repoUrl: repo.repoUrl,
    ...(repo.skillPath ? { skillPath: repo.skillPath } : {}),
  };
}

export function buildInstalledSkillsManifest(skills: Skill[]): InstalledSkillsManifest {
  const installedSkills = skills
    .filter((skill) => skill.installed)
    .map((skill) => ({
      name: skill.name,
      description: skill.description,
      install: buildInstallExport(skill),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    installedSkills,
  };
}

export function defaultInstalledSkillsExportPath(cwd: string = process.cwd()): string {
  return resolve(cwd, "installed-skills.json");
}

export function exportInstalledSkills(skills: Skill[], outputPath: string): string {
  const resolvedOutputPath = resolve(outputPath);
  const manifest = buildInstalledSkillsManifest(skills);
  mkdirSync(dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  return resolvedOutputPath;
}
