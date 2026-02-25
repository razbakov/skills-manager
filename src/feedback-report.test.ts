import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";
import type { Skill } from "./types";
import {
  parseCodexFeedbackSessionFile,
  parseCursorFeedbackSessionFile,
  sessionMentionsSkill,
  createFeedbackIssueBody,
  getFeedbackSessionById,
  type FeedbackReportDraft,
} from "./feedback-report";

function writeTempFile(lines: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "skills-feedback-"));
  const filePath = join(root, "session.jsonl");
  writeFileSync(filePath, `${lines.join("\n")}\n`, "utf-8");
  return filePath;
}

describe("feedback-report session parsing", () => {
  it("parses codex sessions and keeps only user/assistant messages", () => {
    const filePath = writeTempFile([
      JSON.stringify({
        type: "session_meta",
        payload: {
          id: "session-codex-1",
          cwd: "/Users/aleksey.razbakov/Projects/skills-manager",
        },
      }),
      JSON.stringify({
        timestamp: "2026-02-25T10:00:00.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Use workflow skill for this task" }],
        },
      }),
      JSON.stringify({
        timestamp: "2026-02-25T10:00:05.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "I will use workflow." }],
        },
      }),
      JSON.stringify({
        timestamp: "2026-02-25T10:00:06.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "developer",
          content: [{ type: "input_text", text: "ignore this" }],
        },
      }),
    ]);

    try {
      const parsed = parseCodexFeedbackSessionFile(filePath);
      expect(parsed).not.toBeNull();
      expect(parsed?.sessionId).toBe("session-codex-1");
      expect(parsed?.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
      expect(parsed?.messages[0]?.text).toContain("workflow skill");
      expect(parsed?.messages[1]?.text).toContain("I will use workflow");
    } finally {
      rmSync(dirname(filePath), { recursive: true, force: true });
    }
  });

  it("parses cursor transcript messages", () => {
    const root = mkdtempSync(join(tmpdir(), "skills-feedback-cursor-"));
    const projectDir = join(root, "Users-aleksey-razbakov-Projects-skills-manager");
    const transcriptPath = join(projectDir, "agent-transcripts", "abc", "abc.jsonl");

    try {
      mkdirSync(dirname(transcriptPath), { recursive: true });
      writeFileSync(
        transcriptPath,
        [
          JSON.stringify({
            role: "user",
            message: { content: [{ type: "text", text: "Please run review skill" }] },
          }),
          JSON.stringify({
            role: "assistant",
            message: { content: [{ type: "text", text: "Running review now" }] },
          }),
        ].join("\n") + "\n",
        "utf-8",
      );

      const parsed = parseCursorFeedbackSessionFile(transcriptPath, projectDir);
      expect(parsed).not.toBeNull();
      expect(parsed?.source).toBe("Cursor");
      expect(parsed?.messages).toHaveLength(2);
      expect(parsed?.messages[0]?.role).toBe("user");
      expect(parsed?.messages[1]?.role).toBe("assistant");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("loads cursor sessions from nested transcript paths", () => {
    const root = mkdtempSync(join(tmpdir(), "skills-feedback-cursor-deep-"));
    const projectPath = "/Users/aleksey.razbakov/Projects/skills-manager";
    const projectDir = join(
      root,
      "users-aleksey-razbakov-projects-skills-manager",
    );
    const transcriptPath = join(
      projectDir,
      "agent-transcripts",
      "nested",
      "level",
      "deep.jsonl",
    );

    try {
      mkdirSync(dirname(transcriptPath), { recursive: true });
      writeFileSync(
        transcriptPath,
        [
          JSON.stringify({
            role: "user",
            message: { content: [{ type: "text", text: "Please apply bdd skill" }] },
          }),
          JSON.stringify({
            role: "assistant",
            message: { content: [{ type: "text", text: "Using bdd now." }] },
          }),
        ].join("\n") + "\n",
        "utf-8",
      );

      const parsed = parseCursorFeedbackSessionFile(transcriptPath, projectDir);
      expect(parsed).not.toBeNull();

      const resolved = getFeedbackSessionById(parsed!.id, { projectPath });
      expect(resolved).not.toBeNull();
      expect(resolved?.messages.length).toBe(2);
      expect(resolved?.source).toBe("Cursor");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("feedback-report skill detection", () => {
  const skill: Skill = {
    name: "workflow",
    description: "",
    sourcePath: "/tmp/workflow",
    sourceName: "skills",
    installName: "workflow",
    installed: true,
    disabled: false,
    unmanaged: false,
    targetStatus: {},
  };

  it("detects skill mention in user or assistant text", () => {
    const used = sessionMentionsSkill(skill, [
      {
        id: "m-1",
        role: "assistant",
        text: "I'll use $workflow for this",
        timestamp: "2026-02-25T10:00:00.000Z",
      },
    ]);

    expect(used).toBeTrue();
  });

  it("does not match unrelated substrings", () => {
    const notUsed = sessionMentionsSkill(skill, [
      {
        id: "m-1",
        role: "assistant",
        text: "the workflowing process is vague",
        timestamp: "2026-02-25T10:00:00.000Z",
      },
    ]);

    expect(notUsed).toBeFalse();
  });

  it("ignores instruction-dump user prompts when detecting usage", () => {
    const notUsed = sessionMentionsSkill(skill, [
      {
        id: "m-1",
        role: "user",
        text: "# AGENTS.md instructions for /Users/aleksey.razbakov/Projects/skills-manager\n\n### Available skills\n- bdd\n- workflow\n\nHow to use skills ...",
        timestamp: "2026-02-25T10:00:00.000Z",
      },
    ]);

    expect(notUsed).toBeFalse();
  });
});

describe("feedback-report issue body", () => {
  it("renders all required sections", () => {
    const draft: FeedbackReportDraft = {
      id: "report-1",
      status: "pending_sync",
      createdAt: "2026-02-25T10:00:00.000Z",
      updatedAt: "2026-02-25T10:05:00.000Z",
      skillId: "/tmp/workflow",
      skillName: "workflow",
      session: {
        id: "session-1",
        source: "Codex",
        sessionId: "abc",
        title: "workflow issue",
        timestamp: "2026-02-25T10:00:00.000Z",
      },
      selectedMessage: {
        id: "m-2",
        role: "assistant",
        text: "Wrong response",
        timestamp: "2026-02-25T10:01:00.000Z",
      },
      whatWasWrong: "Used wrong instruction",
      expectedBehavior: "Should follow workflow",
      suggestedRule: "Use workflow when user asks for plans",
      analysis: {
        summary: "Likely trigger mismatch",
        likelyCause: "Trigger condition too broad",
        ruleFit: "compatible",
        contradiction: null,
        suggestedPatch: "Add explicit trigger checks",
      },
      issueUrl: null,
      issueNumber: null,
      syncedAt: null,
    };

    const body = createFeedbackIssueBody(draft);
    expect(body).toContain("## Skill");
    expect(body).toContain("## Session");
    expect(body).toContain("## Marked AI Response");
    expect(body).toContain("## What Was Wrong");
    expect(body).toContain("## Expected Behavior");
    expect(body).toContain("## Suggested Rule");
    expect(body).toContain("## AI Analysis");
    expect(body).toContain("## Suggested Patch");
  });
});
