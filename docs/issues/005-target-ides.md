---
type: Story
title: "Settings: Choose Enabled Target IDEs"
estimation: 3
status: draft
---

As a developer, I want to control which IDE targets are enabled, so that skill operations apply only to tools I use.

## Acceptance Criteria

- Settings shows supported target families: Cursor, Claude, Codex, Gemini, Antigravity, VS Code/Copilot, Amp, Goose, and OpenCode.
- Each target row shows detected or not-detected status.
- Users can enable or disable each target regardless of detection status.
- Target enablement changes are saved and still present after app restart.
- Install, uninstall, enable, and disable skill actions apply only to currently enabled targets.
