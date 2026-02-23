---
type: Story
title: "Skill Groups: Tag and Toggle Skill Batches"
status: in-progress
---

# Skill Groups: Tag and Toggle Skill Batches

As a developer who switches between different types of work during the day, I want to organize skills into toggleable groups that appear as folders in my skill list, so that I can batch-enable or disable skills for a workflow without affecting unrelated skills.

## Context

The original "Skill Sets" concept treated groups as exclusive profiles — applying one disabled everything outside it. Users want to toggle groups independently, like playlists not radio stations. A skill can belong to multiple groups and appears in each folder. Toggling a group off only disables skills that no other active group needs.

An auto-managed group named `Installed` is always present. It includes every
installed skill and acts as a global master toggle.

See: `docs/plans/2026-02-23-skill-groups-design.md`

## Acceptance Criteria

- The installed skill list shows group folders inline (like a file explorer).
- Each folder has a collapse/expand toggle and an enable/disable checkbox.
- A reserved auto-group `Installed` is always visible at the top.
- Toggling `Installed` ON enables all installed skills.
- Toggling `Installed` OFF disables all installed skills.
- `Installed` cannot be renamed, deleted, or manually edited for membership.
- Multiple groups can be active at the same time.
- Toggling a group ON enables all its member skills.
- Toggling a group OFF disables member skills not in any other active group.
- A skill belonging to multiple groups appears under each group folder.
- Skills in a disabled group appear dimmed.
- There is no separate "Ungrouped" section; any installed skill is visible under
  `Installed`.
- The user can create a new (empty) group and add skills to it.
- From a skill's detail view, the user can see and edit group assignments.
- The skill detail "Add to group" control excludes `Installed`.
- Clicking a group name shows a detail panel for bulk membership editing.
- The `Installed` detail panel is read-only and explains that it is automatic.
- Group detail shows a compact summary with skill count and estimated tokens
  for the selected group's installed skills.
- Groups can be renamed and deleted (with confirmation).
- Groups and active state persist across app restarts.
- Existing `skillSets` / `activeSkillSet` config is migrated to the new model.

## Out of Scope

- Sharing groups between machines.
- Automatic group switching based on project detection.
- Nested groups / group hierarchies.
