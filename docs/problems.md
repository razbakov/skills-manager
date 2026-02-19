# User Problems

Real-world problems with AI agent skills, collected from forum posts, GitHub issues, and research papers (2025–2026).

## 1. Duplicate Loading / Context Waste

The most concrete user complaint. A Cursor user reported the same `planning-with-files` skill loaded from **11 different paths** — across `~/.codex/skills/`, `~/.claude/plugins/cache/`, and symlinked directories for other tools (Continue, Factory, Clawd, etc.). Each duplicate consumes context tokens on every conversation.

Source: [Cursor Forum #150137](https://forum.cursor.com/t/critical-issue-duplicate-skills-loading-causing-context-window-waste-and-confusion/150137)

**Root cause**: Cursor aggressively scans all tool directories but has no deduplication by name or version. The user's proposed fixes:
- Mandatory deduplication by skill `name`
- "Latest version wins" policy
- User-defined scan scope (whitelist directories)
- A Skills Registry layer that resolves duplicates before injecting into context

Multi-root workspaces compound this — `alwaysApply: true` rules get injected once per workspace root, wasting ~200 lines per message.

## 2. Skills Not Auto-Activating

Claude Code users report skills in `~/.claude/skills/` are not discovered or auto-invoked despite correct `SKILL.md` structure. The skill doesn't appear in the available skills list and returns "Unknown skill" errors.

Workarounds: explicitly mention skill names, or use the Read tool to manually load the SKILL.md file.

Source: [Claude Code #11266](https://github.com/anthropics/claude-code/issues/11266)

## 3. Context Ignoring During Multi-Step Tasks

Claude Code ignores mandatory CLAUDE.md instructions and skill definitions during multi-step tasks. The agent acknowledges the requirements but deviates (e.g., modifying multiple files per commit instead of one file per step as specified).

Source: [Claude Code #18454](https://github.com/anthropics/claude-code/issues/18454)

## 4. Skill Parsing Errors

The Claude Code Skill tool incorrectly parses markdown content as Bash commands. Special characters in backticks (like `!` for non-null assertions) trigger "Bash command permission check failed" errors that prevent skills from loading.

Source: [Claude Code #12762](https://github.com/anthropics/claude-code/issues/12762)

## 5. Context Window Overflow at Scale

Claude Code's skill description budget is 2% of the context window (~16,000 chars fallback). Users with many skills hit this limit — excess skills are silently excluded. No warning unless you run `/context`.

Research confirms the scaling problem: naively exposing all tool schemas causes context bloat, decision compounding (five 90%-accurate calls yield ~59% reliability), and irrelevant noise.

Source: [agentskills/agentskills #11](https://github.com/agentskills/agentskills/issues/11), SkillsBench paper (arXiv:2602.12670)

## 6. Versioning and Lock Conflicts

Dynamic skills create problems when users update skill versions locally — the agent may read one version of metadata while executing scripts from another. No tool supports version pinning or lockfiles.

Source: [agentskills/agentskills #46](https://github.com/agentskills/agentskills/issues/46)

## 7. Skill Composition Without Bloat

When skills are chained, intermediate data repeatedly flows through the model context — higher token costs, lower reliability, degraded context quality. The proposed solution is composable skills with well-defined inputs/outputs and programmatic orchestration that keeps intermediate results out of context.

Source: [agentskills/agentskills #11](https://github.com/agentskills/agentskills/issues/11)

## 8. Security: Prompt Injection via Skills

A research paper demonstrates that Agent Skills enable **trivially simple prompt injections**:
- Every line in a SKILL.md is interpreted as an instruction — direct injection is straightforward
- Long skill files make comprehensive human review difficult — malicious instructions hide in benign content
- Skills operate in coding environments with access to sensitive files (API keys, `.env`)
- A benign "Don't ask again" approval carries over to related harmful actions, bypassing guardrails
- **26.1% of 42,447 skills from marketplaces contained vulnerabilities** (prompt injection, data exfiltration, privilege escalation, supply chain risks)

Source: arXiv:2510.26328 "Agent Skills Enable a New Class of Realistic and Trivially Simple Prompt Injections"

## 9. No Quality Signals or Trust

No tool provides ratings, reviews, or benchmarks for skills. Users have no way to know:
- Is this skill safe? (security audit)
- Does it actually work? (benchmarks across models)
- Is it maintained? (last update, author responsiveness)
- Is it the best option? (compared to alternatives with similar names)

SkillsBench research shows curated skills with 2–3 focused modules outperform comprehensive documentation — but self-generated skills provide negligible or negative benefits.

Source: SkillsBench (arXiv:2602.12670)

---

## Severity Matrix

| Problem | Frequency | Impact | Affected Tools |
|---------|-----------|--------|----------------|
| Duplicate loading | High | High (token waste every conversation) | Cursor, Codex |
| Skills not activating | Medium | High (skill useless) | Claude Code, Cursor |
| Context overflow at scale | Medium | High (skills silently dropped) | All |
| No provenance/updates | Always | Medium (can't trust or update) | All |
| Security/prompt injection | Growing | Critical (data exfiltration) | All |
| No quality signals | Always | Medium (wrong skill chosen) | All |
| Version conflicts | Low | Medium (wrong instructions) | Codex |
| Composition bloat | Low | Medium (multi-skill workflows fail) | All |

## Next Steps

- Define system architecture in `docs/architecture.md`
