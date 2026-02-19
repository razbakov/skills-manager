# Competitive Analysis

Structured competitive analysis of the AI agent skills management space (February 2026).

## Competitive Set

### Direct Competitors

Products solving the same problem (manage skills across agents) for the same users (developers using AI coding tools).

| Competitor | Focus | Why Direct |
|-----------|-------|------------|
| **skillshare** | Cross-tool sync | Solves "one source, many agents" with declarative config |
| **SkillKit** | Package manager + sync + marketplace | Tries to be the npm for skills |
| **SkillHub** | Desktop app + marketplace + sync | Best UX, visual management |
| **Tessl** | Enterprise package manager + evaluation | Only commercial player, benchmarked quality |

### Indirect Competitors

Different approach to the same need (making AI agents work better with context).

| Competitor | Approach | Why Indirect |
|-----------|----------|-------------|
| **AGENTS.md / CLAUDE.md** | Static config files | Vercel showed these beat skills for conventions (94% vs 78% reliability). Many users choose this instead of skills. |
| **MCP servers** | Runtime tool integration | Heavier than skills but more capable. Some use cases overlap. |
| **Cursor Rules (`.mdc`)** | IDE-native rules | Cursor-specific, richer precedence than skills, but not portable. |

### Adjacent Competitors

Could expand into skills management.

| Player | Current Focus | Expansion Path |
|--------|--------------|----------------|
| **Anthropic / Claude Code** | Agent platform | Could build a first-party skill marketplace and management UI |
| **OpenAI / Codex** | Agent platform | Already has `$skill-installer` and `$skill-creator`; could build registry |
| **Cursor** | IDE | Could add skill management UI to Settings > Rules |
| **SkillsMP / agentskill.sh** | Discovery only | Could add sync, security, evaluation |
| **SkillScan.dev / Cisco scanner** | Security only | Could build a trusted registry around their scanning |

### Substitute Solutions

How people solve the problem without a dedicated tool today.

| Substitute | How | Limitation |
|-----------|-----|------------|
| **Manual file management** | Copy SKILL.md files between directories | Error-prone, no dedup, no updates |
| **Symlinks** | `ln -s` across agent directories | Breaks on some filesystems, no versioning |
| **Git submodules** | Track skill repos as submodules | Complex, no per-agent adaptation |
| **Dotfiles managers** (stow, chezmoi) | Sync config files including skills | Not skill-aware, no security scanning |
| **Do nothing** | Use only built-in skills | Misses community innovation |

---

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

---

## Feature Comparison Matrix

Rating scale: **Strong** (market-leading), **Adequate** (functional but not differentiated), **Weak** (exists but limited), **Absent** (not available).

### Discovery & Installation

*Why it matters: Users need to find the right skill among thousands, trust it, and get it running.*

| Capability | skillshare | SkillKit | SkillHub | Tessl | Marketplaces |
|-----------|-----------|---------|---------|-------|-------------|
| Search across sources | Weak (GitHub + hub) | Adequate (15k marketplace) | Strong (semantic search) | Adequate (curated registry) | Adequate (per-site only) |
| Cross-directory dedup | Absent | Absent | Absent | Absent | Absent |
| Install from any source | Adequate (GitHub) | Strong (multi-format) | Adequate | Adequate | Absent (browse only) |
| Auto-detect installed agents | Strong | Strong | Adequate | Adequate | Absent |
| One-command install | Strong | Strong | Strong | Strong | Absent |

### Sync & Scope Management

*Why it matters: Users have 3–6 agent directories and need skills consistent across them, with project-level control.*

| Capability | skillshare | SkillKit | SkillHub | Tessl |
|-----------|-----------|---------|---------|-------|
| Cross-tool sync | Strong (49+ agents) | Strong (44 agents) | Adequate (8+) | Adequate (4) |
| Bidirectional sync | Strong (`collect`) | Absent | Absent | Absent |
| Project-scoped skills | Strong (`.skillshare/`) | Adequate | Absent | Absent |
| Org-level skills | Strong (tracked repos) | Absent | Adequate (stacks) | Adequate (tiles) |
| Enable/disable per scope | Absent | Absent | Absent | Absent |
| Precedence visualization | Absent | Absent | Absent | Absent |
| Cross-machine sync | Strong (git push/pull) | Absent | Absent | Absent |

