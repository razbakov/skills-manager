---
type: Story
title: "Skills Manager: Add Sources Tab for GitHub Repositories"
status: draft
---

# Skills Manager: Add Sources Tab for GitHub Repositories

As a developer managing skills from multiple collections, I want a Sources tab where I can add and review source repositories, so that I can bring in new skills without editing configuration files by hand.

## Context

The current terminal interface has only two tabs: Installed and Available. Source folders are managed outside the app in a config file, which makes adding new collections slow and error-prone. Users need an in-app place to see existing sources and add new GitHub repositories directly.

## Acceptance Criteria

### Sources Tab

- The main tab row includes a new tab labeled "Sources" alongside "Installed" and "Available".
- The Sources tab lists all configured sources with each source's display name, location, and whether it scans nested folders.

### Add GitHub Source

- The Sources tab contains a field labeled "GitHub repository URL" and an action labeled "Add Source".
- When a user adds a valid public GitHub repository URL, the app downloads a local copy and adds it as a new source without requiring manual config edits.
- When the user adds `https://github.com/razbakov/skills`, the source is saved with the display name `skills@razbakov`.
- After a source is added, skills from that source appear in the Available tab after refresh and still appear after app restart.

### Validation and Feedback

- If a source with the same repository URL or the same display name already exists, the app shows "Source already added" and does not create a duplicate entry.
- If the URL is invalid or the repository cannot be downloaded, the app shows a clear error message and leaves the source list unchanged.

## Out of Scope

- Editing or removing existing sources.
- Support for private repositories that require authentication.
- Adding sources from non-GitHub providers.
