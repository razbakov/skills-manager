---
type: Story
title: "Installed Skills: Show Which IDEs Each Skill Is Installed In"
status: draft
---

# Installed Skills: Show Which IDEs Each Skill Is Installed In

As a developer managing skills across multiple IDEs, I want to see which IDEs each skill is installed in, so that I can quickly tell whether a skill is active in all my tools or only in some of them.

## Context

The app supports multiple IDE targets — such as Cursor, Claude Code, Codex, and others — and a skill can be installed, disabled, or not installed independently in each one. Currently, the Installed tab shows which skills are installed, but does not display which specific IDEs each skill is active in. Users with more than one target configured have no way to tell at a glance whether a skill is available everywhere or only in one place.

## Acceptance Criteria

- In the Installed tab, each skill shows the names of the IDEs it is installed in.
- If a skill is installed in all configured IDEs, the label reads "All IDEs" instead of listing them individually.
- If a skill is installed in only some IDEs, the individual IDE names are listed (e.g. "Cursor, Claude Code").
- IDEs where the skill is disabled (moved to the disabled folder) are shown with a "disabled" indicator next to the IDE name, so it is clear the skill is present but turned off.
- The IDE information updates immediately after the user installs, uninstalls, enables, or disables a skill — no restart or refresh is needed.
- If only one IDE target is configured, the IDE column or label is hidden to avoid visual clutter.

## Out of Scope

- Changing installation targets from the Installed tab (that belongs in the Sources or Settings tab).
- Showing skills that are not yet installed (covered by the Available tab).
