---
type: Story
title: "Skill Scanner: Speed Up Skill Loading with Cached Results"
status: draft
---

# Skill Scanner: Speed Up Skill Loading with Cached Results

As a developer managing many skills, I want the app to remember previously discovered skills and check files in parallel, so that the Installed and Available tabs open quickly even when source folders are large.

## Context
The app scans source folders each time it starts. One configured source root is recursive and can include many nested folders. This makes startup slow, even when the skill list has not changed. The product already has Installed and Available views, so this story focuses on making those views load faster by reusing prior scan results.

## Acceptance Criteria
### First Open
- On the first app open after this feature is released, the app reads the configured source folders and saves a local scan snapshot.
- The snapshot stores each discovered skill's name, description, and source location so the Available view can be rebuilt without re-reading every skill file next time.

### Later Opens
- On later opens, when source folders have not changed, the app loads skills from the saved snapshot and does not re-scan all nested folders before showing the list.
- The Installed and Available lists show the same skills and descriptions as the first open.
- If a skill is added, removed, or renamed in a source folder, the next scan updates the snapshot and reflects the change in the list.

### Performance and Reliability
- When the app needs to read multiple skill files, it reads them in parallel to reduce waiting time.
- If the snapshot is missing or unreadable, the app rebuilds it automatically and still opens successfully.

## Out of Scope
- Changes to search behavior, filtering logic, or the visual layout of the Installed and Available tabs.
- Marketplace or remote registry syncing.
