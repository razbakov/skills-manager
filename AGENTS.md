## Learned User Preferences
- Prefer feature and backlog outputs with explicit traceability to the underlying problems and clear sourcing.
- Prefer a practical management UI over raw CLI for this project, including installed/available views, fuzzy search, and direct enable/disable/uninstall actions.
- Prefer keyboard-first TUI interactions with predictable navigation and search behavior in both Installed and Available views.
- Prefer source/package path visibility in skill lists, and expect source path metadata to be searchable.
- Prefer clear in-UI feedback when install or disable actions are triggered.
- Prefer deterministic ordering in UI lists (alphabetical sorting for installed and available skills).

## Learned Workspace Facts
- This workspace is focused on managing AI coding skills across Cursor, Codex, and Claude.
- Skill-management requirements include handling overlapping skill names/responsibilities, provenance/author visibility, update paths, and personal/organization/project collections.
- Managed skill installation is expected to use symlinks.
- Default local root for source repositories is expected at `~/.skills-manager/sources`.
- Source discovery needs to account for nested collections and hidden directories that can contain skills.
