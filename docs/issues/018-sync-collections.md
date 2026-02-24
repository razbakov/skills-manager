---
type: Story
title: "Collections: Sync Changes to Personal Repository"
estimation: 3
status: in-progress
---

As a developer who organizes skills into collections, I want my collection changes to be saved as files in my personal skills repository and automatically committed, so that my collections are version-controlled and portable across machines.

## Context

Today, skill collections live only in the local app configuration file. If the user switches machines or resets the app, their carefully curated collections are lost. The app already commits adopted skills to the personal repository — this story extends that pattern to cover collection definitions.

Each collection is saved as a separate JSON file under root folder in the personal repository. The filename matches the collection name. When a user creates, edits, or deletes a collection, the corresponding file is written (or removed) and committed automatically — the same way adopted skills are committed today.

## Acceptance Criteria

- When the user adds, renames, or changes membership of a user-created collection, the app writes a `<collection-name>.json` file to the personal repository.
- Changes to the auto-managed "Installed" collection are ignored — it is never written as a collection file.
- Each JSON file contains the collection name and its list of member skills identified by their source-relative paths.
- Renaming a collection removes the old file and creates a new one with the updated name.
- Deleting a collection removes its JSON file from the repository.
- After every collection file change, the app stages and commits the affected file(s) automatically, similar to how adopted skills are committed today.
- If no personal repository is configured, collection files are not written and the app continues to work using local configuration only.
- The commit message follows the pattern `chore(collections): <action> <collection-name>` (e.g. "add", "update", "remove", "rename").
- If the git commit fails, the app shows a notification with the reason but does not block the user from continuing.
- The header shows a "Sync" button when a personal repository is configured. Clicking it pulls from and pushes to the remote.
- When no personal repository is configured, the header shows a "Setup Sync" button that opens a guided setup dialog.
- The setup dialog accepts a GitHub repository URL and configures it as the personal repository.
- If the sync (pull or push) fails, the app shows a notification with the reason but does not block the user.

## Out of Scope

- Reading collection files back on startup to restore collections (import/sync direction).
- Conflict resolution when the same collection is edited on multiple machines.
