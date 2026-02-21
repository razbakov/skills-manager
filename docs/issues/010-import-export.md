---
type: Story
title: "Import and Export: Transfer Installed Skills as a Bundle"
estimation: 5
status: draft
---

As a developer setting up or sharing environments, I want to export and import installed skills as a bundle, so that I can reproduce my setup quickly.

## Acceptance Criteria

- Export is available from both desktop UI and CLI.
- Export writes a JSON manifest that includes schema version, generation timestamp, and install metadata when available.
- Import is available from both desktop UI and CLI.
- Desktop import starts with a preview that allows selecting which skills to import.
- During import, the app auto-adds missing supported GitHub sources from bundle metadata before skill install.
- Import result summary reports installed, already-installed, added-source, and skipped outcomes.
- Importing selected skills installs them across currently enabled targets.
- Invalid or unreadable bundle files show a clear error and do not apply partial hidden changes.
