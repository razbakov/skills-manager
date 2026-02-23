---
type: Story
title: "Installed Skills: Show Enabled Count and Token Estimate"
status: draft
---

# Installed Skills: Show Enabled Count and Token Estimate

As a developer who works with many skills, I want to see how many skills are currently enabled and an estimated token cost, so that I can keep my active setup focused and avoid context bloat.

## Context

The app already lets users install, enable, disable, and uninstall skills from the `Installed` view. It also shows recommendations in a separate tab. What is missing is a simple summary of active skill volume and likely context impact, even though context overflow is a core problem described in project docs.

## Acceptance Criteria

- The `Installed` view shows a clear summary block with the current number of enabled skills.
- The same summary block shows an estimated token usage for enabled skills and clearly labels it as an estimate.
- Disabled skills are excluded from both the enabled count and the token estimate.
- The summary updates immediately after install, uninstall, enable, disable, import, and refresh actions.
- When no skills are enabled, the summary displays `0 enabled` and `0 estimated tokens`.
- The summary is visible without opening a detail panel.

## Out of Scope

- Exact model-by-model token accounting.
- Automatic disabling of skills based on the estimate.
