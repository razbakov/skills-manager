# Plan: Skills Manager — Extend Manifest with env + install

## Context

Skills Manager exports collections as v3 JSON manifests (`repoUrl` + `skillPath`). To support server-side deployment via Chat-with-Project, the manifest needs to carry two additional pieces of information per skill:
- **env requirements** — what env vars the skill needs at runtime
- **install script** — what shell command to run when deploying the skill

These come from the SKILL.md `metadata` field (per the [Agent Skills spec](https://agentskills.io/specification)), so no spec changes are needed.

## SKILL.md Convention

```yaml
---
name: jira-integration
description: Manage Jira tickets from chat
compatibility: Requires network access and jira-cli
metadata:
  author: razbakov
  version: "1.0"
  install: "npm install -g jira-cli"
  env:
    JIRA_API_TOKEN: "Jira API token for authentication (required)"
    JIRA_BASE_URL: "Jira instance URL, e.g. https://company.atlassian.net (required)"
    JIRA_PROJECT_KEY: "Default project key (optional)"
---
```

- `metadata.install` — shell command to run when deploying the skill
- `metadata.env` — map of env var name → description

## Changes

### 1. Add types

**File**: `src/types.ts`

```typescript
export interface SkillEnvRequirement {
  name: string;
  description: string;
}
```

### 2. Parse metadata.env and metadata.install from SKILL.md

**File**: `src/scanner.ts`

`gray-matter` already parses full YAML frontmatter. Extract from parsed data:
- `metadata.env` (object map) → convert to array of `{name, description}`
- `metadata.install` (string) → pass through as-is

### 3. Extend v3 manifest

**File**: `src/export.ts`

```typescript
export interface InstalledSkillExport {
  name: string;
  description: string;
  install: SkillInstallExport;       // repoUrl + skillPath (existing)
  env?: SkillEnvRequirement[];       // NEW: from metadata.env
  installScript?: string;            // NEW: from metadata.install
}
```

Populate `env` and `installScript` from parsed SKILL.md when building the manifest.

## Files to Modify

| File | Change |
|------|--------|
| `src/types.ts` | Add `SkillEnvRequirement` type |
| `src/scanner.ts` | Parse `metadata.env` and `metadata.install` from frontmatter |
| `src/export.ts` | Add `env` and `installScript` to `InstalledSkillExport` |

## Verification

1. Create a test SKILL.md with `metadata.env` and `metadata.install`
2. Run scanner → confirm env requirements and install script are parsed
3. Export collection → confirm manifest JSON includes `env` and `installScript` fields
