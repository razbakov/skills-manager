import { readdirSync, readFileSync, lstatSync, readlinkSync, existsSync } from "fs";
import { join, basename, resolve, dirname } from "path";
import matter from "gray-matter";
import type { Config, Skill, Source } from "./types";

interface RawSkill {
  name: string;
  description: string;
  sourcePath: string;
  sourceName: string;
  installName: string;
}

interface SkillMeta {
  name: string;
  description: string;
}

function readSkillMetaFromDir(skillDir: string, fallbackName: string): SkillMeta {
  try {
    const content = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    const { data } = matter(content);
    return {
      name: (data.name as string) || fallbackName,
      description: (data.description as string) || "",
    };
  } catch {
    return {
      name: fallbackName,
      description: "",
    };
  }
}

function findSkillMdFiles(dir: string, recursive: boolean): string[] {
  const results: string[] = [];

  if (!existsSync(dir)) return results;

  if (recursive) {
    walkRecursive(dir, results);
  } else {
    // One level deep: dir/*/SKILL.md
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".")) continue;
        const skillMd = join(dir, entry.name, "SKILL.md");
        if (existsSync(skillMd)) {
          results.push(skillMd);
        }
      }
    } catch {
      // skip inaccessible dirs
    }
  }

  return results;
}

function walkRecursive(dir: string, results: string[]): void {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules")
        continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const skillMd = join(full, "SKILL.md");
        if (existsSync(skillMd)) {
          results.push(skillMd);
        }
        walkRecursive(full, results);
      }
    }
  } catch {
    // skip inaccessible dirs
  }
}

function parseSkillMd(skillMdPath: string, source: Source): RawSkill | null {
  try {
    const content = readFileSync(skillMdPath, "utf-8");
    const { data } = matter(content);
    const skillDir = resolve(dirname(skillMdPath));
    return {
      name: (data.name as string) || basename(skillDir),
      description: (data.description as string) || "",
      sourcePath: skillDir,
      sourceName: source.name,
      installName: basename(skillDir),
    };
  } catch {
    return null;
  }
}

interface InstalledEntry {
  name: string;
  targetPath: string;
  fullPath: string;
  realPath: string | null;
  disabled: boolean;
  isSymlink: boolean;
}

function scanTarget(targetDir: string): InstalledEntry[] {
  const entries: InstalledEntry[] = [];

  if (!existsSync(targetDir)) return entries;

  // Scan enabled skills
  try {
    for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = join(targetDir, entry.name);
      const stat = lstatSync(fullPath);
      const isSymlink = stat.isSymbolicLink();
      let realPath: string | null = null;

      if (isSymlink) {
        try {
          realPath = resolve(targetDir, readlinkSync(fullPath));
        } catch {
          // broken symlink
        }
      }

      if (isSymlink || stat.isDirectory()) {
        entries.push({
          name: entry.name,
          targetPath: targetDir,
          fullPath,
          realPath,
          disabled: false,
          isSymlink,
        });
      }
    }
  } catch {
    // skip
  }

  // Scan .disabled/ subdirectory
  const disabledDir = join(targetDir, ".disabled");
  if (existsSync(disabledDir)) {
    try {
      for (const entry of readdirSync(disabledDir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const fullPath = join(disabledDir, entry.name);
        const stat = lstatSync(fullPath);
        const isSymlink = stat.isSymbolicLink();
        let realPath: string | null = null;

        if (isSymlink) {
          try {
            realPath = resolve(disabledDir, readlinkSync(fullPath));
          } catch {
            // broken symlink
          }
        }

        if (isSymlink || stat.isDirectory()) {
          entries.push({
            name: entry.name,
            targetPath: targetDir,
            fullPath,
            realPath,
            disabled: true,
            isSymlink,
          });
        }
      }
    } catch {
      // skip
    }
  }

  return entries;
}

