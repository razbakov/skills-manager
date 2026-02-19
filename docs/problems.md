# User Problems

Real-world problems with AI agent skills, collected from forum posts, GitHub issues, research papers, Reddit, and blog posts (2025–2026).

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

Claude Code users report skills in `~/.claude/skills/` are not discovered or auto-invoked despite correct `SKILL.md` structure. The skill doesn't appear in the available skills list and returns "Unknown skill" errors. Even when installed, skills don't show up in `/skills` output, creating confusion about installation status.

A broader pattern: Claude defaults to low-level tools (Bash, Read) instead of checking available skills first, making custom skills essentially unusable without manual intervention every time.

Workarounds: explicitly mention skill names, use the Read tool to manually load the SKILL.md file, or inject skill invocation instructions via shell hooks (unreliable).

Sources: [Claude Code #11266](https://github.com/anthropics/claude-code/issues/11266), [Claude Code #19308](https://github.com/anthropics/claude-code/issues/19308), [Claude Code #14733](https://github.com/anthropics/claude-code/issues/14733), [Scott Spence workaround](https://scottspence.com/posts/claude-code-skills-dont-auto-activate)

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

## 8. Fragmented Discovery Paths

The spec standardized the format but not the location. Each tool stores skills in its own directory:
- `.claude/skills/`, `.codex/skills/`, `.cursor/skills/`, `.copilot/skills/`, `.github/skills/`

A popular Reddit post ("The spec unified us. The paths divided us.") captured the frustration: "Write once, store... wherever your agent feels like." Users switching between agents must maintain copies or symlinks. One commenter noted companies do this deliberately to increase switching friction.

The symlink workaround (e.g., `ln -s AGENTS.md CLAUDE.md`) helps but breaks on some filesystems (exFAT) and adds maintenance burden.

Sources: [r/LocalLLaMA](https://www.reddit.com/r/LocalLLaMA/comments/1qcm8ds/agent_skills_the_spec_unified_us_the_paths/), [aihackers.net](https://aihackers.net/posts/agents-md-practical-guide/)

## 9. Name Conflicts and Precedence Confusion

When global slash commands and skills share the same name, the skill takes precedence silently. Invoking `/code-review` triggers the skill instead of the command, with the system responding that only Claude can invoke it. Skill matching also incorrectly matches abbreviations to unintended skills.

Source: [Claude Code #15065](https://github.com/anthropics/claude-code/issues/15065)

## 10. Skills Underperform AGENTS.md for Conventions

Vercel's internal evaluation (October 2025) found AGENTS.md outperformed skills on core metrics:

| Metric | AGENTS.md | Skills |
|--------|-----------|--------|
| Formatting reliability | 94% | 78% |
| Error rate (per task) | 0.3 | 0.7 |
| Setup time | 5 min | 30 min |

Why: AGENTS.md is always in context (no decision point), faster to iterate, and consistently available. Skills load asynchronously, requiring the agent to decide whether to load them — a decision it often gets wrong.

Skills still win for heavy workflows (multi-step deploys, complex test suites), but for conventions and guardrails, AGENTS.md is strictly better.

Source: [Vercel evaluation](https://vercel.com/blog/agents-md-vs-skills), [aihackers.net analysis](https://aihackers.net/posts/agents-md-practical-guide/)

## 11. Dependency and Environment Mismatch

Skills run differently locally vs. remotely. Locally they access any binary in the system PATH; remotely they get a minimal sandboxed Python environment. A skill that works on your machine may fail in CI or the agent VM. No standard for declaring or resolving dependencies.

Source: [Tom MacWright first-run review](https://macwright.com/2025/10/20/agent-skills)

## 12. Agents Create Skills Incorrectly

When asked to create skills, agents frequently get the format wrong — missing YAML headers, wrong directory structure (`.claude/skills/ast-grep.md` instead of `.claude/skills/ast-grep/SKILL.md`). Skills then silently fail with no error feedback.

Source: [Tom MacWright first-run review](https://macwright.com/2025/10/20/agent-skills), [r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/comments/1r5yuhn/npx_buildskill/)

## 13. Security: Prompt Injection via Skills

A research paper demonstrates that Agent Skills enable **trivially simple prompt injections**:
- Every line in a SKILL.md is interpreted as an instruction — direct injection is straightforward
- Long skill files make comprehensive human review difficult — malicious instructions hide in benign content
- Skills operate in coding environments with access to sensitive files (API keys, `.env`)
- A benign "Don't ask again" approval carries over to related harmful actions, bypassing guardrails
- **26.1% of 42,447 skills from marketplaces contained vulnerabilities** (prompt injection, data exfiltration, privilege escalation, supply chain risks)

Source: arXiv:2510.26328 "Agent Skills Enable a New Class of Realistic and Trivially Simple Prompt Injections"

## 14. No Quality Signals or Trust

No tool provides ratings, reviews, or benchmarks for skills. Users have no way to know:
- Is this skill safe? (security audit)
- Does it actually work? (benchmarks across models)
- Is it maintained? (last update, author responsiveness)
- Is it the best option? (compared to alternatives with similar names)

SkillsBench research shows curated skills with 2–3 focused modules outperform comprehensive documentation — but self-generated skills provide negligible or negative benefits.

Source: SkillsBench (arXiv:2602.12670)

---

## Severity Matrix

| # | Problem | Frequency | Impact | Affected Tools |
|---|---------|-----------|--------|----------------|
| 1 | Duplicate loading | High | High (token waste every conversation) | Cursor, Codex |
| 2 | Skills not activating | High | High (skill useless) | Claude Code, Cursor |
| 3 | Context ignoring | Medium | High (skill instructions drift) | Claude Code |
| 4 | Skill parsing errors | Medium | High (skill won't load) | Claude Code |
| 5 | Context overflow at scale | Medium | High (skills silently dropped) | All |
| 6 | Version conflicts | Low | Medium (wrong instructions) | Codex |
| 7 | Composition bloat | Low | Medium (multi-skill workflows fail) | All |
| 8 | Fragmented discovery paths | Always | Medium (manual symlinks needed) | All |
| 9 | Name conflicts / precedence | Medium | Medium (wrong skill triggered) | Claude Code |
| 10 | Skills underperform AGENTS.md | Always | Medium (lower reliability for conventions) | All |
| 11 | Dependency mismatch | Medium | Medium (works locally, fails remotely) | All |
| 12 | Agents create skills wrong | High | Medium (silent failure) | Claude Code, Cursor |
| 13 | Security / prompt injection | Growing | Critical (data exfiltration) | All |
| 14 | No quality signals | Always | Medium (wrong skill chosen) | All |

## Next Steps

- Define system architecture in `docs/architecture.md`
