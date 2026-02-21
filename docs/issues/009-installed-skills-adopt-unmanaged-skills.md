---
type: Story
title: "Installed Skills: Adopt Unmanaged Skills into Managed Sources"
status: draft
---

# Installed Skills: Adopt Unmanaged Skills into Managed Sources

As a developer with unmanaged local skills, I want to adopt those skills into managed sources, so that all installs follow the same managed workflow.

## Context

Users often start with manually installed skills. Adoption needs to bring those skills under management without forcing reinstalls from scratch.

## Acceptance Criteria

- Unmanaged installed skills expose an `Adopt Skill` action in the Installed view.
- If a personal repository is configured, adoption moves the skill into that repository under its managed skills path.
- If no personal repository is configured, adoption moves the skill into the local managed source area.
- After adoption, the skill is normalized across enabled targets so install state is consistent.
- Adopted skills appear as managed skills with source and path labels in app inventory.
- When a valid personal repository is configured, adoption attempts an automatic commit.
- If automatic commit fails, adoption still completes and the user sees a clear follow-up message.

## Out of Scope

- Editing commit messages or commit author details in-app.
- Pushing adopted commits to remote repositories.
