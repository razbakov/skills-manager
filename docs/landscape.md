# Skills Landscape

Directories, registries, sync tools, CLI tools, and benchmarks for AI agent skills (as of February 2026).

## Skill Directories & Marketplaces

### Large-Scale Directories

| Platform | Skills Count | Features | URL |
|----------|-------------|----------|-----|
| **[SkillsMP](https://skillsmp.com/)** | 200,000+ | Category browsing, semantic search, GitHub-sourced | skillsmp.com |
| **[skills.sh](https://skills.sh/)** | 66,049 | Leaderboard system, CLI integration | skills.sh |
| **[agentskill.sh](https://agentskill.sh/)** | 47,000+ | 16+ domain categories, per-tool filtering | agentskill.sh |
| **[SkillMD.ai](https://skillmd.ai/)** | Unknown | Build guides, skill scaffolding | skillmd.ai |
| **[SkillRegistry.io](https://skillregistry.io/)** | Unknown | AI Skills & Agent Tools Directory | skillregistry.io |

### Security-Focused

| Platform | Skills Count | Features | URL |
|----------|-------------|----------|-----|
| **[AgentSkillsHub](https://agentskillshub.dev/)** | 458+ scanned | A–F security grading, risk indicators, maintenance signals | agentskillshub.dev |

### Claude Code Specific

| Platform | Features | URL |
|----------|----------|-----|
| **[Claude Code Marketplace](https://claudecodemarketplace.net/)** | Community-curated plugins/skills/agents, hourly auto-updates, upvoting | claudecodemarketplace.net |
| **[claudecodemarketplace.com](https://claudecodemarketplace.com/)** | Plugin directory with quick start guides | claudecodemarketplace.com |

### Cursor Specific

| Platform | Features | URL |
|----------|----------|-----|
| **[cursor.directory](https://cursor.directory/)** | 72.3k+ community members, rules + MCP servers | cursor.directory |
| **[agentskill.sh/for/cursor](https://agentskill.sh/for/cursor)** | Cursor-filtered view of 47k+ skills | agentskill.sh |

### Codex Specific

| Platform | Features | URL |
|----------|----------|-----|
| **[openai/skills](https://github.com/openai/skills)** | Official catalog: system, curated, experimental. 8,890 stars | GitHub |

---

## Curated Lists & Collections

| Repository | Description | Stars |
|-----------|-------------|-------|
| **[skillmatic-ai/awesome-agent-skills](https://github.com/skillmatic-ai/awesome-agent-skills)** | Definitive curated list — fundamentals, usage, building, research | 151 |
| **[hao-ji-xing/awesome-cursor](https://github.com/hao-ji-xing/awesome-cursor)** | Cursor tools, extensions, rules, projects | 60+ |
| **[jscraik/Agent-Skills](https://github.com/jscraik/Agent-Skills)** | Skills organized by category (DevOps, frontend, backend, etc.) | — |
| **[daniel-scrivner/cursor-skills](https://github.com/daniel-scrivner/cursor-skills)** | 1,391+ AI-powered workflows as `.mdc` files | — |
| **[chrisboden/cursor-skills](https://github.com/chrisboden/cursor-skills)** | Starter template: role-based rules + skills pattern system | — |
| **[agentskills.io](https://agentskills.io/)** | Official spec + reference library + example skills | 10,185 |

### Claude Code Agent/Plugin Collections

| Collection | Count | Description |
|-----------|-------|-------------|
| Seth Hobson's Agents | 83 agents, 42 tools | Specialized AI agents |
| VoltAgent Subagents | 100+ agents | Production-ready full-stack, DevOps, data science |
| lst97's Subagents | 33 agents | Full-stack development |
| CCPlugins | 24 commands | Professional development workflow |

---

## CLI Tools

### Skill Installation

| Tool | Command | Features |
|------|---------|----------|
| **[add-skill](https://add-skill.org/)** | `npx add-skill` | Multi-source (GitHub, GitLab, any git URL), auto-detects installed agents, project/global scope |
| **[skills CLI](https://skills.sh/docs/cli)** | `npx skills add <name>` | Install from skills.sh registry |
| **Codex $skill-installer** | `$skill-installer` | Built-in Codex skill, installs from GitHub repos |

### Skill Authoring

| Tool | Command | Features |
|------|---------|----------|
| **[build-skill](https://www.npmjs.com/package/build-skill)** | `npx build-skill` | Scaffolds repo structure, GitHub Actions, ~106k weekly downloads |
| **Codex $skill-creator** | `$skill-creator` | Built-in Codex skill, interactive creation wizard |
| **[skills-ref](https://github.com/agentskills/agentskills)** | `skills-ref validate ./my-skill` | Official validation library from agentskills spec |

### Skill Syncing (Cross-Tool)

| Tool | Language | Supported Agents | Features |
|------|----------|-----------------|----------|
| **[skillshare](https://github.com/runkids/skillshare)** | Go | 48+ agents | Declarative config, bidirectional sync, web dashboard, security audit |
| **[SkillKit](https://github.com/rohitg00/skillkit)** | TypeScript | 44 agents | Package manager, auto-translates formats, 15k+ marketplace, smart recommendations |
| **[Skills CLI](https://dhruvwill.github.io/skills-cli/)** | Bun | Cursor, Claude, Gemini, Copilot, Windsurf | Pull from GitHub/GitLab, sync to multiple targets |
| **[SkillHub](https://github.com/cloudvalley-tech/skillhub)** | TypeScript | Cursor, Claude, Copilot, Windsurf, Aider | Git-sync team standards, per-project linking |
| **[cortesi/skills](https://github.com/cortesi/skills)** | Rust | Claude Code, Codex | Push/pull/sync from single source repo |

---

## Benchmarks & Evaluation

| Tool | Scope | Key Metrics |
|------|-------|-------------|
| **[SkillsBench](https://skillsbench.ai/)** | 86 tasks, 11 domains, 7 model configs | Curated skills +16.2pp avg. pass rate; self-generated skills negligible benefit |
| **[HAL (Holistic Agent Leaderboard)](https://arxiv.org/abs/2510.11977)** | 21,730 rollouts, 9 models, 9 benchmarks | Standardized evaluation harness, parallel VM orchestration |
| **[OpenSearch skills-eval](https://github.com/opensearch-project/skills-eval)** | OpenSearch agent framework | Quality and performance evaluation |
| **Vercel AGENTS.md vs Skills** | Internal evaluation | AGENTS.md: 94% reliability, 0.3 errors/task; Skills: 78%, 0.7 |

---

## What's Missing

Despite this growing ecosystem, key gaps remain:

1. **No unified search** — Each directory is independent. No way to search across all of them.
2. **No trust layer** — Only AgentSkillsHub does security scanning (458 skills). The other 200k+ are unaudited.
3. **No cross-tool identity** — The same skill in SkillsMP, agentskill.sh, and skills.sh has no shared ID or dedup.
4. **No user ratings at scale** — Community voting exists only on claudecodemarketplace.net.
5. **No dependency resolution** — CLI tools install skills but don't resolve conflicts or pin versions.
6. **Sync tools are fragmented** — Five separate sync tools, each with different config formats and agent support.

## Next Steps

- Define system architecture in `docs/architecture.md`
