---
type: Story
title: "Available Skills: Install Across Enabled Targets"
status: draft
---

# Available Skills: Install Across Enabled Targets

As a developer, I want to install a selected available skill with one action, so that it becomes usable in every enabled target IDE.

## Context

Users should not manually copy or link skills per IDE. Install behavior must be consistent with current target settings.

## Acceptance Criteria

- The `Available` detail view provides `Edit` and `Install Skill` actions for the selected skill.
- Triggering `Install Skill` installs the skill to all currently enabled targets.
- Installing a skill that exists only in disabled state in a target restores it to active state in that target.
- After install succeeds, the skill appears in `Installed` and no longer appears in `Available`.
- If install cannot complete, the app shows a clear error and leaves current lists unchanged until the next refresh.
- Install actions are blocked while another conflicting operation is already running.

## Out of Scope

- Per-skill target overrides.
- Uninstall, enable/disable, and adopt actions.
