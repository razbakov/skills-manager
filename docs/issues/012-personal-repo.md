---
type: Story
title: "Settings: Configure Personal Repository for Adopted Skills"
estimation: 3
status: completed
---

As a developer, I want to configure a personal repository in Settings, so that adopted unmanaged skills are stored and tracked in my preferred repo.

## Acceptance Criteria

- Settings includes a `Personal Repo` section with GitHub URL input and a `Use Repo` action.
- Entering a valid GitHub URL configures that repository as the personal repository.
- If the same repository already exists as a source, the app reuses it instead of creating a duplicate source.
- Personal repo status shows whether it is configured and whether the configured path is valid.
- Users can open the configured personal repository path from Settings.
- Users can clear personal repository configuration from Settings.
- After configuration, unmanaged skill adoption uses this repository as the destination.
