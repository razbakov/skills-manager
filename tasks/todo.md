# TODO

- [x] Add failing tests for source update metadata/validation behavior
- [x] Refactor snapshot repo status collection to avoid network fetch side effects
- [x] Track explicit source update timestamp from successful pull
- [x] Restrict update IPC to configured source paths only
- [x] Optimize scan cache loading to once-per-snapshot
- [x] Run focused test suite and document review results

## Review
- Added `src/source-sync.test.ts` first, confirmed red state:
  missing module error for `./source-sync`.
- Implemented `src/source-sync.ts` and wired `src/electron/main.ts` to remove
  implicit `git fetch` from snapshot/personal repo status checks.
- Added source path validation in update IPC before running pull.
- Persisted explicit last-updated timestamp only after successful source update.
- Verification commands:
  - `bun test src/source-sync.test.ts` (pass)
  - `bun test src/scanner.test.ts src/config.test.ts src/source-url.test.ts src/collection-sync.test.ts` (pass)
  - `bun x tsc --noEmit` (fails due pre-existing workspace errors outside this fix
    scope, including `src/actions.ts`, `src/feedback-report.ts`, and renderer type
    resolution issues)
