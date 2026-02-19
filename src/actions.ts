import { symlinkSync, unlinkSync, mkdirSync, renameSync, existsSync, lstatSync } from "fs";
import { join, basename } from "path";
import type { Config, Skill } from "./types";

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getInstallDirName(skill: Skill): string {
  return skill.installName || basename(skill.sourcePath);
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
