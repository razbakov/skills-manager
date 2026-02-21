---
type: Story
title: "Interaction: Feedback, Action Locking, and Keyboard Controls"
estimation: 3
status: draft
---

As a keyboard-first user, I want clear action feedback and predictable shortcuts, so that I can manage skills quickly without accidental conflicting actions.

## Acceptance Criteria

- Long-running actions show pending status followed by success or error feedback.
- While an action is running, conflicting actions are blocked and controls are temporarily disabled.
- `Ctrl/Cmd+1..5` switches between main tabs.
- `Ctrl/Cmd+F` or `/` focuses the most relevant search or input for the active tab.
- `ArrowUp` and `ArrowDown` move selection in the active list without using the mouse.
- `Enter` triggers the primary action for the selected item in the active tab.
- `Escape` clears search inputs and closes the import preview modal when it is open.
- Success and error feedback messages remain visible for at least 2 seconds unless replaced by a newer status message.
