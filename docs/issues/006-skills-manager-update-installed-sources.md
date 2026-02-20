---
type: Story
title: "Skills Manager: Update App"
status: draft
---

# Skills Manager: Update App

As a developer, I want to update Skills Manager with a single action, so that I always have the latest version of the tool without leaving the app.

## Context

Skills Manager itself is installed from a Git repository. Today there is no built-in way to check for or apply updates to the app. The user must manually pull each repository and restart the process. This becomes tedious, easy to forget, and leads to running stale versions.

## Acceptance Criteria

### App Self-Update

- The update process first checks for a newer version of Skills Manager itself by pulling the latest changes from the app's own repository.
- If a new version is available, the app installs any updated dependencies automatically.
- After a successful self-update, the app restarts itself so the user is immediately running the new version.
- If the app is already up to date, the update process continues to source updates without restarting.
- The current app version is shown in the interface (terminal header or Electron title bar) so the user can confirm which version is running.

### Terminal (CLI)

- A `skills update` command is available that runs the self-update.
- If the app was updated, it restarts and the user sees the new version in the terminal header.

### Desktop (Electron)

- An "Update" button is visible in the desktop interface, accessible from the main toolbar or the Sources tab.
- Clicking the button triggers the self-update process.
- While the update is running, the button shows a loading indicator and is not clickable again until the process finishes.
- If the app itself was updated, the Electron window restarts automatically to load the new version.
- The results are displayed in the interface — listing the app update outcome.

## Out of Scope

- Version pinning or rollback to a previous version.
- Automatic background updates on a schedule.
- Conflict resolution UI — if a pull fails due to local changes the user resolves it outside Skills Manager.
