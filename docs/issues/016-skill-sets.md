---
type: Story
title: "Skill Sets: Create and Switch Named Sets"
status: draft
---

# Skill Sets: Create and Switch Named Sets

As a developer who changes task types during the day, I want to create named sets of skills and switch between them, so that I can quickly activate only what I need for the current task.

## Context

Today, users manage skills one by one in the `Installed` view. This works for small libraries, but becomes slow when users need to shift between different workflows. A named set feature would make this a one-step action and reduce active-skill noise.

## Acceptance Criteria

- In the skills management area, the user can create a named set from currently enabled installed skills.
- The user can see a list of saved named sets and choose one as the active set.
- When a named set is activated, skills in that set are enabled and all other installed skills are disabled.
- The user can choose an `All Skills` option that returns to a state where all installed skills are enabled.
- After switching sets, the UI shows which set is currently active.
- If a saved set includes a skill that no longer exists, switching still succeeds for available skills and shows a notice that some skills were skipped.
- Saved sets remain available after the app is restarted.

## Out of Scope

- Sharing sets between different machines.
- Automatic set switching based on project detection.
