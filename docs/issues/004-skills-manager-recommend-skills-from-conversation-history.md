---
type: Story
title: "Recommendations: Suggest Skills from Conversation History"
status: draft
---

As a developer with many skills, I want recommendations based on my local conversation history, so that I can quickly choose skills that match my real work.

## Acceptance Criteria

- The `Recommendations` tab includes `Recommendation Mode` with `standard` and `explore-new`, plus a `Generate` action.
- Recommendation generation uses local Cursor and Codex conversation history together with current skill inventory.
- Query inputs are sanitized and deduplicated before the model run.
- Final ranking comes from the model response, not from hard-coded keyword ranking.
- Each recommendation shows fit reason, usage status, confidence, evidence source, and usage matches.
- The UI shows run progress with stage, percent, and run statistics while generation is in progress.
- Each recommendation supports `Open Skill` and `Install Skill` actions.
- If generation fails, the app shows an error message, keeps prior results visible, and allows the user to run `Generate` again immediately.
