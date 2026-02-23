import { resolve } from "path";
import type { Skill } from "./types";

export interface NamedSkillSet {
  name: string;
  skillIds: string[];
}

function compareByName(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function normalizeSkillSetName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function normalizeSkillId(raw: string): string {
  return resolve(raw.trim());
}

export function normalizeSkillSets(raw: unknown): NamedSkillSet[] {
  if (!Array.isArray(raw)) return [];

  const byLowerName = new Map<string, NamedSkillSet>();

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const parsed = entry as Record<string, unknown>;
    if (typeof parsed.name !== "string") continue;

    const name = normalizeSkillSetName(parsed.name);
    if (!name) continue;

    const skillIds = Array.isArray(parsed.skillIds)
      ? Array.from(
          new Set(
            parsed.skillIds
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean)
              .map(normalizeSkillId),
          ),
        ).sort(compareByName)
      : [];

    byLowerName.set(name.toLowerCase(), { name, skillIds });
  }

  return Array.from(byLowerName.values()).sort((a, b) =>
    compareByName(a.name, b.name),
  );
}

export function collectEnabledSkillIds(skills: Skill[]): string[] {
  return Array.from(
    new Set(
      skills
        .filter((skill) => skill.installed && !skill.disabled)
        .map((skill) => resolve(skill.sourcePath)),
    ),
  ).sort(compareByName);
}

export interface SkillSetApplyPlan {
  toEnable: Skill[];
  toDisable: Skill[];
  missingSkillIds: string[];
}

export function planNamedSetApplication(
  skills: Skill[],
  rawSkillIds: string[],
): SkillSetApplyPlan {
  const skillIds = Array.from(
    new Set(rawSkillIds.map(normalizeSkillId)),
  ).sort(compareByName);
  const setIds = new Set(skillIds);

  const bySkillId = new Map<string, Skill>();
  const installedSkills: Skill[] = [];
  for (const skill of skills) {
    const skillId = resolve(skill.sourcePath);
    bySkillId.set(skillId, skill);
    if (skill.installed) {
      installedSkills.push(skill);
    }
  }

  const toEnable: Skill[] = [];
  const toDisable: Skill[] = [];
  for (const skill of installedSkills) {
    const skillId = resolve(skill.sourcePath);
    if (setIds.has(skillId)) {
      if (skill.disabled) {
        toEnable.push(skill);
      }
      continue;
    }

    if (!skill.disabled) {
      toDisable.push(skill);
    }
  }

  const missingSkillIds = skillIds.filter((skillId) => !bySkillId.has(skillId));

  return {
    toEnable: toEnable.sort((a, b) => compareByName(a.name, b.name)),
    toDisable: toDisable.sort((a, b) => compareByName(a.name, b.name)),
    missingSkillIds,
  };
}
