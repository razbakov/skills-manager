---
type: Story
title: "Skill Collections: Tag and Toggle Skill Batches"
status: in-progress
---

# Skill Collections: Tag and Toggle Skill Batches

As a developer who switches between different types of work during the day, I want to organize skills into toggleable collections that appear as folders in my skill list, so that I can batch-enable or disable skills for a workflow without affecting unrelated skills.

## Context

The original "Skill Sets" concept treated collections as exclusive profiles — applying one disabled everything outside it. Users want to toggle collections independently, like playlists not radio stations. A skill can belong to multiple collections and appears in each folder. Toggling a collection off only disables skills that no other active collection needs.

An auto-managed collection named `Installed` is always present. It includes every
installed skill and acts as a global master toggle.

See: `docs/plans/2026-02-23-skill-groups-design.md`

## Acceptance Criteria

- The installed skill list shows collection folders inline (like a file explorer).
- Each folder has a collapse/expand toggle and an enable/disable checkbox.
- A reserved auto-collection `Installed` is always visible at the top.
- Toggling `Installed` ON enables all installed skills.
- Toggling `Installed` OFF disables all installed skills.
- `Installed` cannot be renamed, deleted, or manually edited for membership.
- Multiple collections can be active at the same time.
- Toggling a collection ON enables all its member skills.
- Toggling a collection OFF disables member skills not in any other active collection.
- A skill belonging to multiple collections appears under each collection folder.
- Skills in a disabled collection appear dimmed.
- There is no separate "Uncollected" section; any installed skill is visible under
  `Installed`.
- The user can create a new (empty) collection and add skills to it.
- From a skill's detail view, the user can see and edit collection assignments.
- The skill detail "Add to collection" control excludes `Installed`.
- Clicking a collection name shows a detail panel for bulk membership editing.
- The `Installed` detail panel is read-only and explains that it is automatic.
- Collection detail shows a compact summary with skill count and estimated tokens
  for the selected collection's installed skills.
- Collections can be renamed and deleted (with confirmation).
- Collections and active state persist across app restarts.
- Existing `skillSets` / `activeSkillSet` config is migrated to the new model.

## Out of Scope

- Sharing collections between machines.
- Automatic collection switching based on project detection.
- Nested collections / collection hierarchies.
