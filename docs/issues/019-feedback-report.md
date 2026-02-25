---
type: Story
title: "Feedback: Report Wrong Responses from Sessions"
status: in-progress
---

# Feedback: Report Wrong Responses from Sessions

As a skill maintainer, I want to report a wrong AI response from a real chat
session where a skill was used, so that maintainers can improve the skill with
clear evidence.

## Context

Users work across many chat sessions in tools like Codex and Cursor. A single
skill can be used in different sessions, and quality issues often show up in a
specific AI reply inside a specific chat.

The feedback flow should start from a skill, find sessions where that skill was
used, let the user open the chat, and mark one AI response as wrong. Then the
user explains what should have happened and can suggest a rule update.

## Acceptance Criteria

### Session Selection

- A `Report issue` action is available from `Skill` detail.
- Selecting `Report issue` opens a modal with the selected skill and an `Open
  sessions` list showing sessions from this project where that skill was used
  (for example from Codex and Cursor).
- Selecting a session opens the dialogue for that session and shows user and AI
  messages in order.

### Response Marking

- The user can mark any AI message in the dialogue as `Wrong`. User messages are
  view-only and cannot be marked.
- After an AI message is marked, the modal requires `What was wrong` and `How it should be`, and allows an optional `Suggested rule`.

### Analysis and Local Draft

- After `How it should be` is filled, the modal shows `AI analysis` that
  explains likely cause, checks whether the suggested rule fits existing
  guidance, highlights contradictions when present, and proposes a patch for the
  new rule.
- `Save report` stores the full feedback package locally first, including
  selected skill, session reference, marked AI response, wrong behavior,
  expected behavior, optional rule text, and AI analysis output.
- After local save, the report is marked as `Pending sync` and no GitHub issue
  is created automatically.

### Submit Report

- A `Submit report` action is available only for a locally saved `Pending sync`
  report.
- Clicking `Submit report` is the explicit confirmation and immediately creates
  the GitHub issue.
- After successful submit, the user sees an issue link and `Open issue`, and
  the local report is marked as synced.
- If no repository is configured, the flow shows setup guidance instead of
  failing silently. If submit fails, the report remains saved locally as
  `Pending sync`.

## Out of Scope

- Automatically applying the suggested patch to skill files.
- Editing or closing existing GitHub issues from the app.
- Cross-project session search.
