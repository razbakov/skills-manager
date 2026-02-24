import { describe, expect, it } from "bun:test";
import {
  encodeSkillSetRequestArg,
  extractSkillSetRequestFromArgv,
  parseSkillSetRequest,
  selectSkillsForInstall,
} from "./skill-set";
import type { Skill } from "./types";

function skill(overrides: Partial<Skill>): Skill {
  return {
    name: overrides.name || "unnamed",
    description: overrides.description || "",
    sourcePath: overrides.sourcePath || `/tmp/${overrides.name || "unnamed"}`,
    sourceName: overrides.sourceName || "repo@test",
    installName: overrides.installName,
    installed: overrides.installed ?? false,
    disabled: overrides.disabled ?? false,
    unmanaged: overrides.unmanaged ?? false,
    targetStatus: overrides.targetStatus || {},
  };
}

describe("skill-set request parser", () => {
  it("parses implicit shorthand source command", () => {
    expect(parseSkillSetRequest(["obra/superpowers"])).toEqual({
      source: "https://github.com/obra/superpowers",
      requestedSkills: [],
      installAll: false,
    });
  });

  it("parses explicit set command with positional skills", () => {
    expect(parseSkillSetRequest(["set", "obra/superpowers", "workflow", "research"])).toEqual({
      source: "https://github.com/obra/superpowers",
      requestedSkills: ["workflow", "research"],
      installAll: false,
    });
  });

  it("parses repeated --skill flags and deduplicates case-insensitively", () => {
    expect(
      parseSkillSetRequest([
        "s",
        "https://github.com/obra/superpowers",
        "--skill",
        "Frontend-Design",
        "--skill",
        "frontend-design",
      ]),
    ).toEqual({
      source: "https://github.com/obra/superpowers",
      requestedSkills: ["Frontend-Design"],
      installAll: false,
    });
  });

  it("returns null for unrelated command", () => {
    expect(parseSkillSetRequest(["update"])).toBeNull();
  });

  it("throws for missing source argument", () => {
    expect(() => parseSkillSetRequest(["set"])).toThrow(
      "Usage: skills set <owner/repo|github-url> [skill ...] [--skill <skill>] [--all]",
    );
  });

  it("throws when --all is combined with explicit skills", () => {
    expect(() => parseSkillSetRequest(["set", "obra/superpowers", "--all", "workflow"])).toThrow(
      "Do not combine --all with explicit skill names.",
    );
  });

  it("throws for unsupported flags", () => {
    expect(() => parseSkillSetRequest(["set", "obra/superpowers", "--nope"])).toThrow(
      "Unknown option: --nope",
    );
  });
});

describe("skill-set launch argument transport", () => {
  it("serializes and restores request payload from argv", () => {
    const encoded = encodeSkillSetRequestArg({
      source: "https://github.com/obra/superpowers",
      requestedSkills: ["workflow", "research"],
      installAll: false,
    });

    expect(extractSkillSetRequestFromArgv(["electron", encoded])).toEqual({
      source: "https://github.com/obra/superpowers",
      requestedSkills: ["workflow", "research"],
      installAll: false,
    });
  });

  it("supports split flag form", () => {
    const encoded = encodeSkillSetRequestArg({
      source: "https://github.com/obra/superpowers",
      requestedSkills: [],
      installAll: true,
    }).replace("--skill-set-request=", "");

    expect(
      extractSkillSetRequestFromArgv(["electron", "--skill-set-request", encoded]),
    ).toEqual({
      source: "https://github.com/obra/superpowers",
      requestedSkills: [],
      installAll: true,
    });
  });

  it("returns null for malformed payload", () => {
    expect(extractSkillSetRequestFromArgv(["--skill-set-request=%7Bbad"])).toBeNull();
  });
});

describe("skill-set selection", () => {
  const skills = [
    skill({
      name: "workflow",
      sourcePath: "/tmp/superpowers/workflow",
      installName: "workflow",
    }),
    skill({
      name: "Frontend Design",
      sourcePath: "/tmp/superpowers/frontend-design",
      installName: "frontend-design",
    }),
    skill({
      name: "research",
      sourcePath: "/tmp/superpowers/research",
    }),
  ];

  it("returns all skills when no explicit selection is provided", () => {
    const result = selectSkillsForInstall(skills, [], false);
    expect(result.selectedSkills).toHaveLength(3);
    expect(result.missingSkills).toEqual([]);
  });

  it("matches requested skills by frontmatter name and install name", () => {
    const result = selectSkillsForInstall(skills, ["frontend-design", "workflow"], false);
    expect(result.selectedSkills.map((entry) => entry.name)).toEqual([
      "Frontend Design",
      "workflow",
    ]);
    expect(result.missingSkills).toEqual([]);
  });

  it("reports missing skills while keeping valid selections", () => {
    const result = selectSkillsForInstall(skills, ["workflow", "not-here"], false);
    expect(result.selectedSkills.map((entry) => entry.name)).toEqual(["workflow"]);
    expect(result.missingSkills).toEqual(["not-here"]);
  });

  it("forces all skills when installAll is true", () => {
    const result = selectSkillsForInstall(skills, ["workflow"], true);
    expect(result.selectedSkills).toHaveLength(3);
    expect(result.missingSkills).toEqual([]);
  });
});
