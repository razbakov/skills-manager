---
type: Story
title: "Settings: Choose Target IDEs for Skill Symlinks"
status: draft
---

# Settings: Choose Target IDEs for Skill Symlinks

As a developer, I want to choose which AI coding tools receive skill symlinks, so that skills are only installed into the tools I actually use and I don't clutter tools I've stopped using or haven't set up yet.

## Context

Skills Manager currently hard-codes three target directories — one each for Cursor, Codex, and Claude Code. The Agent Skills standard (`SKILL.md`) has been adopted by a much wider set of tools, including Gemini CLI, Antigravity, GitHub Copilot, VS Code, Amp, Goose, and OpenCode. Every install or uninstall operation applies to all configured targets regardless of whether the tool is actually present on the machine. This means symlinks are created in directories that may not exist or belong to tools the user never opens, and there is no way to add a new tool or remove an old one without editing the config file by hand.

### Supported Tools and Skills Directories

The following tools support the Agent Skills standard. Detection checks for the presence of the tool's skills directory in the user's home folder:

| Tool | Skills Directory |
|------|-----------------:|
| Cursor | `~/.cursor/skills/` |
| Claude Code | `~/.claude/skills/` |
| Codex (OpenAI) | `~/.codex/skills/` |
| Gemini CLI | `~/.gemini/skills/` |
| Antigravity | `~/.gemini/antigravity/skills/` |
| GitHub Copilot / VS Code | `~/.copilot/skills/` |
| Amp | `~/.config/agents/skills/` |
| Goose (Block) | `~/.config/goose/skills/` |
| OpenCode | `~/.config/opencode/skills/` |

Several tools also read from the cross-compatible `~/.agents/skills/` directory as a shared fallback. This list should be easy to extend as new tools adopt the standard.

## Acceptance Criteria

- When Skills Manager runs for the first time and creates a default configuration, it checks which supported AI coding tools are installed on the machine before setting the targets list.
- Only tools that are detected as installed are included as targets in the default configuration; tools that are not found are left out.
- Detection covers all tools listed in the supported tools table, checking for the presence of each tool's configuration or skills directory in the user's home folder.
- A "Settings" area is available in both the terminal interface and the desktop (Electron) interface.
- The Settings area shows the full list of supported AI coding tools with a toggle next to each one indicating whether it is currently a target for skill symlinks.
- Each tool's row shows its name and whether it was detected as installed on the machine.
- The user can enable or disable any tool as a target, regardless of whether it is detected — this allows opting in to a tool the user plans to install later.
- Changes to the target list are saved to the configuration file automatically when the user confirms.
- After changing targets, installing or uninstalling a skill applies only to the currently enabled targets.

## Out of Scope

- Per-skill target overrides (installing a specific skill into only one tool).
- Auto-detecting project-level tool configurations (only global/user-level detection).
- Monitoring the filesystem for newly installed or removed tools after the initial check.
