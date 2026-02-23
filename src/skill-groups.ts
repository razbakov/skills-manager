import { resolve } from "path";
import type { Skill } from "./types";

export interface NamedSkillGroup {
  name: string;
  skillIds: string[];
}

export interface ResolvedSkillGroups {
  skillGroups: NamedSkillGroup[];
  activeGroups: string[];
  migratedFromLegacy: boolean;
}

export interface SkillGroupTogglePlan {
  activeGroups: string[];
  toEnable: Skill[];
  toDisable: Skill[];
  missingSkillIds: string[];
}

function compareByName(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function normalizeSkillId(raw: string): string {
  return resolve(raw.trim());
}

function canonicalNameMap(groups: NamedSkillGroup[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of groups) {
    map.set(group.name.toLowerCase(), group.name);
  }
  return map;
}

export function normalizeSkillGroupName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function normalizeSkillGroups(raw: unknown): NamedSkillGroup[] {
  if (!Array.isArray(raw)) return [];

  const byLowerName = new Map<string, NamedSkillGroup>();

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const parsed = entry as Record<string, unknown>;
    if (typeof parsed.name !== "string") continue;

    const name = normalizeSkillGroupName(parsed.name);
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

export function normalizeActiveGroups(
  raw: unknown,
  groups: NamedSkillGroup[],
): string[] {
  if (!Array.isArray(raw)) return [];

  const nameMap = canonicalNameMap(groups);
  const active: string[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (typeof entry !== "string") continue;

    const normalized = normalizeSkillGroupName(entry);
    if (!normalized) continue;

    const canonical = nameMap.get(normalized.toLowerCase());
    if (!canonical) continue;

    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    active.push(canonical);
  }

  return active;
}

export function resolveSkillGroupsFromConfig(
  raw: Record<string, unknown>,
): ResolvedSkillGroups {
  const hasNewFields =
    Object.prototype.hasOwnProperty.call(raw, "skillGroups") ||
    Object.prototype.hasOwnProperty.call(raw, "activeGroups");

  if (hasNewFields) {
    const skillGroups = normalizeSkillGroups(raw.skillGroups);
    return {
      skillGroups,
      activeGroups: normalizeActiveGroups(raw.activeGroups, skillGroups),
      migratedFromLegacy: false,
    };
  }

  const skillGroups = normalizeSkillGroups(raw.skillSets);
  const normalizedActiveLegacy =
    typeof raw.activeSkillSet === "string"
      ? normalizeSkillGroupName(raw.activeSkillSet)
      : "";
  return {
    skillGroups,
    activeGroups: normalizedActiveLegacy
      ? normalizeActiveGroups([normalizedActiveLegacy], skillGroups)
      : [],
    migratedFromLegacy:
      skillGroups.length > 0 ||
      (typeof raw.activeSkillSet === "string" && !!normalizedActiveLegacy),
  };
}

function resolveActiveSkillIds(
  groups: NamedSkillGroup[],
  activeGroups: string[],
): Set<string> {
  const activeLower = new Set(activeGroups.map((name) => name.toLowerCase()));
  const skillIds = new Set<string>();

  for (const group of groups) {
    if (!activeLower.has(group.name.toLowerCase())) continue;
    for (const skillId of group.skillIds) {
      skillIds.add(skillId);
    }
  }

  return skillIds;
}

function nextActiveGroups(
  groups: NamedSkillGroup[],
  rawActiveGroups: string[],
  targetName: string,
  setActive: boolean,
): string[] {
  const normalizedTarget = normalizeSkillGroupName(targetName);
  if (!normalizedTarget) {
    throw new Error("Group name is required.");
  }

  const canonicalMap = canonicalNameMap(groups);
  const targetCanonical = canonicalMap.get(normalizedTarget.toLowerCase());
  if (!targetCanonical) {
    throw new Error("Group not found.");
  }

  const currentActive = normalizeActiveGroups(rawActiveGroups, groups);
  const next = new Set(currentActive.map((name) => name.toLowerCase()));

  if (setActive) {
    next.add(targetCanonical.toLowerCase());
  } else {
    next.delete(targetCanonical.toLowerCase());
  }

  const ordered: string[] = [];
  for (const name of currentActive) {
    if (next.has(name.toLowerCase())) {
      ordered.push(name);
      next.delete(name.toLowerCase());
    }
  }

  if (setActive && !ordered.some((name) => name.toLowerCase() === targetCanonical.toLowerCase())) {
    ordered.push(targetCanonical);
    next.delete(targetCanonical.toLowerCase());
  }

  for (const group of groups) {
    if (next.has(group.name.toLowerCase())) {
      ordered.push(group.name);
      next.delete(group.name.toLowerCase());
    }
  }

  return ordered;
}

export function planSkillGroupToggle(
  skills: Skill[],
  groups: NamedSkillGroup[],
  rawActiveGroups: string[],
  targetGroupName: string,
  setActive: boolean,
): SkillGroupTogglePlan {
  const normalizedGroups = normalizeSkillGroups(groups);
  const activeGroups = nextActiveGroups(
    normalizedGroups,
    rawActiveGroups,
    targetGroupName,
    setActive,
  );

  const canonicalMap = canonicalNameMap(normalizedGroups);
  const targetCanonical = canonicalMap.get(
    normalizeSkillGroupName(targetGroupName).toLowerCase(),
  );
  if (!targetCanonical) {
    throw new Error("Group not found.");
  }

  const targetGroup = normalizedGroups.find(
    (group) => group.name.toLowerCase() === targetCanonical.toLowerCase(),
  );
  if (!targetGroup) {
    throw new Error("Group not found.");
  }

  const activeSkillIds = resolveActiveSkillIds(normalizedGroups, activeGroups);
  const targetSkillIds = new Set(targetGroup.skillIds);

  const bySkillId = new Map<string, Skill>();
  for (const skill of skills) {
    bySkillId.set(resolve(skill.sourcePath), skill);
  }

  const toEnable: Skill[] = [];
  const toDisable: Skill[] = [];
  for (const skill of skills) {
    if (!skill.installed) continue;

    const skillId = resolve(skill.sourcePath);
    if (!targetSkillIds.has(skillId)) continue;

    if (setActive) {
      if (skill.disabled) {
        toEnable.push(skill);
      }
      continue;
    }

    if (!activeSkillIds.has(skillId) && !skill.disabled) {
      toDisable.push(skill);
    }
  }

  const missingSkillIds = targetGroup.skillIds.filter(
    (skillId) => !bySkillId.has(skillId),
  );

  return {
    activeGroups,
    toEnable: toEnable.sort((a, b) => compareByName(a.name, b.name)),
    toDisable: toDisable.sort((a, b) => compareByName(a.name, b.name)),
    missingSkillIds,
  };
}

export function findSkillGroupByName(
  groups: NamedSkillGroup[],
  rawName: string,
): NamedSkillGroup | null {
  const normalized = normalizeSkillGroupName(rawName);
  if (!normalized) return null;

  const matched = groups.find(
    (group) => group.name.toLowerCase() === normalized.toLowerCase(),
  );
  return matched ?? null;
}

export function getSkillGroupNamesForSkillId(
  groups: NamedSkillGroup[],
  skillId: string,
): string[] {
  const resolvedSkillId = resolve(skillId);
  return groups
    .filter((group) => group.skillIds.includes(resolvedSkillId))
    .map((group) => group.name)
    .sort(compareByName);
}
