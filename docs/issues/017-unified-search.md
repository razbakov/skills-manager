---
type: Story
title: "Skills Library: Merge Installed and Available with Filters"
status: draft
---

# Skills Library: Merge Installed and Available with Filters

As a developer searching for a skill, I want one combined list for installed and available skills with status filters, so that I can find a skill once and immediately see whether it is enabled, disabled, or not installed.

## Context

The current UI separates discovery into `Installed` and `Available` tabs. Users must switch tabs to answer a simple question: "Do I already have this skill?" This slows search and makes source-level browsing harder.

## Acceptance Criteria

- The app provides one combined `Skills` list that includes installed and available skills together.
- A single search field finds matching skills across the full combined list.
- Each row clearly shows one status: `Enabled`, `Disabled`, or `Available`.
- The combined list supports status filters: `All`, `Enabled`, `Disabled`, and `Available`.
- The combined list supports a source filter so the user can view all skills from one source.
- Search and filters work together, and the shown count reflects the filtered result.
- Selecting a skill opens a detail panel with the right primary action for that status (for example, `Install` for available skills, `Enable/Disable` for installed skills).

## Out of Scope

- Changing recommendation ranking logic.
- Source-management actions outside filtering (for example, adding or removing sources).
