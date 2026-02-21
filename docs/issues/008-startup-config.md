---
type: Story
title: "Startup: Create Default Config and Open Desktop App"
estimation: 3
status: draft
---

## Context

First-run setup should be automatic and safe. Users should get a working app entry point and a complete baseline config.

## Acceptance Criteria

- A global `skills` command is available as the main product entry point.
- Running `skills` with no subcommand opens the desktop app.
- If configuration is missing, the app creates default configuration automatically on first run.
- Default configuration includes sources, targets, disabled sources, and personal repository settings fields.
- Home-directory shorthand paths using `~` are accepted and resolved correctly.
- Initial target defaults include only detected IDE targets.
- After default config is created, the user can proceed without a manual config bootstrap step.
