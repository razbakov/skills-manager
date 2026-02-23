---
type: Story
title: "Installed Skills: Adopt Unmanaged Skills into Managed Sources"
estimation: 5
status: completed
---

As a developer with unmanaged local skills, I want to adopt those skills into managed sources, so that all installs follow the same managed workflow.

## Acceptance Criteria

- Unmanaged installed skills (real directories in targets) expose an `Adopt Skill` action in the `Installed` view.
- Adoption moves the skill directory from its current target location into the managed area (personal repository or `sources/local`).
- The original target directory is replaced with a symlink to the new managed location.
- After adoption, the skill is normalized across all enabled targets via symlinks to ensure consistent installation state.
- Adopted skills appear as managed skills with source and path labels in the inventory.
- Adoption in a personal repository attempts an automatic commit with message `chore(skills): adopt <name>`.
- The commit uses `git commit --only` to ensure that only the adopted skill is committed, even if other changes exist in the repository.
- If the commit fails (e.g., due to git errors), adoption still completes and a follow-up message is shown.