### Quality & Trust

*Why it matters: 26% of marketplace skills contain vulnerabilities. Users have no way to know if a skill is safe, effective, or maintained.*

| Capability | skillshare | SkillKit | AgentSkillsHub | Tessl | SkillScan |
|-----------|-----------|---------|---------------|-------|-----------|
| Security scanning | Adequate (built-in) | Strong (46 threats) | Strong (A–F grading) | Absent | Strong (free SaaS) |
| Performance benchmarks | Absent | Absent | Absent | Strong (1.8–3.3x) | Absent |
| Community ratings | Absent | Absent | Weak (heat score) | Absent | Absent |
| Provenance tracking | Absent | Absent | Absent | Absent | Absent |
| Version pinning | Absent | Absent | Absent | Weak | Absent |
| Dependency detection | Absent | Absent | Absent | Absent | Absent |

### Authoring & Development

*Why it matters: Agents create skills incorrectly 50%+ of the time. Testing skills against multiple models is manual.*

| Capability | skillshare | SkillKit | build-skill | Codex built-ins |
|-----------|-----------|---------|------------|----------------|
| Scaffold new skill | Strong (`new`) | Adequate | Strong | Strong |
| Validate SKILL.md format | Absent | Absent | Absent | Absent |
| Test against models | Absent | Absent | Absent | Absent |
| Preview before publish | Absent | Absent | Absent | Absent |
| Web UI for management | Strong (dashboard) | Absent | Absent | Absent |

---

## Positioning Analysis

### skillshare
**For** developers who use multiple AI coding agents **who** need their skills consistent everywhere, **skillshare** is a **sync tool** that **keeps one source of truth for skills across 49+ agents**. Unlike SkillKit or manual symlinks, skillshare uses **declarative config, bidirectional sync, and zero runtime dependencies**.

- **Category claim:** Sync tool
- **Differentiator:** Privacy-first, declarative, Go binary
- **Value proposition:** "One command, everywhere"
- **Vulnerability:** No quality layer — syncing bad skills everywhere is still bad

### SkillKit
**For** developers building with AI agents **who** want a complete skill ecosystem, **SkillKit** is a **package manager** that **installs, translates, and syncs skills across 44 agents**. Unlike skillshare, SkillKit offers **auto-format translation, a 15k marketplace, and session intelligence**.

- **Category claim:** Package manager / agent enablement platform
- **Differentiator:** Format translation, session memory, mesh networking
- **Value proposition:** "Write once, deploy across 44 agents"
- **Vulnerability:** Scope creep — session intelligence and mesh networking dilute the core value

### Tessl
**For** engineering teams **who** need measurable agent performance, **Tessl** is a **skills platform** that **evaluates and versions skills with real benchmarks**. Unlike open-source tools, Tessl provides **conformance reviews and task evaluations proving 1.8–3.3x improvement**.

- **Category claim:** Agent enablement platform (enterprise)
- **Differentiator:** Benchmarked evaluation with measurable performance gains
- **Value proposition:** "Skills are software and need a lifecycle"
- **Vulnerability:** Proprietary, limited agent support, no community ecosystem

### SkillHub
**For** developers who want a visual way to manage skills, **SkillHub** is a **desktop app** that **discovers, installs, and syncs skills with one click**. Unlike CLI-only tools, SkillHub provides **a desktop app, web marketplace, and skill stacks**.

- **Category claim:** Visual skill management
- **Differentiator:** Best UX (desktop app + marketplace + stacks)
- **Value proposition:** "Manage AI skills across all your tools"
- **Vulnerability:** Fewer agents, no security scanning, closed-source app

### Positioning Gaps (Unclaimed)

| Position | Why unclaimed | Opportunity |
|----------|-------------|-------------|
| **"The npm for agent skills"** | SkillKit claims it but lacks versioning, lockfiles, dependency resolution | First to deliver real package management wins this |
| **"Trusted skills"** | AgentSkillsHub scans 458 skills; 200k+ unaudited | Combine scanning + ratings + provenance at scale |
| **"Skills that actually work"** | Only Tessl benchmarks; proprietary | Open benchmark database per skill per model |
| **"What's active and why?"** | No tool visualizes skill precedence across scopes | Scope management UI with conflict detection |

