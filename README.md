# Skills Manager

A tool for managing AI agent skills across personal, organization, and project collections.

## Problem

AI coding agents rely on skill files to extend their capabilities, but managing these skills is painful:

- **Naming collisions** — Multiple skills share similar names or overlap in responsibility, making it hard to pick the right one.
- **No development workflow** — No way to test, enable, or disable skills without editing files by hand.
- **Unknown provenance** — No visibility into where a skill came from, who wrote it, or how to update it.
- **Scattered collections** — Skills live in different locations with no unified view across personal, org, and project scopes.
- **No quality signals** — No ratings, benchmarks, or reviews to judge whether a skill is secure, efficient, or follows best practices.

## Key Features

- **[Skill Registry](docs/registry.md)**: Search, browse, and install skills from a shared catalog with deduplication and conflict detection.
- **[Scope Management](docs/scopes.md)**: Enable or disable skills at three levels — personal, organization, and project — with clear precedence rules.
- **[Provenance Tracking](docs/provenance.md)**: Every skill records its source, author, version, and update channel.
- **[Quality Scores](docs/quality.md)**: Community and automated ratings for security, efficiency, and best practices, with benchmarks across models and harnesses.
- **[Development Mode](docs/dev-mode.md)**: GUI/TUI for authoring, testing, and previewing skills before publishing.

## Next Steps

- Draft system architecture in `docs/architecture.md`