function newTargetStatus(targets: string[]): Record<string, "installed" | "disabled" | "not-installed"> {
  const status: Record<string, "installed" | "disabled" | "not-installed"> = {};
  for (const target of targets) {
    status[target] = "not-installed";
  }
  return status;
}

interface UnmatchedGroup {
  key: string;
  name: string;
  description: string;
  sourcePath: string;
  sourceName: string;
  installName: string;
  targetStatus: Record<string, "installed" | "disabled" | "not-installed">;
}

export function scan(config: Config): Skill[] {
  // 1. Find all source skills
  const rawSkills: RawSkill[] = [];
  for (const source of config.sources) {
    const files = findSkillMdFiles(source.path, source.recursive ?? false);
    for (const f of files) {
      const skill = parseSkillMd(f, source);
      if (skill) rawSkills.push(skill);
    }
  }

  // Deduplicate by sourcePath
  const sourceMap = new Map<string, RawSkill>();
  for (const s of rawSkills) {
    sourceMap.set(s.sourcePath, s);
  }

  // 2. Scan all targets for installed skills
  const allInstalled: InstalledEntry[] = [];
  for (const target of config.targets) {
    allInstalled.push(...scanTarget(target));
  }

  // 3. Build unified skill list
  const skills: Skill[] = [];
  const matchedInstalled = new Set<number>();

  for (const [sourcePath, raw] of sourceMap) {
    const targetStatus = newTargetStatus(config.targets);
    const sourceDirName = basename(sourcePath);
    let anyInstalled = false;
    let allDisabled = true;
    let detectedInstallName = raw.installName;

    for (const target of config.targets) {
      const matchIndex = allInstalled.findIndex(
        (entry, i) =>
          !matchedInstalled.has(i) &&
          entry.targetPath === target &&
          (
            (entry.isSymlink && entry.realPath === sourcePath) ||
            (!entry.isSymlink && entry.name === sourceDirName)
          ),
      );

      if (matchIndex >= 0) {
        const match = allInstalled[matchIndex];
        matchedInstalled.add(matchIndex);

        targetStatus[target] = match.disabled ? "disabled" : "installed";
        anyInstalled = true;
        if (!match.disabled) allDisabled = false;
        detectedInstallName = match.name;
      }
    }

    skills.push({
      name: raw.name,
      description: raw.description,
      sourcePath: raw.sourcePath,
      sourceName: raw.sourceName,
      installName: detectedInstallName,
      installed: anyInstalled,
      disabled: anyInstalled && allDisabled,
      targetStatus,
    });
  }

  // 4. Add installed skills that don't exist in source folders
  const unmatchedGroups = new Map<string, UnmatchedGroup>();

  for (const [index, entry] of allInstalled.entries()) {
    if (matchedInstalled.has(index)) continue;

    const key = entry.realPath
      ? `external:${entry.realPath}|name:${entry.name}`
      : `target-copy:${entry.name}`;

    let group = unmatchedGroups.get(key);
    if (!group) {
      const originPath = entry.realPath || entry.fullPath;
      const meta = readSkillMetaFromDir(originPath, entry.name);

      group = {
        key,
        name: meta.name,
        description: meta.description,
        sourcePath: originPath,
        sourceName: entry.realPath ? "external" : "target-copy",
        installName: entry.name,
        targetStatus: newTargetStatus(config.targets),
      };
      unmatchedGroups.set(key, group);
    }

    group.targetStatus[entry.targetPath] = entry.disabled ? "disabled" : "installed";
  }

  for (const group of unmatchedGroups.values()) {
    const statuses = Object.values(group.targetStatus).filter(
      (s) => s !== "not-installed",
    );
    const anyInstalled = statuses.length > 0;
    const allDisabled = anyInstalled && statuses.every((s) => s === "disabled");

    skills.push({
      name: group.name,
      description: group.description,
      sourcePath: group.sourcePath,
      sourceName: group.sourceName,
      installName: group.installName,
      installed: anyInstalled,
      disabled: allDisabled,
      targetStatus: group.targetStatus,
    });
  }

  return skills;
}