---

## Market Trends

### 1. Agent Skills as an open standard is winning

**What:** The SKILL.md format (agentskills.io) is now supported by Claude Code, Codex, Cursor, Copilot, Gemini, and 40+ other tools.
**Why now:** Anthropic released it as open standard; OpenAI and others adopted it to avoid fragmentation.
**Timeline:** Happened (2025). Adoption accelerating.
**Implication:** Build on the standard, not against it. Management tools must be format-native.

### 2. Skill counts are exploding but quality is not

**What:** From 0 to 240k+ indexed skills in under a year. 26% contain vulnerabilities.
**Why now:** Low barrier to create (it's just markdown). GitHub scrapers inflate counts.
**Timeline:** Now. Will get worse as AI generates more skills.
**Implication:** Trust and quality become the primary differentiator, not quantity.

### 3. AGENTS.md competes with skills for conventions

**What:** Vercel showed AGENTS.md beats skills 94% vs 78% for formatting reliability.
**Why now:** Skills load asynchronously; AGENTS.md is always in context.
**Timeline:** Now. Skills and AGENTS.md will likely converge.
**Implication:** Don't treat skills as the only solution. The bridge between AGENTS.md and skills is an opportunity.

### 4. Security is the emerging blocker

**What:** Research proves trivial prompt injection via skills. "Don't ask again" approvals carry over.
**Why now:** Skills gained broad access to filesystems and APIs. Supply chain risk is real.
**Timeline:** Now, accelerating as skills from untrusted sources proliferate.
**Implication:** Security scanning is table stakes, but trust needs to go beyond scanning to provenance and community review.

### 5. Fragmentation is creating tool fatigue

**What:** 5+ sync tools, 8+ marketplaces, 5+ security scanners — all with different configs.
**Why now:** Low barrier to build tools on top of SKILL.md. Each solves one slice.
**Timeline:** Peak fragmentation now. Consolidation expected in 12–18 months.
**Implication:** The tool that consolidates the best parts wins. Integration > invention.

### 6. Enterprise adoption is starting

**What:** Tessl is the first commercial player. Claude Code added enterprise managed settings.
**Why now:** Companies with large repos and multiple teams hit skill sprawl first.
**Timeline:** Early 2026. Enterprise features will drive roadmaps in 2026–2027.
**Implication:** Team/org features (shared collections, governance, audit trails) become differentiators.

---

## Strategic Implications

### Where to compete

The positioning map shows the center is empty — **no tool combines discovery, trust, sync, and scope management**. The winning strategy is not to out-feature any single competitor but to integrate the full lifecycle.

### What to build vs. integrate

| Capability | Build | Integrate | Rationale |
|-----------|-------|-----------|-----------|
| Scope management UI | Build | — | No one does this. Highest differentiation. |
| Provenance tracking | Build | — | No one does this. Enables trust chain. |
| Cross-directory dedup | Build | — | Core value proposition. |
| Security scanning | — | Integrate (SkillScan, Cisco, or own rules) | Multiple good scanners exist. Don't reinvent. |
| Skill sync | — | Integrate (symlink strategy from skillshare) | Proven approach, low risk. |
| Marketplace search | — | Aggregate (query multiple sources) | No need to build another scraper. |
| Benchmarks | Build (open format) | Integrate (SkillsBench) | Open benchmark DB is the gap. |
| Authoring | — | Integrate (build-skill, skills-ref) | Good tools exist. |

### Competitive moats

1. **Network effects from quality data** — ratings, benchmarks, and provenance are worth more with scale. First mover with an open quality database creates a defensible position.
2. **Standard compliance** — build on agentskills.io, not a proprietary format. Portability is what users want.
3. **Trust chain** — provenance (source → author → review → install) is the one thing no competitor has. It's also the hardest to retrofit.

## Next Steps

- Define system architecture in `docs/architecture.md`
