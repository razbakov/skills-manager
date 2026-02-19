# Feature Backlog

Prioritized feature backlog for the Skills Manager, with traceability to documented problems and competitive gaps.

## Prioritization Method

**ICE Score** = Impact × Confidence × Ease (each 1–10, score out of 1000).

- **Impact**: How much does this move the needle for users? Weighted by problem severity and frequency from the [severity matrix](problems.md).
- **Confidence**: How sure are we about the impact? Higher when backed by user complaints, research, or competitive evidence.
- **Ease**: How feasible is this to build in the near term? Higher for smaller scope and fewer dependencies.

---

## Backlog Summary

| # | Feature | ICE | Problems Solved | Horizon |
|---|---------|-----|-----------------|---------|
| 1 | Cross-directory skill scanner | 720 | P1, P5, P8 | Now |
| 2 | Deduplication engine | 648 | P1, P5, P9 | Now |
| 3 | Skill validation & linting | 630 | P4, P12 | Now |
| 4 | Precedence & scope visualization | 576 | P1, P8, P9 | Now |
| 5 | Security scanning integration | 560 | P13, P14 | Now |
| 6 | Scope management (enable/disable) | 504 | P1, P5, P9 | Next |
| 7 | Provenance tracking | 480 | P6, P14 | Next |
| 8 | Activation diagnostics | 480 | P2, P3 | Next |
| 9 | Skill scaffolding with validation | 432 | P4, P12 | Next |
| 10 | Context budget dashboard | 392 | P5, P1 | Next |
| 11 | Version pinning & lockfiles | 378 | P6, P11 | Next |
| 12 | Cross-tool sync | 360 | P8 | Next |
| 13 | Unified marketplace search | 336 | P8, P14 | Later |
| 14 | Quality & trust scores | 320 | P14, P13 | Later |
| 15 | AGENTS.md ↔ skills bridge | 288 | P10 | Later |
| 16 | Dependency declaration & resolution | 252 | P7, P11 | Later |
| 17 | Open benchmark database | 240 | P14, P10 | Later |
| 18 | Skill composition framework | 168 | P7, P5 | Later |

---

## Problem Traceability Matrix

Which features address which problems. Read across a row to see all features that solve a problem; read down a column to see all problems a feature solves.

| Problem | Scanner | Dedup | Validate | Precedence | Security | Scope Mgmt | Provenance | Activation Dx | Scaffold | Budget | Versioning | Sync | Search | Quality | Bridge | Deps | Benchmarks | Composition |
|---------|:-------:|:-----:|:--------:|:----------:|:--------:|:----------:|:----------:|:-------------:|:--------:|:------:|:----------:|:----:|:------:|:-------:|:------:|:----:|:----------:|:-----------:|
| P1 Duplicate loading | ● | ● | | ● | | ● | | | | ● | | | | | | | | |
| P2 Skills not activating | | | | | | | | ● | | | | | | | | | | |
| P3 Context ignoring | | | | | | | | ● | | | | | | | | | | |
| P4 Skill parsing errors | | | ● | | | | | | ● | | | | | | | | | |
| P5 Context overflow | ● | ● | | | | ● | | | | ● | | | | | | | | ● |
| P6 Version conflicts | | | | | | | ● | | | | ● | | | | | | | |
| P7 Composition bloat | | | | | | | | | | | | | | | | ● | | ● |
| P8 Fragmented paths | ● | | | ● | | | | | | | | ● | ● | | | | | |
| P9 Name conflicts | | ● | | ● | | ● | | | | | | | | | | | | |
| P10 Skills < AGENTS.md | | | | | | | | | | | | | | | ● | | ● | |
| P11 Dependency mismatch | | | | | | | | | | | ● | | | | | ● | | |
| P12 Skills created wrong | | | ● | | | | | | ● | | | | | | | | | |
| P13 Security / injection | | | | | ● | | | | | | | | | ● | | | | |
| P14 No quality signals | | | | | ● | | ● | | | | | | ● | ● | | | ● | |

---

## Feature Details

### Now — Build first (committed)

#### 1. Cross-Directory Skill Scanner

Scan all known agent skill directories, build a unified in-memory index of every installed skill with its location, metadata, and status.

