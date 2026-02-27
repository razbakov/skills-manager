# Releases

## v0.7.1 — 2026-02-27

### Install Reliability Patch

This patch improves setup and update reliability for users.

#### Installation & Update Reliability

- **Faster first-time setup** — New installs now fetch only runtime
  dependencies, which reduces stalls during `bun install`.
- **More predictable updates** — In-app updates now follow the same
  runtime-only install strategy before rebuilding the UI.

#### Internal & Platform

- **Runtime dependency boundaries clarified** — Dependencies required
  to run the app are now explicitly treated as runtime dependencies so setup
  and updates behave consistently.

---

## v0.7.0 — 2026-02-27

### Cross-Device Collection Sync Completion

This release completes personal repo sync so switching laptops restores not only
collection names, but also collection membership and missing skills.

- **Collection import from personal repo** — Collection files from the
  personal repository are now read back into local collection state during
  refresh/snapshot generation.
- **Full membership preservation** — Collection models now keep full member
  lists instead of only currently installed members.
- **Auto-install on sync** — After a successful pull, Sync now imports all
  collection manifests and installs missing skills automatically.
- **Clearer collection detail view** — Non-installed synced members appear in a
  dedicated "Synced (Not Installed)" section with an install action when the
  source is available locally.
- **Sync feedback update** — Sync success toast now shows backend sync/install
  summary details instead of a fixed message.

---

## v0.6.0 — 2026-02-25

### Feedback: Report Wrong AI Responses from Sessions

You can now report bad AI responses directly from a skill's detail page, using real chat history as evidence.

- **Report issue button** — Every skill now has a "Report issue" action that opens a dedicated feedback workspace.
- **Session list** — The workspace shows all Cursor and Codex sessions where the selected skill was used, so you can find the conversation with the bad response.
- **Dialogue view** — Opening a session shows the full user/AI conversation. Messages before the first skill invocation are collapsed by default to keep focus on what the agent actually did; a toggle reveals earlier context.
- **Skill invocation badges** — Skill invocations appear as labelled badges rather than raw SKILL.md file paths.
- **Mark wrong response** — Select any AI message to mark it as wrong. Then describe what was wrong and what the correct behaviour should have been. An optional suggested rule can be included.
- **AI analysis** — After filling in the expected behaviour, the app runs an AI analysis of the issue: likely cause, whether a rule fix is feasible, any contradictions with existing guidance, and a suggested rule patch.
- **Local draft + GitHub issue** — Reports are saved locally first as "Pending sync". A separate "Submit report" action creates a GitHub issue in the skill's repository with the full report attached.

---

## v0.5.0 — 2026-02-25

### Collection Sharing & Install Reliability

This release makes sharing collections more streamlined and reduces setup
failures on Windows development environments.

- **Collection sharing flow** — Improved the sharing experience so users can
  publish and reuse collection links with fewer steps.
- **WSL install guard** — Added a safeguard for Windows Subsystem for Linux
  setups to prevent unsupported install paths and guide users to a working
  configuration.

---

## v0.4.1 — 2026-02-24

### Collection Import Quality Improvements

This patch release improves how collection-based installs appear and behave in
the Add Skills flow.

- **Direct collection file installs** — Add Skills now accepts
  `owner/repo/file.json` inputs to install from a specific collection file in a
  repository.
- **Cleaner collection tabs** — Collection tabs that have no matching skills
  are hidden, reducing confusion during selection.

---

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
