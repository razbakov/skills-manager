---
type: Story
title: "Skill Discovery: Build Deterministic Inventory with Cached Results"
status: draft
---

As a developer managing many skills, I want fast and reliable discovery that reuses cached results, so that inventory loads quickly without losing accuracy.

## Acceptance Criteria

- Discovery finds skills only in directories that contain `SKILL.md`.
- Each source supports either recursive scan mode or one-level scan mode, based on source settings.
- For each discovered skill, the inventory reads name and description and uses fallback values when metadata is missing.
- Inventory checks enabled targets and marks each skill as installed, disabled, or not installed.
- Inventory includes unmanaged installed skills, not only skills from managed sources.
- Discovery results are cached and reused when source content has not changed.
- If cache data is missing or unreadable, discovery rebuilds cache automatically and the app still opens.
- Installed and Available lists remain deterministic and alphabetically ordered after each refresh.
