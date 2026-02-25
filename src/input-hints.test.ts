import { describe, expect, it } from "vitest";
import { inferSpecificSkillHint } from "./input-hints";

describe("inferSpecificSkillHint", () => {
  it("returns skill from direct GitHub repo/skill URL", () => {
    expect(
      inferSpecificSkillHint("https://github.com/razbakov/skills/sprint-release"),
    ).toBe("sprint-release");
  });

  it("returns skill from shared npx command with repo/skill URL", () => {
    expect(
      inferSpecificSkillHint(
        "npx -y skill-mix https://github.com/razbakov/skills/sprint-release",
      ),
    ).toBe("sprint-release");
  });

  it("returns trailing skill token from legacy two-argument command", () => {
    expect(
      inferSpecificSkillHint(
        "npx -y skill-mix https://github.com/razbakov/skills sprint-release",
      ),
    ).toBe("sprint-release");
  });

  it("returns undefined for plain repository URL", () => {
    expect(
      inferSpecificSkillHint("https://github.com/razbakov/skills"),
    ).toBeUndefined();
  });

  it("returns skill name from GitHub tree SKILL.md URL", () => {
    expect(
      inferSpecificSkillHint(
        "https://github.com/razbakov/skills/tree/main/sprint-release/SKILL.md",
      ),
    ).toBe("sprint-release");
  });

  it("returns skill name from owner/repo/skill shorthand", () => {
    expect(
      inferSpecificSkillHint("razbakov/skills/sprint-release"),
    ).toBe("sprint-release");
  });
});
