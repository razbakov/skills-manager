---
type: Story
title: "Skill Groups: Tag and Toggle Skill Batches"
status: in-progress
---

# Skill Groups: Tag and Toggle Skill Batches

As a developer who switches between different types of work during the day, I want to organize skills into toggleable groups, so that I can batch-enable or disable skills for a workflow without affecting unrelated skills.

## Context

The original "Skill Sets" concept treated groups as exclusive profiles — applying one disabled everything outside it. This is too rigid. Users want to toggle groups independently (like playlists, not radio stations). A skill can belong to multiple groups, and toggling a group off should only disable skills that no other active group needs.

See: `docs/plans/2026-02-23-skill-groups-design.md`

## Acceptance Criteria

- The sidebar in the Installed view has a collapsible "Groups" section above the skill list.
- The user can create a named group, then pick member skills via a checklist in the detail panel.
- Each group has a toggle checkbox. Multiple groups can be active at the same time.
- Toggling a group ON enables all its member skills.
- Toggling a group OFF disables member skills that are not in any other active group.
- Skills not assigned to any group are unaffected by group toggles.
- A skill can belong to multiple groups.
- Clicking a group name shows a detail panel where membership can be edited.
- From a skill's detail view, the user can see and edit its group assignments.
- Groups can be deleted (with confirmation).
- Groups and active state persist across app restarts.
- Existing `skillSets` / `activeSkillSet` config is migrated to the new model.

## Out of Scope

- Sharing groups between machines.
- Automatic group switching based on project detection.
- Nested groups / group hierarchies.
