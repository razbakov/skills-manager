import { describe, expect, it } from "bun:test";
import {
  normalizeSkillReviewOutput,
  SKILL_REVIEW_DIMENSIONS,
} from "./skill-review";

describe("skill-review normalization", () => {
  it("normalizes dimensions, aliases, and score bounds", () => {
    const result = normalizeSkillReviewOutput({
      summary: "  Useful review  ",
      overallScore: 145,
      dimensions: [
        {
          id: "clarity",
          score: 11,
          summary: " Clear enough ",
          strengths: ["direct wording"],
          issues: ["some ambiguity"],
          suggestions: ["tighten trigger wording"],
        },
        {
          id: "security",
          score: 7.7,
          summary: "Mostly safe",
          suggestions: ["add confirmation for destructive actions"],
        },
        {
          id: "signal to noise",
          score: -5,
          summary: "too verbose",
        },
      ],
      quickWins: [" add examples ", "", "split long section"],
      risks: ["possible unsafe command pattern"],
    });

    expect(result.summary).toBe("Useful review");
    expect(result.overallScore).toBe(67);
    expect(result.dimensions).toHaveLength(SKILL_REVIEW_DIMENSIONS.length);
    expect(result.dimensions.map((dimension) => dimension.id)).toEqual(
      SKILL_REVIEW_DIMENSIONS.map((dimension) => dimension.id),
    );

    const clarity = result.dimensions.find((dimension) => dimension.id === "clarity");
    const safety = result.dimensions.find((dimension) => dimension.id === "safety");
    const signal = result.dimensions.find(
      (dimension) => dimension.id === "signal-to-noise",
    );

    expect(clarity?.score).toBe(5);
    expect(safety?.score).toBe(5);
    expect(signal?.score).toBe(1);
    expect(result.quickWins).toEqual(["add examples", "split long section"]);
    expect(result.risks).toEqual(["possible unsafe command pattern"]);
  });

  it("derives defaults when model output is sparse", () => {
    const result = normalizeSkillReviewOutput({
      dimensions: [{ id: "coverage", score: 4, issues: ["missing edge cases"] }],
    });

    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.dimensions).toHaveLength(SKILL_REVIEW_DIMENSIONS.length);
    expect(result.quickWins.length).toBeGreaterThan(0);
    expect(result.risks.length).toBeGreaterThan(0);
    expect(
      result.dimensions.find((dimension) => dimension.id === "coverage")?.score,
    ).toBe(4);
  });
});
