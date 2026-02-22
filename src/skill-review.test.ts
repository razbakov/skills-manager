import { describe, expect, it } from "bun:test";
import {
  normalizeSkillReviewOutput,
  SKILL_REVIEW_DIMENSIONS,
} from "./skill-review";

describe("skill-review normalization", () => {
  it("normalizes runtime dimensions, aliases, and derived verdict", () => {
    const result = normalizeSkillReviewOutput({
      summary: "  Useful runtime review  ",
      dimensions: [
        {
          id: "clarity",
          score: 11,
          summary: " Trigger boundaries are mostly clear ",
        },
        {
          id: "security",
          score: 7.7,
          summary: "Destructive actions require confirmation",
        },
        {
          id: "signal to noise",
          score: -5,
          summary: "Always loads too much context",
        },
      ],
    });

    expect(result.summary).toBe("Useful runtime review");
    expect(result.schemaVersion).toBe(3);
    expect(result.framework).toBe("skill-runtime-v1");
    expect(result.overallScore).toBe(67);
    expect(result.overallScoreFive).toBe(3.3);
    expect(result.overallBand).toBe("fair");
    expect(result.verdict).toBe("needs-targeted-fixes");

    expect(result.dimensions).toHaveLength(SKILL_REVIEW_DIMENSIONS.length);
    expect(result.dimensions.map((dimension) => dimension.id)).toEqual(
      SKILL_REVIEW_DIMENSIONS.map((dimension) => dimension.id),
    );
    expect(
      result.dimensions.find((dimension) => dimension.id === "triggering-precision")?.score,
    ).toBe(5);
    expect(
      result.dimensions.find((dimension) => dimension.id === "reversibility-and-safety")?.score,
    ).toBe(5);
    expect(
      result.dimensions.find((dimension) => dimension.id === "context-economy")?.score,
    ).toBe(1);

    expect(result.failureModePredictions.length).toBeGreaterThan(0);
    expect(result.mostCriticalIssue.statement.length).toBeGreaterThan(0);
    expect(result.prioritizedFixes.length).toBeGreaterThan(0);
  });

  it("preserves model-provided failure modes and fixes", () => {
    const result = normalizeSkillReviewOutput({
      verdict: "ready-to-use",
      dimensions: [
        {
          id: "triggering precision",
          score: 4.7,
          summary: "Triggers are specific and bounded",
        },
      ],
      mostCriticalIssue: {
        statement: "Trigger rule can still overmatch broad requests.",
        whyItMatters: "Mis-triggering pollutes context and degrades response quality.",
        failureModeId: " fm-trigger-1 ",
      },
      failureModePredictions: [
        {
          id: " fm-trigger-1 ",
          prediction: "Claude will still trigger on generic doc-edit requests.",
          impact: "HIGH",
          confidence: "MEDIUM",
          relatedDimensions: ["trigger fit", "safety"],
          evidence: "Description uses broad nouns without exclusion criteria.",
        },
      ],
      prioritizedFixes: [
        {
          id: " fix-trigger-1 ",
          title: "Tighten trigger boundaries",
          priority: "1",
          targetsFailureModeIds: [" fm-trigger-1 ", ""],
          rationale: "Reduce false positives while preserving intended activation.",
          proposedRewrite:
            "Trigger when request explicitly mentions SKILL.md review or rewrite; do not trigger for generic markdown edits.",
        },
      ],
    });

    expect(result.verdict).toBe("ready-to-use");
    expect(result.failureModePredictions).toHaveLength(1);
    expect(result.failureModePredictions[0]).toEqual({
      id: "fm-trigger-1",
      prediction: "Claude will still trigger on generic doc-edit requests.",
      impact: "high",
      confidence: "medium",
      relatedDimensions: ["triggering-precision", "reversibility-and-safety"],
      evidence: "Description uses broad nouns without exclusion criteria.",
    });

    expect(result.mostCriticalIssue).toEqual({
      statement: "Trigger rule can still overmatch broad requests.",
      whyItMatters: "Mis-triggering pollutes context and degrades response quality.",
      failureModeId: "fm-trigger-1",
    });

    expect(result.prioritizedFixes).toHaveLength(1);
    expect(result.prioritizedFixes[0]).toEqual({
      id: "fix-trigger-1",
      title: "Tighten trigger boundaries",
      priority: 1,
      targetsFailureModeIds: ["fm-trigger-1"],
      rationale: "Reduce false positives while preserving intended activation.",
      proposedRewrite:
        "Trigger when request explicitly mentions SKILL.md review or rewrite; do not trigger for generic markdown edits.",
    });
  });

  it("derives runtime defaults when model output is sparse", () => {
    const result = normalizeSkillReviewOutput({});

    expect(result.dimensions).toHaveLength(SKILL_REVIEW_DIMENSIONS.length);
    expect(result.overallScore).toBe(60);
    expect(result.overallScoreFive).toBe(3.0);
    expect(result.verdict).toBe("needs-rethink");
    expect(result.failureModePredictions.length).toBeGreaterThan(0);
    expect(result.prioritizedFixes.length).toBeGreaterThan(0);
    expect(result.mostCriticalIssue.statement.length).toBeGreaterThan(0);
  });
});
