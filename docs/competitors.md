# Competitors

Detailed analysis of existing tools and platforms that address parts of the skills management problem (as of February 2026).

## Category Map

| Category | What it solves | Players |
|----------|---------------|---------|
| **Sync Tools** | One source → multiple agents | skillshare, SkillKit, SkillHub, Skills CLI, cortesi/skills |
| **Marketplaces** | Discovery & browsing | SkillsMP, skills.sh, agentskill.sh, AwesomeAgentSkills, GetAgentSkills, DeepSkills, Skillplugs, agentskillsrepo |
| **Package Managers** | Install, version, update | Tessl, SkillKit, add-skill, skills CLI |
| **Security Scanners** | Trust & safety | SkillScan.dev, AgentSkillsHub, Cisco skill-scanner, Snyk agent-scan, skillshare audit |
| **Benchmarks** | Quality evaluation | Tessl, SkillsBench |
| **Authoring** | Create & scaffold | build-skill, Codex $skill-creator, skills-ref |
| **Plugin Ecosystems** | Claude Code plugins/agents | Claude Code Marketplace, CCPlugins, VoltAgent |

---

## Sync Tools

### skillshare (runkids)

The most mature cross-tool sync solution.

| | |
|---|---|
| **Language** | Go (single binary, no runtime deps) |
| **Stars** | 541 |
| **Agents** | 49+ (Claude Code, Codex, Cursor, OpenCode, OpenClaw, Gemini, etc.) |
| **License** | MIT |

**What it does well:**
- Declarative `config.yaml` — define targets once, `sync` handles everything
- Two sync modes: `symlink` (identical everywhere) and `merge` (preserves local customizations)
- Bidirectional: `collect` pulls improvements back from agent directories
- Cross-machine: git-native `push`/`pull`
- Built-in security audit with configurable block thresholds
- Web dashboard (`skillshare ui`) for visual management
- Project-scoped skills (`.skillshare/` per repo) + org-level tracked repos
- Skill Hub for private/community searchable catalogs

**What it doesn't do:**
- No quality ratings or benchmarks
- No provenance tracking (author, version history)
- No deduplication intelligence (user manages this manually)
- No registry — searches GitHub or hub indexes

**Differentiator:** Privacy-first (no telemetry, no central registry). Everything stays local.

---

### SkillKit (rohitg00)

Package manager + sync + marketplace in one.

| | |
|---|---|
| **Language** | TypeScript |
| **Stars** | 351 |
| **Agents** | 44 |
| **License** | Apache 2.0 |

**What it does well:**
- Auto-translates between agent-specific formats (Claude `.claude/skills/`, Cursor `.mdc`, Copilot `.github/skills/`)
- 15,000+ skill marketplace with smart recommendations based on project stack
- Security scanning for 46+ threat types
- Session Memory — captures and persists AI agent learnings
- Session Intelligence — unified event streams and agent-to-agent handoff
- MCP server integration and REST API
- Mesh Network for distributed agent deployment (encrypted P2P)

**What it doesn't do:**
- No web dashboard
- No bidirectional sync
- No quality benchmarks beyond security
- Heavier runtime (Node.js)

**Differentiator:** Most ambitious scope — tries to be a full "agent enablement platform" with session intelligence and mesh networking.

---

### SkillHub (cloudvalley-tech + skillhub.club)

Desktop app + web marketplace + CLI.

| | |
|---|---|
| **Language** | TypeScript |
| **Agents** | 8+ (Claude, Cursor, Copilot, Windsurf, Gemini, etc.) |
| **Skills** | 16.8k–21.3k indexed |

**What it does well:**
- Free desktop app (macOS, Windows, Linux)
- One-click install to all agents simultaneously
- Semantic search by tool, tag, language, or problem space
- Skill stacks — curated collections for teams/projects
- Live updates from skill creators
- Web marketplace at skillhub.club
- Multi-language support

**What it doesn't do:**
- No security scanning
- No benchmarks
- No bidirectional sync
- Fewer supported agents than skillshare/SkillKit

**Differentiator:** Best end-user UX with desktop app + web marketplace + skill stacks.

---

### Skills CLI (dhruvwill) & cortesi/skills

Lighter-weight sync tools.

- **Skills CLI**: Bun-based, pulls from GitHub/GitLab, syncs to Cursor/Claude/Gemini/Copilot/Windsurf
- **cortesi/skills**: Rust-based, focused on Claude Code + Codex only, minimal push/pull/sync

Neither has marketplaces, security scanning, or dashboards. Good for personal use, too thin for teams.

---

## Package Managers

### Tessl

The only commercial/enterprise-grade player.

| | |
|---|---|
| **Type** | Commercial (free tier available) |
| **Agents** | Claude Code, Cursor, Gemini, Codex |
| **Registry** | Thousands of evaluated skills |