| | |
|---|---|
| **ICE** | Impact 9 × Confidence 10 × Ease 8 = **720** |
| **Problems** | P1 (duplicate loading), P5 (context overflow), P8 (fragmented paths) |
| **Competitive gap** | No tool provides a unified view across all agent directories |
| **Output** | JSON index: skill name → list of {path, agent, frontmatter, hash} |

**Why first:** This is the foundational data layer. Deduplication, precedence visualization, scope management, and the context budget dashboard all depend on knowing what's installed and where.

**Scope:**
- Detect all standard skill directories for Cursor, Codex, and Claude Code
- Parse SKILL.md frontmatter and body for each skill found
- Compute content hash per skill for dedup comparison
- Support custom directory paths via config
- Output structured index (JSON/YAML)

**What it does NOT do:** It does not modify, sync, or delete anything. Read-only scan.

---

#### 2. Deduplication Engine

Given the scanner's index, detect duplicate skills (same name, same content hash, or high content similarity) and recommend or execute resolution.

| | |
|---|---|
| **ICE** | Impact 9 × Confidence 9 × Ease 8 = **648** |
| **Problems** | P1 (duplicate loading — the #1 user complaint), P5 (context overflow), P9 (name conflicts) |
| **Competitive gap** | No tool does cross-directory deduplication |
| **Depends on** | #1 (scanner) |

**Scope:**
- Exact duplicates: same content hash across directories → safe to remove copies
- Name collisions: same skill name, different content → report diff, suggest merge
- Near-duplicates: high similarity (>90%) → flag for human review
- Resolution modes: report-only, interactive, auto (keep latest version)

---

#### 3. Skill Validation & Linting

Validate SKILL.md files against the agentskills.io spec. Catch the errors that cause silent failures.

| | |
|---|---|
| **ICE** | Impact 9 × Confidence 10 × Ease 7 = **630** |
| **Problems** | P4 (skill parsing errors), P12 (agents create skills incorrectly) |
| **Competitive gap** | No tool validates skill format (skills-ref has basic validation but isn't integrated into workflows) |

**Scope:**
- Required frontmatter: `name` and `description` present, correct types, within length limits
- Directory structure: SKILL.md in correct location, name matches directory name
- Body validation: token count estimate, warn if > 5000 tokens
- Special character detection: flag characters known to cause parsing errors (backtick content with `!`, etc.)
- Agent-specific checks: warn about features that only work on one agent (Claude's `context: fork`, Codex's `openai.yaml`)
- Output: structured report with severity levels (error, warning, info)

---

#### 4. Precedence & Scope Visualization

Show which skills are active in the current context, where they come from, and which take priority when names collide.

| | |
|---|---|
| **ICE** | Impact 8 × Confidence 9 × Ease 8 = **576** |
| **Problems** | P1 (duplicate loading), P8 (fragmented paths), P9 (name conflicts / precedence confusion) |
| **Competitive gap** | No tool visualizes skill precedence — listed as unclaimed position in competitive analysis |
| **Depends on** | #1 (scanner) |

**Scope:**
- Tree view: agent → scope (enterprise/personal/project) → skills, showing effective precedence
- Conflict highlighting: when two skills share a name, show which wins and which is shadowed
- Per-agent view: what each agent (Cursor, Codex, Claude Code) actually sees
- Filter by project directory to show project-specific skill context

---

#### 5. Security Scanning Integration

Integrate with existing security scanners to surface risk before a skill causes harm.

| | |
|---|---|
| **ICE** | Impact 10 × Confidence 8 × Ease 7 = **560** |
| **Problems** | P13 (security / prompt injection — rated Critical), P14 (no quality signals) |
| **Competitive gap** | Security scanning exists but is fragmented; no tool scans all local skills on install |
| **Depends on** | #1 (scanner) |

**Build vs. integrate decision:** Integrate. SkillScan.dev, Cisco skill-scanner, and skillshare's built-in audit provide proven detection. Build a thin adapter layer.

**Scope:**
- Scan on install: every new skill is scanned before activation
- Scan on demand: `scan` command for all installed skills
- Risk categories: prompt injection, data exfiltration, credential theft, supply chain
- Severity levels: critical (block install), high (warn), medium (note), low (info)
- Integrate SkillScan.dev API for remote scanning; fallback to local pattern matching
- Block list: known-malicious skill hashes

---

### Next — Build second (planned, 1–3 months)

#### 6. Scope Management (Enable/Disable)

Control which skills are active at each scope without deleting files.

| | |
|---|---|
| **ICE** | Impact 9 × Confidence 8 × Ease 7 = **504** |
| **Problems** | P1 (duplicate loading), P5 (context overflow), P9 (name conflicts) |
| **Depends on** | #1 (scanner), #4 (precedence visualization) |

**Scope:**
- Enable/disable per skill, per scope (personal, org, project)
- Config file (YAML/TOML) that agents can read to determine active skills
- Bulk operations: disable all skills from a directory, enable a curated set
- Dry-run mode: show what would change without applying

---

#### 7. Provenance Tracking

Record where every skill came from and how it got to the current state.

| | |
|---|---|
| **ICE** | Impact 8 × Confidence 8 × Ease 7.5 = **480** |
| **Problems** | P6 (version conflicts), P14 (no quality signals) |
| **Competitive gap** | No tool does provenance — listed as unclaimed competitive position |

**Scope:**
- On install: record source URL, author, version/commit, install date, installer tool
- On update: append to provenance log (old version → new version, when, why)
- On fork: track parent skill and divergence
- Storage: `.skills-manager/provenance.json` per project + global
- Query: "where did this skill come from?" → full history

---

#### 8. Activation Diagnostics

Debug why a skill isn't activating or is being ignored during multi-step tasks.

| | |
|---|---|
| **ICE** | Impact 8 × Confidence 8 × Ease 7.5 = **480** |
| **Problems** | P2 (skills not activating — high frequency, high impact), P3 (context ignoring) |

**Scope:**
- Check skill is in correct directory for the target agent
- Verify frontmatter is valid (run validator)
- Check skill isn't shadowed by a higher-precedence skill with the same name
- Estimate if skill would be excluded by context budget (Claude Code's 2% limit)
- Check for known agent bugs (backtick parsing in Claude Code, etc.)
- Output: checklist with pass/fail per check, suggested fixes

---

#### 9. Skill Scaffolding with Validation

Create properly structured skills with guardrails so the agent (or user) can't get the format wrong.

| | |
|---|---|
| **ICE** | Impact 8 × Confidence 9 × Ease 6 = **432** |
| **Problems** | P4 (parsing errors), P12 (agents create skills incorrectly) |
| **Build vs. integrate** | Integrate build-skill for scaffolding; add validation layer on top |

**Scope:**
- Interactive wizard: name, description, target agents, optional scripts
- Template library: common skill patterns (convention enforcer, workflow, tool wrapper)
- Auto-validation: run linter (#3) on generated skill before writing to disk
- Agent-specific adaptation: generate Claude Code extended frontmatter, Codex openai.yaml if targeted

---

#### 10. Context Budget Dashboard

Show how much of the context window skills consume and optimize for the limit.

| | |
|---|---|
| **ICE** | Impact 7 × Confidence 8 × Ease 7 = **392** |
| **Problems** | P5 (context overflow at scale), P1 (duplicate loading contributes to waste) |
| **Depends on** | #1 (scanner) |

**Scope:**
- Token count per skill (metadata + full body)
- Total budget usage vs. Claude Code's 2% limit (and estimated limits for other agents)
- Ranked list: heaviest skills first
- Recommendations: skills that could be trimmed, split, or moved to references/
- Simulation: "if I add this skill, what gets dropped?"

---

#### 11. Version Pinning & Lockfiles

Pin skill versions for reproducible environments across machines and CI.

| | |
|---|---|
| **ICE** | Impact 7 × Confidence 9 × Ease 6 = **378** |
| **Problems** | P6 (versioning and lock conflicts), P11 (dependency/environment mismatch) |
| **Competitive gap** | No tool supports lockfiles — listed as unclaimed position |

**Scope:**
- `skills.lock` file: skill name → pinned version (git commit hash or semver tag)
- `install` respects lockfile; `update` modifies it
- Drift detection: warn when installed skill differs from lockfile
- CI-friendly: `install --frozen` fails if lockfile doesn't match

---

#### 12. Cross-Tool Sync

Keep skills consistent across Cursor, Codex, and Claude Code directories.

| | |
|---|---|
| **ICE** | Impact 6 × Confidence 8 × Ease 7.5 = **360** |
| **Problems** | P8 (fragmented discovery paths) |
| **Build vs. integrate** | Integrate skillshare's symlink approach. Proven, low risk. |

**Scope:**
- Declarative config: source directory → target agent directories
- Sync modes: symlink (identical everywhere) or copy (allow local customization)
- Selective sync: choose which skills go to which agents
- Dry-run mode

---

### Later — Directional (3–6+ months)

#### 13. Unified Marketplace Search

Search across multiple skill marketplaces from one interface.

| | |
|---|---|
| **ICE** | Impact 8 × Confidence 7 × Ease 6 = **336** |
| **Problems** | P8 (fragmented discovery), P14 (no quality signals) |
| **Competitive gap** | Each marketplace is siloed; no unified search exists |

**Scope:**
- Aggregate results from SkillsMP, skills.sh, agentskill.sh, GitHub
- Deduplicate results (same skill indexed in multiple marketplaces)
- Show security status if available (from AgentSkillsHub, SkillScan)
- Sort by relevance, quality signals, recency

---

#### 14. Quality & Trust Scores

Community ratings plus automated quality analysis per skill.

| | |
|---|---|
| **ICE** | Impact 8 × Confidence 8 × Ease 5 = **320** |
| **Problems** | P14 (no quality signals), P13 (security) |
| **Competitive gap** | No tool has npm-like download counts + quality scores |

**Scope:**
- Automated scores: security scan result, token efficiency, spec compliance, maintenance (last update)
- Community signals: install count, thumbs up/down, text reviews
- Composite trust score: weighted combination of automated + community signals
- Requires backend service (this is the hard part)

---

#### 15. AGENTS.md ↔ Skills Bridge

Help users migrate conventions between AGENTS.md and skills format based on what works better for each use case.

| | |
|---|---|
| **ICE** | Impact 6 × Confidence 8 × Ease 6 = **288** |
| **Problems** | P10 (skills underperform AGENTS.md for conventions) |
| **Competitive gap** | No tool helps bridge these formats — listed as unclaimed |

**Scope:**
- Analyzer: classify skill content as "convention" (better in AGENTS.md) vs. "workflow" (better as skill)
- Extract: pull conventions from skills into AGENTS.md format
- Convert: turn AGENTS.md sections into skills for workflow content
- Recommendations: suggest optimal format per use case

---

#### 16. Dependency Declaration & Resolution

Declare what a skill needs (binaries, MCP servers, other skills) and resolve before activation.

| | |
|---|---|
| **ICE** | Impact 7 × Confidence 6 × Ease 6 = **252** |
| **Problems** | P7 (composition bloat), P11 (dependency/environment mismatch) |
| **Competitive gap** | No tool detects or resolves skill dependencies |

**Scope:**
- Dependency manifest in SKILL.md frontmatter: `requires: [skill-a, mcp-server-x]`
- Environment check: verify required binaries/runtimes are available
- Conflict detection: two skills requiring incompatible configurations
- Resolution strategy: install missing dependencies or warn

---

#### 17. Open Benchmark Database

Per-skill, per-model performance benchmarks that anyone can contribute to.

| | |
|---|---|
| **ICE** | Impact 8 × Confidence 6 × Ease 5 = **240** |
| **Problems** | P14 (no quality signals), P10 (skills underperform AGENTS.md) |
| **Competitive gap** | Only Tessl benchmarks (proprietary) and SkillsBench (research) — no open database |

**Scope:**
- Standardized test format: task description, expected outcome, evaluation criteria
- Results indexed by skill × model × harness
- Community contributions with verification
- Requires backend infrastructure

---

#### 18. Skill Composition Framework

Composable skills with defined inputs/outputs and orchestration that keeps intermediate results out of context.

| | |
|---|---|
| **ICE** | Impact 7 × Confidence 6 × Ease 4 = **168** |
| **Problems** | P7 (composition without bloat), P5 (context overflow) |

**Scope:**
- Skill interface: declared inputs and outputs in frontmatter
- Orchestrator: chain skills programmatically without passing all intermediate data through context
- Context-efficient: only final results enter the conversation
- Requires spec extension and agent cooperation — highest coordination cost

---

## Coverage Analysis

### Problems fully addressed

| Problem | Features | Coverage |
|---------|----------|----------|
| P1 Duplicate loading | Scanner + Dedup + Scope Mgmt + Budget | **Strong** — multiple layers of defense |
| P4 Skill parsing errors | Validation + Scaffolding | **Strong** — prevent and detect |
| P8 Fragmented paths | Scanner + Precedence + Sync + Search | **Strong** — unified view + sync |
| P12 Skills created wrong | Scaffolding + Validation | **Strong** — prevent at creation time |
| P13 Security / injection | Security scanning + Quality scores | **Strong** — scan + trust signals |
| P14 No quality signals | Security + Provenance + Quality + Benchmarks | **Strong** — four complementary features |

### Problems partially addressed

| Problem | Features | Gap |
|---------|----------|-----|
| P2 Skills not activating | Activation diagnostics | Diagnostics can identify the cause but can't fix agent bugs. Requires upstream agent fixes. |
| P3 Context ignoring | Activation diagnostics | Same limitation — detection only, root cause is in the agent runtime. |
| P5 Context overflow | Scanner + Dedup + Scope + Budget | Can reduce waste but can't change agent context limits. |
| P9 Name conflicts | Dedup + Precedence + Scope Mgmt | Detection and resolution available, but agents still lack built-in conflict handling. |
| P10 Skills < AGENTS.md | Bridge + Benchmarks | Can recommend the right format per use case, but can't change how agents load skills. |

### Problems requiring ecosystem cooperation

| Problem | Why | What we can do |
|---------|-----|----------------|
| P3 Context ignoring | Agent runtime behavior — model doesn't follow loaded instructions | File bugs upstream; activation diagnostics surfaces the issue |
| P6 Version conflicts | Agents don't read lockfiles natively | Provide lockfile; sync tool enforces pinned versions at install time |
| P7 Composition bloat | Requires agent support for streaming intermediate results outside context | Propose spec extension; composition framework provides the format |
| P11 Dependency mismatch | Local vs. remote environments differ in available binaries | Dependency declaration catches mismatches early; can't change remote environments |

---

## Competitive Differentiation

Features that no competitor offers today, creating potential moats:

| Feature | Why no one has it | Moat potential |
|---------|------------------|----------------|
| **Deduplication engine** (#2) | Requires scanning all directories + content hashing + similarity matching | Data advantage — gets better with more users |
| **Precedence visualization** (#4) | Requires deep understanding of each agent's precedence rules | Knowledge moat — complex to replicate correctly |
| **Provenance tracking** (#7) | Hardest to retrofit after the fact; must be built into install flow | First-mover — switching cost increases with history |
| **Activation diagnostics** (#8) | Requires knowing agent-specific bugs and behaviors | Expertise moat — accumulated knowledge of failure modes |
| **Open benchmark database** (#17) | Requires community + infrastructure + standardized test format | Network effects — value grows with contributors |

---

## Suggested Release Milestones

### v0.1 — "Know your skills" (Now)
Features: Scanner (#1) + Validation (#3)
Value: Users can see everything installed and catch format errors.

### v0.2 — "Clean house" (Now)
Features: Dedup (#2) + Precedence (#4)
Value: Eliminate duplicates, understand what's active and why.

### v0.3 — "Trust layer" (Now → Next)
Features: Security scanning (#5) + Provenance (#7)
Value: Know if skills are safe and where they came from.

### v0.4 — "Take control" (Next)
Features: Scope management (#6) + Budget dashboard (#10) + Activation diagnostics (#8)
Value: Fine-grained control over what's active, with debugging when things go wrong.

### v0.5 — "Reproducible" (Next)
Features: Version pinning (#11) + Sync (#12) + Scaffolding (#9)
Value: Consistent, reproducible skill environments across machines and agents.

### v1.0 — "Ecosystem" (Later)
Features: Marketplace search (#13) + Quality scores (#14) + Benchmarks (#17)
Value: Discover the right skill, trust it, and prove it works.
