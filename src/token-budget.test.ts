import { describe, it, expect } from "bun:test";
import { get_encoding } from "tiktoken";
import { buildActiveBudgetSummary } from "./token-budget";
import type { Skill } from "./types";

function skill(overrides: Partial<Skill> & { name: string }): Skill {
  return {
    name: overrides.name,
    description: "",
    sourcePath: `/skills/${overrides.name}`,
    sourceName: "test-source",
    installName: overrides.installName,
    installed: true,
    disabled: false,
    unmanaged: false,
    targetStatus: {},
    ...overrides,
  };
}

describe("buildActiveBudgetSummary", () => {
  it("counts only enabled installed skills", () => {
    const summary = buildActiveBudgetSummary([
      skill({ name: "enabled-a", installed: true, disabled: false }),
      skill({ name: "enabled-b", installed: true, disabled: false }),
      skill({ name: "disabled-a", installed: true, disabled: true }),
      skill({ name: "available-a", installed: false, disabled: false }),
    ]);

    expect(summary.enabledCount).toBe(2);
  });

  it("uses tiktoken to calculate metadata token totals", () => {
    const enabled = skill({
      name: "writer-helper",
      description: "Helps write and revise technical documents quickly.",
      sourcePath: "/Users/test/.skills/writer-helper",
      installed: true,
      disabled: false,
    });

    const summary = buildActiveBudgetSummary([enabled]);

    const encoder = get_encoding("cl100k_base");
    try {
      const text = `name: ${enabled.name}\ndescription: ${enabled.description}\npath: ${enabled.sourcePath}`;
      const expected = encoder.encode(text).length;
      expect(summary.estimatedTokens).toBe(expected);
      expect(summary.estimatedTokens).not.toBe(100);
    } finally {
      encoder.free();
    }
  });

  it("returns zeros when no enabled skills exist", () => {
    const summary = buildActiveBudgetSummary([
      skill({ name: "disabled-a", installed: true, disabled: true }),
      skill({ name: "available-a", installed: false, disabled: false }),
    ]);

    expect(summary).toEqual({ enabledCount: 0, estimatedTokens: 0, method: "tiktoken/cl100k_base" });
  });
});
