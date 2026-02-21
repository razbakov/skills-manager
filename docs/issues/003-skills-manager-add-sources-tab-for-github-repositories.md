---
type: Story
title: "Sources: Manage GitHub Source Packages"
status: draft
---

# Sources: Manage GitHub Source Packages

As a developer using multiple skill collections, I want to manage sources directly in the app, so that I can add and control packages without editing config files by hand.

## Context

Source management is a core workflow: users need to add repositories quickly, pause noisy sources, inspect source paths, and remove sources safely.

## Acceptance Criteria

- The `Sources` tab lists source packages with installed count and total count for each source.
- Users can add a source from either HTTPS or SSH GitHub repository URL input.
- Adding a source prevents duplicates by normalized URL or package name and shows `Source already added` when duplicated.
- Source actions include `Open Path`, `Open Repo`, `Disable/Enable`, and `Remove Source`.
- Disabled sources stay visible in `Sources` but their skills are excluded from global `Installed` and `Available` lists.
- Removing a source uninstalls related skills and removes the local cloned source directory.
- The view shows suggested sources and each suggestion can be added directly with one action.
- Invalid or unreachable repository inputs show a clear error and do not change the current source list.

## Out of Scope

- Non-GitHub source providers.
- Editing source metadata beyond enable/disable and remove.
