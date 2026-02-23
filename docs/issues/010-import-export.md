---
type: Story
title: "Import and Export: Transfer Installed Skills as a Bundle"
estimation: 5
status: completed
---

As a developer setting up or sharing environments, I want to export and import installed skills as a bundle, so that I can reproduce my setup quickly.

## Acceptance Criteria

- Export is available from both desktop UI and CLI, producing a JSON manifest with Schema Version 3.
- Export manifest includes schema version, generation timestamp, and install metadata resolved via `git remote get-url origin`.
- Export correctly handles GitHub SSH vs HTTPS URLs and normalizes them for the manifest.
- Import starts with a desktop preview modal that allows selecting which skills to import via `selectedIndexes`.
- During import, the app automatically clones missing GitHub sources via `addGitHubSource` using manifest metadata.
- Import result summary reports `installed`, `already-installed`, `added-sources`, and `skipped` outcomes.
- Imported skills are installed to all currently enabled targets after their sources are cloned.
- Invalid or unreadable bundle files show a clear JSON parsing error and do not apply any changes.
