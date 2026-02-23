# Skill Groups Design

## Problem

Users install many skills but only need subsets for different workflows
(writing, coding, research). Managing skills one by one is slow when
switching between tasks. The original "Skill Sets" approach treated groups
as exclusive profiles — applying one disabled everything else. This is too
rigid: users want to toggle groups independently without losing their
broader configuration.

## Core Concept

Groups are tags assigned to skills. Multiple groups can be active
simultaneously. A skill is enabled if **any** of its active groups include
it. Toggling a group off only disables skills that have no other active
group keeping them on.

An auto-managed group named **Installed** is always present. It contains all
installed skills and acts as a global master toggle.

### Data Model

```typescript
interface SkillGroup {
  name: string;
  skillIds: string[];   // resolved source paths
}

interface Config {
  // ... existing fields ...
  skillGroups?: SkillGroup[];
  activeGroups?: string[];   // names of currently active groups
}
```

Key change from the old model: `activeSkillSet` was a single string
(exclusive). `activeGroups` is an array (multiple simultaneously active).

The `Installed` group is synthetic UI state derived from installed skills and
is not persisted in `skillGroups`.

### Toggle Logic

- **Installed toggled ON**: enable all installed skills and mark all user
  groups active.
- **Installed toggled OFF**: disable all installed skills and clear active
  user groups.
- **User group toggled ON**: enable installed skills in that group.
- **User group toggled OFF**: disable skills in that group that are not
  covered by any other active group.

## UI: Folders in the Skill List

The existing Installed view layout stays as-is. The only change is that
the skill list shows group folders inline — like a file explorer.

```
INSTALLED SKILLS
───────────────────────
▼ [✓] Installed (11) [Auto]
      brainstorming
      research
      test-driven-dev
      ...
▼ [✓] Writing (5)
      brainstorming
      research
      writing-plans
      storyteller
      feature-spec
▼ [ ] Coding (4)
      test-driven-dev
      coding-helper
      research
      bdd
► [✓] Research (2)
```

### Folder Behavior

- **▼ / ►** collapse or expand to show/hide the group's skills.
- **[✓] / [ ]** toggle checkbox enables or disables the entire group.
- Skills in a disabled group appear dimmed / visually muted.
- A skill belonging to multiple groups appears under each group folder.
- There is no separate "Ungrouped" section; all installed skills are always
  visible under `Installed`.
- Selecting a skill in any folder opens its detail in the right panel
  (same as today).
- `Installed` is read-only: it cannot be renamed, deleted, or manually edited.

### Creating a Group

- A "+ New Group" button below the list (or at the bottom of the groups
  section) opens an inline name input.
- The new group is created empty.
- Skills are added to it via the skill detail panel or by editing the
  group.

### Editing Group Membership

**From the skill detail panel** (right side):
- A "Groups" section shows which groups the skill belongs to as chips.
- Click a chip to remove the skill from that group.
- "+ Add to group" dropdown to assign to additional groups (excluding
  `Installed`, which is automatic).

**From the group folder header**:
- Clicking the group name (not the toggle) selects the group.
- The detail panel shows group info: name, member count, and a checklist
  of all installed skills for bulk editing.
- The detail panel shows token budget info calculated from the selected
  group's installed skills.
- "Delete Group" button with confirmation.
- "Rename" option.
- For `Installed`, the detail panel is informational/read-only.

### Visual Details

- Folder rows are visually distinct from skill rows (bold text, slightly
  larger, folder icon or indentation).
- `Installed` row has an "Auto" badge.
- Disabled-group skills are dimmed but still visible (not hidden).
- The skill count badge on each folder updates as skills are added/removed.

## Migration

- Existing `skillSets` / `activeSkillSet` in config are migrated to
  `skillGroups` / `activeGroups` on first load.
- Old fields are dropped after migration.

## Out of Scope

- Sharing groups between machines.
- Automatic group switching based on project detection.
- Nested groups / group hierarchies.
- Drag-and-drop reordering of groups or skills within groups.
