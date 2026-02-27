import { describe, expect, it } from "bun:test";
import {
  normalizeSkillGroupName,
  normalizeSkillGroups,
  normalizeActiveGroups,
  planSkillGroupToggle,
  resolveSkillGroupsFromConfig,
  upsertSkillGroupMembers,
  type NamedSkillGroup,
} from "./skill-groups";
import type { Skill } from "./types";

function skill(overrides: Partial<Skill> & { name: string }): Skill {
  return {
    name: overrides.name,
    description: "",
    sourcePath: `/skills/${overrides.name}`,
    sourceName: "test-source",
    installName: overrides.installName,
    installed: false,
    disabled: false,
    unmanaged: false,
    targetStatus: {},
    ...overrides,
  };
}

describe("normalizeSkillGroupName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeSkillGroupName("  Writing   Core  ")).toBe("Writing Core");
  });
});

describe("normalizeSkillGroups", () => {
  it("keeps valid entries, dedupes names, and normalizes skill ids", () => {
    const normalized = normalizeSkillGroups([
      { name: " Writing ", skillIds: ["/a", "/a", " "] },
      { name: "writing", skillIds: ["/b"] },
      { name: "", skillIds: ["/x"] },
      { name: "Research", skillIds: ["/r-1", "/r-2"] },
      null,
    ]);

    expect(normalized).toEqual([
      { name: "Research", skillIds: ["/r-1", "/r-2"] },
      { name: "writing", skillIds: ["/b"] },
    ]);
  });
});

describe("normalizeActiveGroups", () => {
  const groups: NamedSkillGroup[] = [
    { name: "Coding", skillIds: ["/skills/a"] },
    { name: "Writing", skillIds: ["/skills/b"] },
  ];

  it("canonicalizes active names, removes unknown, and dedupes", () => {
    expect(normalizeActiveGroups(["writing", " Writing ", "unknown"], groups)).toEqual([
      "Writing",
    ]);
  });
});

describe("resolveSkillGroupsFromConfig", () => {
  it("migrates legacy skill sets when new fields are absent", () => {
    const resolved = resolveSkillGroupsFromConfig({
      skillSets: [{ name: "Writing", skillIds: ["/skills/a"] }],
      activeSkillSet: "writing",
    });

    expect(resolved).toEqual({
      skillGroups: [{ name: "Writing", skillIds: ["/skills/a"] }],
      activeGroups: ["Writing"],
      migratedFromLegacy: true,
    });
  });

  it("prefers new fields when they exist", () => {
    const resolved = resolveSkillGroupsFromConfig({
      skillGroups: [{ name: "Coding", skillIds: ["/skills/c"] }],
      activeGroups: ["coding"],
      skillSets: [{ name: "Legacy", skillIds: ["/skills/l"] }],
      activeSkillSet: "Legacy",
    });

    expect(resolved).toEqual({
      skillGroups: [{ name: "Coding", skillIds: ["/skills/c"] }],
      activeGroups: ["Coding"],
      migratedFromLegacy: false,
    });
  });
});

describe("planSkillGroupToggle", () => {
  const groups: NamedSkillGroup[] = [
    { name: "Writing", skillIds: ["/skills/a", "/skills/b"] },
    { name: "Coding", skillIds: ["/skills/b", "/skills/c"] },
  ];

  it("enables installed disabled members when toggled on", () => {
    const skills = [
      skill({ name: "a", sourcePath: "/skills/a", installed: true, disabled: true }),
      skill({ name: "b", sourcePath: "/skills/b", installed: true, disabled: false }),
      skill({ name: "x", sourcePath: "/skills/x", installed: false, disabled: false }),
    ];

    const plan = planSkillGroupToggle(skills, groups, [], "Writing", true);

    expect(plan.activeGroups).toEqual(["Writing"]);
    expect(plan.toEnable.map((entry) => entry.sourcePath)).toEqual(["/skills/a"]);
    expect(plan.toDisable).toEqual([]);
    expect(plan.missingSkillIds).toEqual([]);
  });

  it("disables installed skills outside active groups when entering group mode", () => {
    const skills = [
      skill({ name: "a", sourcePath: "/skills/a", installed: true, disabled: true }),
      skill({ name: "b", sourcePath: "/skills/b", installed: true, disabled: false }),
      skill({ name: "c", sourcePath: "/skills/c", installed: true, disabled: false }),
      skill({ name: "d", sourcePath: "/skills/d", installed: true, disabled: false }),
    ];

    const plan = planSkillGroupToggle(skills, groups, [], "Writing", true);

    expect(plan.activeGroups).toEqual(["Writing"]);
    expect(plan.toEnable.map((entry) => entry.sourcePath)).toEqual(["/skills/a"]);
    expect(plan.toDisable.map((entry) => entry.sourcePath)).toEqual([
      "/skills/c",
      "/skills/d",
    ]);
    expect(plan.missingSkillIds).toEqual([]);
  });

  it("disables only members not covered by another active group when toggled off", () => {
    const skills = [
      skill({ name: "a", sourcePath: "/skills/a", installed: true, disabled: false }),
      skill({ name: "b", sourcePath: "/skills/b", installed: true, disabled: false }),
      skill({ name: "c", sourcePath: "/skills/c", installed: true, disabled: false }),
    ];

    const plan = planSkillGroupToggle(
      skills,
      groups,
      ["Writing", "Coding"],
      "Writing",
      false,
    );

    expect(plan.activeGroups).toEqual(["Coding"]);
    expect(plan.toEnable).toEqual([]);
    expect(plan.toDisable.map((entry) => entry.sourcePath)).toEqual(["/skills/a"]);
    expect(plan.missingSkillIds).toEqual([]);
  });

  it("reports missing skill ids defined in the target group", () => {
    const skills = [
      skill({ name: "a", sourcePath: "/skills/a", installed: true, disabled: false }),
    ];
    const definedGroups: NamedSkillGroup[] = [
      { name: "Writing", skillIds: ["/skills/a", "/skills/missing"] },
    ];

    const plan = planSkillGroupToggle(skills, definedGroups, [], "Writing", true);

    expect(plan.missingSkillIds).toEqual(["/skills/missing"]);
  });
});

describe("upsertSkillGroupMembers", () => {
  it("creates a new collection with normalized name and members", () => {
    const result = upsertSkillGroupMembers([], "  My   Collection  ", ["/a", "/a", " /b "]);

    expect(result).toEqual({
      groups: [{ name: "My Collection", skillIds: ["/a", "/b"] }],
      groupName: "My Collection",
      created: true,
      addedSkillIds: ["/a", "/b"],
    });
  });

  it("adds only missing members when collection already exists", () => {
    const result = upsertSkillGroupMembers(
      [{ name: "Team Set", skillIds: ["/a"] }],
      "team set",
      ["/a", "/b", "/c"],
    );

    expect(result).toEqual({
      groups: [{ name: "Team Set", skillIds: ["/a", "/b", "/c"] }],
      groupName: "Team Set",
      created: false,
      addedSkillIds: ["/b", "/c"],
    });
  });
});
