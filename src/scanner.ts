import { readdirSync, readFileSync, lstatSync, readlinkSync, existsSync } from "fs";
import { join, basename, resolve, dirname } from "path";
import matter from "gray-matter";
import type { Config, Skill, Source } from "./types";

interface RawSkill {
  name: string;
  description: string;
  sourcePath: string;
  sourceName: string;
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
    const skillDir = dirname(skillMdPath);
    return {
      name: (data.name as string) || basename(skillDir),
      description: (data.description as string) || "",
      sourcePath: resolve(skillDir),
      sourceName: source.name,
    };
  } catch {
    return null;
  }
}

interface InstalledEntry {
  name: string;
  targetPath: string;
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
  const matchedSources = new Set<string>();

  for (const [sourcePath, raw] of sourceMap) {
    const targetStatus: Record<string, "installed" | "disabled" | "not-installed"> = {};
    let isInstalled = false;
    let allDisabled = true;
    let anyInstalled = false;

    for (const target of config.targets) {
      // Only match by symlink resolution — the symlink must point to this source
      const match = allInstalled.find(
        (e) =>
          e.targetPath === target &&
          e.isSymlink &&
          e.realPath === sourcePath,
      );
      if (match) {
        isInstalled = true;
        anyInstalled = true;
        targetStatus[target] = match.disabled ? "disabled" : "installed";
        if (!match.disabled) allDisabled = false;
        matchedSources.add(sourcePath);
      } else {
        targetStatus[target] = "not-installed";
      }
    }

    skills.push({
      name: raw.name,
      description: raw.description,
      sourcePath: raw.sourcePath,
      sourceName: raw.sourceName,
      installed: isInstalled,
      disabled: anyInstalled && allDisabled,
      targetStatus,
    });
  }

  return skills;
}
