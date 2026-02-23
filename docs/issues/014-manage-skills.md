---
type: Story
title: "Installed Skills: Enable, Disable, and Uninstall"
estimation: 3
status: completed
---

As a developer, I want to manage the state of installed skills from one place, so that I can quickly turn skills on, turn them off, or remove them.

## Acceptance Criteria

- The `Installed` detail view provides `Edit`, `Enable/Disable`, and `Uninstall` actions.
- Choosing `Disable` keeps the skill recoverable and marks it disabled across enabled targets.
- Choosing `Enable` restores the skill to active state across enabled targets.
- Choosing `Uninstall` removes both active and disabled entries across enabled targets.
- After each action, installed list, detail state, and per-target coverage update without app restart.
- `Adopt Skill` is shown only for unmanaged installed skills; managed skills do not show this action.
- State-changing actions are blocked while another conflicting operation is already running.
