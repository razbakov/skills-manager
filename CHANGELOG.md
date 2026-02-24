# Releases

## v0.4.0 — 2026-02-24

### Collection Tabs in Add Skills Dialog

When loading a source that contains collection files, the Add Skills dialog now shows tabs — one "Skills" tab (all skills) plus one tab per collection found in the repository.

- **Collection tabs** — Clicking a collection tab filters the skill list to show only skills in that collection, with all of them pre-selected.
- **Auto-select from input** — Pasting `owner/repo/file.json` (e.g. `razbakov/skills/ommax-dev.json`) automatically activates the matching collection tab.
- **Select All / Select None** — These buttons now operate on the currently visible (filtered) skills rather than the full list.

---

## v0.3.0 — 2026-02-24

### Collection Sharing & Skill Set CLI Support

Share your curated skill collections with teammates using a single command.

- **Share button** — In the collection detail view, a new "Share" button (next to "Export") syncs the collection to your personal repository and displays a copyable command: `npx -y skill-mix owner/repo/collection.json`.
- `**owner/repo/file.json` input support** — The Add Skills input and the `skill-mix` CLI now accept `owner/repo/file.json` to install skills from a specific collection file within a repository.
- **Collection JSON format** — Collection files now use the same schema as exported JSON (`schemaVersion`, `generatedAt`, `installedSkills`), making them portable and consistent with imports/exports.
- **Root-level storage** — Collection files are stored directly in the repository root (`<name>.json`) instead of a `collections/` subdirectory.
- **SSH authentication fix** — Git push/pull operations from the Electron app now use SSH instead of HTTPS to avoid credential conflicts with Cursor's built-in Git integration.
- **Sync button** — A "Sync" button in the main header runs `git pull --rebase` then `git push` on your personal skills repository. When no repository is configured, a "Setup Sync" button opens a guided setup dialog.

---

## v0.2.0 — 2026-02-24

### Collections, Skill Sets & Desktop Improvements

Major UI and architecture updates for organizing and sharing skills.

- **Skill collections** — Create named groups of skills (collections) to organize your toolkit. Collections replace the earlier "skill sets" concept with a simpler, toggleable model.
- **Collections tab** — A top-level "Collections" tab in the sidebar provides a unified view of all your collections.
- **Selectable import flow** — Adding skills from a path, repository URL, or marketplace URL now shows a preview with checkboxes to pick exactly which skills to install.
- **CLI skill picker** — `npx -y skill-mix owner/repo [skill ...]` opens the desktop app with a pre-filtered skill selection dialog.
- **Export from collections** — Export selected collections as JSON for backup or sharing.
- **Token budget estimates** — The Installed view shows estimated active token usage per skill using tiktoken.
- **AI skill review** — Persistent 5-point AI reviews for each skill, with a compact UI and runtime framework integration.
- **OpenClaw directory** — Added OpenClaw as a skill source target.
- **Windows installer** — Added Windows build targets alongside the existing macOS DMG.
- **Package renamed** — The npm package is now `skill-mix` (was `skills-manager`).
- **Bug fixes** — Fixed broken symlink pruning during refresh, UI hanging on long AI reviews, and update status display.

---

## v0.1.0 — 2026-02-21

### Initial Release

First public release of Skills Manager — a desktop application for discovering, installing, and managing AI agent skills across Cursor, Codex, and Claude Code.

- **Desktop app** — Electron-based GUI for browsing and managing installed skills.
- **Skill discovery** — Install skills from GitHub repositories using `owner/repo` shorthand or full URLs.
- **CLI launcher** — `skills` command to launch the application; `skills set` to trigger the skill picker from the terminal.
- **macOS DMG** — Packaged installer for macOS.
- **Unit tests** — Core functionality covered with automated tests.
