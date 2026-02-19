---
type: Story
title: "Skills Manager: Browse and Install Skills from Terminal"
status: draft
---

# Skills Manager: Browse and Install Skills from Terminal

As a developer using multiple AI coding tools, I want to browse, install, and manage my agent skills from a single terminal interface, so that I don't have to manually create symlinks and remember which skills are installed where.

## Context

Skills are scattered across multiple folders — a personal collection, a folder of cloned third-party repositories, and potentially an organization's shared set. Each AI coding tool (Cursor, Codex, Claude Code) expects skills in its own directory. Today, installing a skill means manually symlinking or copying files into up to three locations, and there is no overview of what's installed or where it came from.

## Acceptance Criteria

- A terminal interface shows two views — "Installed" and "Available" — switchable with a keyboard shortcut.
- The Installed view lists all skills currently active across the user's AI coding tools, showing each skill's name and where it was installed from.
- From the Installed view, the user can disable a skill (temporarily turn it off without removing it) or uninstall it (remove it completely).
- The Available view shows all skills found in the user's configured source folders, displaying each skill's name, short description, and which collection it belongs to.
- The Available view has a search field that filters skills by name or description as the user types.
- Installing a skill from the Available view makes it available in all three AI coding tools at once.
- Skills that are already installed do not appear in the Available view.
- A disabled skill can be re-enabled without reinstalling it.

## Out of Scope

- Remote registries or marketplace search (sources are local folders only).
- Security scanning or quality scoring of skills.
- Version tracking or update detection.
- Configuration file setup wizard (the user edits the config file manually).
