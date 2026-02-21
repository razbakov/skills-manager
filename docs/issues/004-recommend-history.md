---
type: Story
title: "Recommendations: Suggest Skills from Conversation History"
estimation: 8
status: draft
---

As a developer with many skills, I want recommendations based on my local conversation history, so that I can quickly choose skills that match my real work.

## Acceptance Criteria

- The `Recommendations` tab includes `Recommendation Mode` with `standard` and `explore-new`, plus a `Generate` action.
- Recommendation generation uses local Cursor (`~/.cursor/projects` transcripts) and Codex (`~/.codex/history.jsonl` and `~/.codex/sessions`) conversation history together with current skill inventory.
- Query inputs are sanitized to remove system noise (e.g. `<user_query>` tags) and deduplicated before the model run.
- Final ranking comes from an external agent CLI prompt, which provides fit reason, usage status, confidence, and matches.
- The UI shows run progress with stage, percent, and run statistics while generation is in progress.
- Each recommendation supports `Manage Skill` (which focuses the skill in its original tab) and `Install Skill` (if not already installed).
- If generation fails, the app shows an error message, keeps prior results visible, and allows the user to run `Generate` again immediately.
- Context selection prioritizes installed skills and those with keyword overlap to stay within model limits.