**What it does well:**
- **Skill evaluation** — two methods: conformance reviews (best practices) and task evaluations (real-world performance)
- Measurable results: 1.8x–3.3x agent performance improvement with evaluated skills
- Version management with regression detection
- "Tiles" — bundles of skills, docs, and rules as portable context
- Full lifecycle: install, version, update, evaluate

**What it doesn't do:**
- Not open-source
- Fewer agents than skillshare/SkillKit
- No security scanning mentioned
- No bidirectional sync

**Differentiator:** Only player doing real benchmarked skill evaluation with measurable performance gains.

---

### add-skill & npx skills

Lightweight install-only tools.

- **add-skill** (`npx add-skill`): Multi-source install (GitHub, GitLab, any git URL), auto-detects installed agents, global/project scope
- **skills CLI** (`npx skills add`): Install from skills.sh registry

Neither does sync, evaluation, or security scanning. Useful as installation step, not management solution.

---

## Marketplaces / Directories

### Scale Comparison

| Platform | Skills | Security | Ratings | Search |
|----------|--------|----------|---------|--------|
| **SkillsMP** | 239,658 | None | Quality indicators | Semantic + keyword |
| **skills.sh** | 66,049 | None | Leaderboard | CLI + web |
| **agentskill.sh** | 47,000+ | None | None | Web, per-tool filter |
| **AwesomeAgentSkills** | 41,295 | None | GitHub stats | Category + popularity |
| **GetAgentSkills** | Thousands | None | User ratings | Category + trending |
| **SkillHub marketplace** | 21,300 | None | Recommended | Semantic |
| **SkillKit marketplace** | 15,000+ | 46 threat types | None | Project-based |
| **openai/skills** | ~100 | None | None | GitHub |
| **AgentSkillsHub** | 458 | A–F grading | Heat score | Category |

**Key observation:** The bigger the marketplace, the less quality control. AgentSkillsHub is the only one doing rigorous security scanning but covers < 0.2% of the total skill pool.

Most marketplaces are **GitHub scrapers** — they index repos containing SKILL.md files. The "239k skills" number is inflated; many are low-quality, duplicates, or auto-generated.

---

## Security Scanners

| Tool | Type | Coverage | Features |
|------|------|----------|----------|
| **SkillScan.dev** | Free SaaS | Any GitHub repo | Prompt injection, data exfil, unsafe execution, supply chain, verification badge |
| **AgentSkillsHub** | Registry-integrated | 458 skills | A–F grading, heat scores, daily re-scan |
| **Cisco skill-scanner** | Open-source | Any skill | Pattern-based + LLM analysis |
| **Snyk agent-scan** | Open-source | MCP + skills | Snyk ecosystem integration |
| **skillshare audit** | Built-in | Local skills | Prompt injection, data exfil, credential theft, auto-scan on install |
| **SkillKit scanning** | Built-in | Local skills | 46+ threat types |

**Key observation:** Security scanning is fragmented — no single source of truth for "is this skill safe?" Each tool scans independently with different rules and thresholds.

---

## Competitive Gaps — What No One Does

| Capability | Best Current | Gap |
|-----------|-------------|-----|
| **Unified search across all directories** | None | Each marketplace is siloed |
| **Cross-directory deduplication** | None | Same skill appears in 5+ places with different metadata |
| **Provenance chain** | None | No tool tracks author → fork → install → update history |
| **Community ratings at scale** | GetAgentSkills (basic) | No tool has npm-like download counts + quality scores |
| **Benchmarks across models/harnesses** | Tessl (proprietary), SkillsBench (research) | No open, per-skill benchmark database |
| **Dependency resolution** | None | Skills can conflict; no tool detects or resolves this |
| **Scope management UI** | skillshare ui (basic) | No tool shows "which skills are active in this project, from where, with what precedence?" |
| **Version pinning / lockfiles** | None | All tools install latest; no reproducible skill environments |
| **AGENTS.md ↔ Skills bridge** | None | Vercel showed AGENTS.md beats skills for conventions, but no tool helps migrate between them |

---

## Positioning Map

```
                    Discovery / Marketplace
                           ▲
                           │
          SkillsMP ●       │       ● GetAgentSkills
     agentskill.sh ●       │       ● AwesomeAgentSkills
                           │
       SkillHub ●──────────┼──────────● SkillKit
                           │
                           │
  Security ◄───────────────┼───────────────► Evaluation
                           │
     AgentSkillsHub ●      │        ● Tessl
        SkillScan ●        │        ● SkillsBench
   Cisco scanner ●         │
                           │
                           │
      cortesi/skills ●     │     ● add-skill
        Skills CLI ●───────┼───────● npx skills
                           │
                           ▼
                    Sync / Management
                    skillshare ●
```

**The center is empty.** No tool combines discovery + security + evaluation + sync + scope management into one coherent experience.

## Next Steps

- Define system architecture in `docs/architecture.md`
