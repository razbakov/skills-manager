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
group keeping them on. Skills not in any group are unaffected by group
toggles and managed individually.

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

### Toggle Logic

- **Group toggled ON**: enable all installed skills in that group.
- **Group toggled OFF**: disable skills in that group that are not covered
  by any other active group.
- **Ungrouped skills**: unaffected by group toggles, managed individually.

## UI Layout

The left sidebar in the Installed view gains a collapsible "Groups"
section above the skill list:

```
┌──────────────────────┬──────────────────────────────┐
│  GROUPS              │                              │
│  [✓] Writing   (5)   │     Skill Detail /           │
│  [ ] Coding    (8)   │     Group Detail Panel       │
│  [✓] Research  (3)   │                              │
│  [+ New Group]       │                              │
│                      │                              │
│  INSTALLED SKILLS    │                              │
│  brainstorming  [W]  │                              │
│  research       [WR] │                              │
│  writing-plans  [W]  │                              │
│  ...                 │                              │
└──────────────────────┴──────────────────────────────┘
```

- Each group row has a toggle checkbox and a skill count badge.
- Clicking the checkbox toggles the group on/off.
- Clicking the group name selects it and shows a group detail view in the
  right panel with a checklist of all installed skills.
- Skills in the list show small tag chips indicating group membership.

## Flows

### Creating a Group

1. Click "+ New Group".
2. Inline text input appears — type the name, press Enter.
3. Group is created empty and selected.
4. Right panel shows all installed skills as a checklist.
5. Check skills to add them — saves immediately.

### Editing a Group

- Click a group name to select it.
- Right panel shows membership checklist (all installed skills, members
  checked).
- Check/uncheck to add/remove — saves immediately.
- "Delete Group" button at the bottom (with confirmation).

### Managing Groups from a Skill

- In the skill detail view, a "Groups" section shows assigned groups as
  chips.
- Click a chip to remove the skill from that group.
- "+ Add to group" dropdown to assign to additional groups.

## Migration

- Existing `skillSets` / `activeSkillSet` in config are migrated to
  `skillGroups` / `activeGroups` on first load.
- Old fields are dropped after migration.

## Out of Scope

- Sharing groups between machines.
- Automatic group switching based on project detection.
- Nested groups / group hierarchies.
