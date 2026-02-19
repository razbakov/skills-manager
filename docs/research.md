# Skills Ecosystem Research

Research into how AI agent skills work across Cursor, Codex, and Claude Code, plus the open standard that unifies them.

## Open Standard: Agent Skills (agentskills.io)

Originally developed by **Anthropic**, released as an **open standard**, and adopted by multiple agent products (Claude Code, Codex, Cursor).

### Skill Format

A skill is a directory with a required `SKILL.md` file:

```
skill-name/
├── SKILL.md           # Required — YAML frontmatter + markdown instructions
├── scripts/           # Optional — executable code agents can run
├── references/        # Optional — additional docs loaded on demand
└── assets/            # Optional — static resources (schemas, templates, images)
```

**Required frontmatter fields:**
- `name` — max 64 chars, lowercase + hyphens, must match directory name
- `description` — max 1024 chars, describes what the skill does and when to use it

**Optional frontmatter fields:**
- `license`, `compatibility`, `metadata` (arbitrary key-value), `allowed-tools`

### Progressive Disclosure

Agents use a three-tier loading strategy:
1. **Metadata** (~100 tokens) — `name` + `description` loaded at startup for all skills
2. **Instructions** (< 5000 tokens recommended) — full `SKILL.md` body loaded on activation
3. **Resources** (as needed) — supporting files loaded only when required

---

## Cursor IDE

### Skill Locations

| Scope | Path |
|-------|------|
| Personal (global) | `~/.cursor/skills/<name>/SKILL.md` |
| Project | `.cursor/skills/<name>/SKILL.md` |

### Activation

- **Implicit**: Agent auto-activates when request matches skill `description`
- **Explicit**: User types `/skill-name` in chat

### Scoping / Conflicts

- Skills appear under **Settings > Rules > Agent Decides**
- No built-in conflict resolution between skills with the same name
- No enable/disable toggle — skills exist or they don't
- Also has a separate **Rules** system (`.cursor/rules/*.mdc`) with richer precedence: Team > Project > User > Legacy > AGENTS.md

### Gaps

- No provenance tracking (author, source, version)
- No quality signals or ratings
- No registry / catalog integration
- No deduplication or conflict detection
- No CLI for skill management

---

## OpenAI Codex

### Skill Locations

| Scope | Path | Use |
|-------|------|-----|
| Repo (CWD) | `$CWD/.agents/skills` | Per-module skills |
| Repo (parent) | `$CWD/../.agents/skills` | Shared area in monorepo |
| Repo (root) | `$REPO_ROOT/.agents/skills` | Org-wide repo skills |
| User | `$HOME/.agents/skills` | Personal skills |
| Admin | `/etc/codex/skills` | Machine/container defaults |
| System | Bundled by OpenAI | Built-in skills |

### Activation

- **Implicit**: Codex matches task to skill `description`
- **Explicit**: `/skills` command or `$skill-name` mention

### Enable / Disable

Via `~/.codex/config.toml`:
```toml
[[skills.config]]
path = "/path/to/skill/SKILL.md"
enabled = false
```

### Optional Metadata (`agents/openai.yaml`)

- `display_name`, `short_description`, `icon_small`, `icon_large`, `brand_color`
- `allow_implicit_invocation: false` to block auto-activation
- `dependencies.tools` — declare MCP server dependencies

### Install / Create

- Built-in `$skill-installer` for installing from repos
- Built-in `$skill-creator` for authoring new skills

### Gaps

- No quality scores or ratings
- No centralized registry (uses GitHub repos)
- Name collisions are visible but not resolved — "both can appear"

---

## Claude Code

### Skill Locations

| Scope | Path |
|-------|------|
| Enterprise | Managed settings (org-wide) |
| Personal | `~/.claude/skills/<name>/SKILL.md` |
| Project | `.claude/skills/<name>/SKILL.md` |
| Plugin | `<plugin>/skills/<name>/SKILL.md` |
| Nested | `packages/<pkg>/.claude/skills/` (monorepo) |

### Activation

- **Implicit**: Claude loads skill when relevant to conversation
- **Explicit**: User types `/skill-name`

### Conflict Resolution

When skills share the same name across levels: **enterprise > personal > project**. Plugin skills use `plugin-name:skill-name` namespace to avoid collisions.

### Extended Frontmatter (beyond the open standard)

- `disable-model-invocation: true` — prevent auto-activation
- `user-invocable: false` — hide from `/` menu
- `context: fork` — run in isolated subagent
- `agent` — choose subagent type (`Explore`, `Plan`, custom)
- `model` — override model for this skill
- `hooks` — lifecycle automation
- `argument-hint` — autocomplete hints

### Dynamic Features

- `$ARGUMENTS` / `$0`, `$1` — argument substitution
- `` !`command` `` — shell command preprocessing (inject dynamic context)
- Subagent execution with `context: fork`

### Context Budget

Skill descriptions consume 2% of context window (fallback: 16,000 chars). Excess skills are excluded. Override with `SLASH_COMMAND_TOOL_CHAR_BUDGET`.

### Gaps

- No quality scores or ratings
- No centralized public registry
- No deduplication across scopes (precedence-based override only)

---

## Existing Registries / Catalogs

| Platform | Description |
|----------|-------------|
| [github.com/openai/skills](https://github.com/openai/skills) | Official Codex skill examples |
| [agentskills.io](https://agentskills.io/) | Open standard spec + reference library |
| [SkillMD.ai](https://skillmd.ai/) | Skill catalog with build guides |
| [SkillRegistry.io](https://skillregistry.io/) | AI Skills & Agent Tools Directory |

---

## Summary: Unsolved Problems

| Problem | Cursor | Codex | Claude Code |
|---------|--------|-------|-------------|
| **Naming collisions** | No detection | Shows both, no merge | Precedence-based override |
| **Enable/disable** | Delete the file | `config.toml` | `disable-model-invocation` (per-skill only) |
| **Provenance** | None | None | None |
| **Quality scores** | None | None | None |
| **Unified registry** | None | GitHub repos | None |
| **Cross-tool portability** | Partial (follows standard) | Partial (follows standard) | Partial (extends standard) |

The open Agent Skills standard provides a common format, but no tool solves the **management layer**: discovering, rating, deduplicating, scoping, and updating skills across tools and collections.

See **[User Problems](problems.md)** for real-world complaints, bug reports, and security research.

## Next Steps

- Define system architecture in `docs/architecture.md`
