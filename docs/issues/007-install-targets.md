---
type: Story
title: "Installed Skills: Show Target Coverage and Disabled State"
estimation: 3
status: completed
---

As a developer with multiple enabled IDE targets, I want to see exact per-target skill state, so that I can quickly spot partial or disabled installations.

## Acceptance Criteria

- Installed skill details show target coverage for configured targets.
- If a skill is installed and active in every enabled target, the label is `All IDEs`.
- If a skill is not fully active everywhere, the detail view lists target names and marks disabled targets with a disabled indicator.
- If only one target is enabled, the target coverage row is hidden to reduce noise.
- After install, uninstall, enable, disable, or refresh, target coverage updates immediately in the Installed detail view.
- Running refresh reconciles partial managed installs so target state becomes consistent across enabled targets.
