import { describe, it, expect } from "bun:test";
import {
  normalizeSkillSetName,
  normalizeSkillSets,
  collectEnabledSkillIds,
  planNamedSetApplication,
} from "./skill-sets";
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

describe("normalizeSkillSetName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeSkillSetName("  Writing   Core  ")).toBe("Writing Core");
  });
});

describe("normalizeSkillSets", () => {
  it("keeps valid entries, dedupes names, and normalizes skill ids", () => {
    const normalized = normalizeSkillSets([
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

describe("collectEnabledSkillIds", () => {
  it("includes only installed and enabled skills", () => {
    const ids = collectEnabledSkillIds([
      skill({ name: "enabled-a", installed: true, disabled: false }),
      skill({ name: "enabled-b", installed: true, disabled: false }),
      skill({ name: "disabled-a", installed: true, disabled: true }),
      skill({ name: "available-a", installed: false, disabled: false }),
    ]);

    expect(ids).toEqual(["/skills/enabled-a", "/skills/enabled-b"]);
  });
});

describe("planNamedSetApplication", () => {
  it("enables skills in set, disables other installed skills, and reports missing", () => {
    const skills = [
      skill({ name: "a", sourcePath: "/skills/a", installed: true, disabled: true }),
      skill({ name: "b", sourcePath: "/skills/b", installed: true, disabled: false }),
      skill({ name: "c", sourcePath: "/skills/c", installed: true, disabled: false }),
      skill({ name: "d", sourcePath: "/skills/d", installed: false, disabled: false }),
    ];

    const plan = planNamedSetApplication(skills, ["/skills/a", "/skills/missing"]);

    expect(plan.toEnable.map((s) => s.sourcePath)).toEqual(["/skills/a"]);
    expect(plan.toDisable.map((s) => s.sourcePath)).toEqual(["/skills/b", "/skills/c"]);
    expect(plan.missingSkillIds).toEqual(["/skills/missing"]);
  });
});
