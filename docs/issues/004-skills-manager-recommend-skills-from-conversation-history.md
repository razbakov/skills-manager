---
type: Story
title: "Recommendations: Suggest Skills from Conversation History"
status: draft
---

# Recommendations: Suggest Skills from Conversation History

As a developer with many skills, I want recommendations based on my local conversation history, so that I can quickly choose skills that match my real work.

## Context

Recommendation quality depends on context preparation and clear result explanations, not only on listing skills. Users also need visibility into recommendation progress.

## Acceptance Criteria

- The `Recommendations` tab includes `Recommendation Mode` with `standard` and `explore-new`, plus a `Generate` action.
- Recommendation generation uses local Cursor and Codex conversation history together with current skill inventory.
- Query inputs are sanitized and deduplicated before the model run.
- Final ranking comes from the model response, not from hard-coded keyword ranking.
- Each recommendation shows fit reason, usage status, confidence, evidence source, and usage matches.
- The UI shows run progress with stage, percent, and run statistics while generation is in progress.
- Each recommendation supports `Open Skill` and `Install Skill` actions.
- If generation fails, the app shows a retry-friendly error and keeps prior results visible.

## Out of Scope

- Team-shared recommendations across multiple users.
- Recommendations from internet or marketplace telemetry.
