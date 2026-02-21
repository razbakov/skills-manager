---
type: Story
title: "Skills Manager: Update App from UI and CLI"
status: draft
---

# Skills Manager: Update App from UI and CLI

As a developer, I want one update flow in both desktop and CLI, so that I can stay on the latest app version with minimal manual steps.

## Context

The app should expose version state and provide a consistent update path regardless of interface.

## Acceptance Criteria

- The current app version is visible in the desktop app window title.
- The desktop toolbar includes an `Update` action.
- A CLI update command is available through `skills update`.
- Running update pulls latest app changes and refreshes dependencies before completion.
- If desktop update succeeds, the app restarts automatically.
- If no update is available, the app clearly reports that it is already up to date and does not restart.
- If update fails, the app shows a clear error and remains usable.

## Out of Scope

- Scheduled background updates.
- Rollback or version pinning for the app itself.
