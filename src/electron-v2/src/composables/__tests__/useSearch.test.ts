import { describe, it, expect } from "vitest";
import { sortByName, filterSkills } from "../useSearch";
import type { SkillViewModel } from "../../types";

// ── helpers ──

function skill(overrides: Partial<SkillViewModel> & { name: string }): SkillViewModel {
  return {
    id: overrides.name,
    name: overrides.name,
    description: "",
    sourcePath: "/src/" + overrides.name,
    sourceName: "test-source",
    pathLabel: overrides.name,
    installName: "",
    installed: false,
    disabled: false,
    partiallyInstalled: false,
    unmanaged: false,
    targetLabels: [],
    ...overrides,
  };
}

const skills: SkillViewModel[] = [
  skill({ name: "zod-validator", description: "Validate schemas with Zod" }),
  skill({ name: "auto-commit", description: "Automatically commit changes", sourceName: "obra/superpowers" }),
  skill({ name: "docker-compose", description: "Manage Docker containers", sourcePath: "/sources/devops-tools/docker-compose" }),
  skill({ name: "eslint-fixer", description: "Auto-fix ESLint issues", installName: "lint-fix" }),
  skill({ name: "Auto-Test", description: "Run tests on save" }),
];

// ── AC: Skills in both lists are shown in deterministic alphabetical order ──

describe("sortByName", () => {
  it("sorts items alphabetically (case-insensitive, numeric-aware)", () => {
    const items = [{ name: "zod" }, { name: "Auto" }, { name: "docker" }, { name: "eslint" }];
    const sorted = sortByName(items);
    expect(sorted.map((i) => i.name)).toEqual(["Auto", "docker", "eslint", "zod"]);
  });

  it("is case-insensitive", () => {
    const items = [{ name: "Banana" }, { name: "apple" }, { name: "Cherry" }];
    const sorted = sortByName(items);
    expect(sorted.map((i) => i.name)).toEqual(["apple", "Banana", "Cherry"]);
  });

  it("handles numeric ordering", () => {
    const items = [{ name: "item-10" }, { name: "item-2" }, { name: "item-1" }];
    const sorted = sortByName(items);
    expect(sorted.map((i) => i.name)).toEqual(["item-1", "item-2", "item-10"]);
  });

  it("does not mutate the original array", () => {
    const items = [{ name: "b" }, { name: "a" }];
    const sorted = sortByName(items);
    expect(sorted).not.toBe(items);
    expect(items[0].name).toBe("b");
  });

  it("returns empty array for empty input", () => {
    expect(sortByName([])).toEqual([]);
  });
});

// ── AC: Search in both tabs matches skill name, description, source label, and path label ──

describe("filterSkills", () => {
  describe("with empty query", () => {
    it("returns all skills in alphabetical order", () => {
      const result = filterSkills(skills, "");
      expect(result.map((s) => s.name)).toEqual([
        "auto-commit",
        "Auto-Test",
        "docker-compose",
        "eslint-fixer",
        "zod-validator",
      ]);
    });

    it("treats whitespace-only query as empty", () => {
      const result = filterSkills(skills, "   ");
      expect(result).toHaveLength(skills.length);
    });
  });

  describe("matches by name", () => {
    it("finds exact name match", () => {
      const result = filterSkills(skills, "auto-commit");
      expect(result[0].name).toBe("auto-commit");
    });

    it("finds prefix match", () => {
      const result = filterSkills(skills, "docker");
      expect(result[0].name).toBe("docker-compose");
    });

    it("finds substring match", () => {
      const result = filterSkills(skills, "commit");
      expect(result.some((s) => s.name === "auto-commit")).toBe(true);
    });

    it("is case-insensitive", () => {
      const result = filterSkills(skills, "AUTO");
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.some((s) => s.name === "auto-commit")).toBe(true);
      expect(result.some((s) => s.name === "Auto-Test")).toBe(true);
    });
  });

  describe("matches by installName", () => {
    it("finds skill by installName", () => {
      const result = filterSkills(skills, "lint-fix");
      expect(result[0].name).toBe("eslint-fixer");
    });
  });

  describe("matches by description", () => {
    it("finds skill by description keyword", () => {
      const result = filterSkills(skills, "schemas");
      expect(result.some((s) => s.name === "zod-validator")).toBe(true);
    });

    it("finds skill by description substring", () => {
      const result = filterSkills(skills, "Docker containers");
      expect(result.some((s) => s.name === "docker-compose")).toBe(true);
    });
  });

  describe("matches by source label (sourceName)", () => {
    it("finds skill by sourceName", () => {
      const result = filterSkills(skills, "superpowers");
      expect(result.some((s) => s.name === "auto-commit")).toBe(true);
    });
  });

  describe("matches by path label (sourcePath)", () => {
    it("finds skill by sourcePath substring", () => {
      const result = filterSkills(skills, "devops-tools");
      expect(result.some((s) => s.name === "docker-compose")).toBe(true);
    });
  });

  describe("no match", () => {
    it("returns empty array when nothing matches", () => {
      const result = filterSkills(skills, "xyznonexistent");
      expect(result).toEqual([]);
    });
  });

  // ── AC: Skills are shown in deterministic alphabetical order (with ranking) ──

  describe("ranking", () => {
    it("ranks exact name match above substring match", () => {
      const items = [
        skill({ name: "test-runner", description: "auto test" }),
        skill({ name: "auto", description: "something" }),
      ];
      const result = filterSkills(items, "auto");
      expect(result[0].name).toBe("auto");
    });

    it("ranks name prefix above description match", () => {
      const items = [
        skill({ name: "zod-validator", description: "auto validate" }),
        skill({ name: "auto-commit", description: "commit stuff" }),
      ];
      const result = filterSkills(items, "auto");
      expect(result[0].name).toBe("auto-commit");
    });

    it("breaks ties alphabetically", () => {
      const items = [
        skill({ name: "beta-tool", description: "auto magic" }),
        skill({ name: "alpha-tool", description: "auto magic" }),
      ];
      const result = filterSkills(items, "auto");
      expect(result[0].name).toBe("alpha-tool");
      expect(result[1].name).toBe("beta-tool");
    });
  });

  describe("fuzzy matching", () => {
    it("matches fuzzy character subsequence in name", () => {
      const result = filterSkills(skills, "acm");
      // a-uto-c-om-m-it → fuzzy match
      expect(result.some((s) => s.name === "auto-commit")).toBe(true);
    });

    it("does not match when characters are not in order", () => {
      // Use a focused set with only one field to match against
      const items = [skill({ name: "abc", description: "", sourcePath: "", sourceName: "" })];
      const result = filterSkills(items, "cba");
      expect(result).toEqual([]);
    });
  });
});
