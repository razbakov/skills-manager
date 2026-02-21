---
type: Story
title: "Skills Manager: Browse and Install Skills in Desktop App"
status: draft
---

# Skills Manager: Browse and Install Skills in Desktop App

As a developer using multiple AI coding tools, I want to browse installed and available skills in one desktop app, so that I can install and manage skills without manual file operations.

## Context

The product is now desktop-first. Users need one place to search, inspect, and act on skills across configured targets while still seeing where each skill came from.

## Acceptance Criteria

- The desktop app has both `Installed` and `Available` tabs with searchable lists.
- Search in both tabs matches skill name, description, source label, and path label.
- Skills in both lists are shown in deterministic alphabetical order.
- The detail panel shows source and path labels plus an in-app `SKILL.md` preview for the selected skill.
- The `Available` view provides `Edit` and `Install Skill` actions for the selected item.
- The `Installed` view provides `Edit`, `Enable/Disable`, `Uninstall`, and `Adopt Skill` (only for unmanaged skills) actions.
- Installing a skill from `Available` installs it to all currently enabled targets.
- After install, uninstall, enable, disable, or adopt, the list and detail states refresh in place without restarting the app.

## Out of Scope

- External marketplace search beyond configured local sources.
- Security scoring or quality ranking of skills.
