---
type: Story
title: "Skills Manager: Browse and Search Skills in Desktop App"
estimation: 3
status: completed
---

As a developer using multiple AI coding tools, I want to browse installed and available skills in one desktop app, so that I can quickly find the right skill and understand where it comes from.

## Acceptance Criteria

- The desktop app has both `Installed` and `Available` tabs with searchable lists.
- Search in both tabs matches skill name, description, source label, and path label.
- Skills in both lists are shown in deterministic alphabetical order.
- The detail panel shows source and path labels plus an in-app `SKILL.md` preview for the selected skill.
- Keyboard navigation works in both tabs: arrow keys move selection and search remains focused when requested.
- Opening or refreshing the app keeps list counts and selected detail state in sync with the visible list.
