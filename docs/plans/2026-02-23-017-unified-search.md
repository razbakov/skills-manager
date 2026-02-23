# 017 Unified Skills Library Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace split Installed/Available discovery with one unified Skills library that supports status/source filters and preserves full collection management inside the Skills tab.

**Architecture:** Keep backend snapshot contracts unchanged and implement unification entirely in renderer state/views. Add a new Skills view with an internal List/Collections mode switch, extend the store with unified query/filter/selection state, and rewire tab keyboard handling and jump-to-skill navigation to the new tab model.

**Tech Stack:** Vue 3 (Composition API), TypeScript, Vitest, Tailwind/Radix UI components

---

### Task 1: Story Status Transition (Start)

**Files:**
- Modify: `docs/issues/017-unified-search.md`

**Step 1: Mark story as active**

Set frontmatter `status` to `in-progress` before implementation.

**Step 2: Verify frontmatter update**

Run: `sed -n '1,20p' docs/issues/017-unified-search.md`
Expected: frontmatter shows `status: in-progress`.

### Task 2: Unified Search/Filter Utilities

**Files:**
- Modify: `src/electron-v2/src/composables/useSearch.ts`
- Test: `src/electron-v2/src/composables/__tests__/useSkillLibraryFilters.test.ts`

**Step 1: Add unified status model**

Add `LibraryStatusFilter` (`all|enabled|disabled|available`) and `getSkillLibraryStatus(skill)` mapping:
- installed + !disabled => enabled
- installed + disabled => disabled
- !installed => available

**Step 2: Add combined filter function**

Implement `filterSkillLibrary(skills, { query, status, sourceName })` that:
- uses existing fuzzy matching semantics
- applies status and source filters in conjunction
- preserves deterministic ordering/ranking

**Step 3: Add tests for status/filter intersections**

Create focused tests for:
- status mapping
- query+status+source intersections
- stable ordering

### Task 3: Store Refactor for Unified Skills Tab

**Files:**
- Modify: `src/electron-v2/src/composables/useSkills.ts`
- Modify: `src/electron-v2/src/types.ts`

**Step 1: Update tab model**

Change `TabId` to `skills|sources|recommendations|settings` and default active tab to `skills`.

**Step 2: Add unified state**

Add:
- `skillsViewMode: list|groups`
- `queries.skills`
- `libraryFilters.status`
- `libraryFilters.sourceName`
- `selected.skills`
- `librarySkills`, `librarySources`, `selectedSkill`
- `selectSkill(skillId)`

**Step 3: Keep collection workflow state intact**

Retain existing installed/group selection/query state for collection management mode and existing group components.

**Step 4: Rewire jump navigation**

Update `jumpToSkill` to always open `skills` tab in `list` mode and select the target skill.

### Task 4: New Unified Skills View

**Files:**
- Create: `src/electron-v2/src/views/SkillsView.vue`
- Modify: `src/electron-v2/src/views/InstalledView.vue` (only if needed for compatibility)

**Step 1: Build internal mode switch**

Implement a top switch between:
- `Skills` (combined list mode)
- `Collections` (existing installed folder/group mode)

**Step 2: Implement combined list panel**

Add search input + status/source filters + filtered count and list rows with status badges (`Enabled`, `Disabled`, `Available`).

**Step 3: Implement combined detail panel**

Route selected unified skill into `SkillDetail` and choose mode based on install state:
- installed => `installed`
- not installed => `available`

**Step 4: Embed existing collection management**

For `Collections` mode, render existing `InstalledView` to preserve group creation/toggle/edit/delete flows.

### Task 5: App Shell and Keyboard Wiring

**Files:**
- Modify: `src/electron-v2/src/App.vue`
- Modify: `src/electron-v2/src/composables/useKeyboard.ts`

**Step 1: Replace top-level tabs**

Swap `Installed` + `Available` with one `Skills` tab and update displayed counts.

**Step 2: Update active-list keyboard routing**

Route up/down selection and enter primary action through unified list in `skills/list` mode; keep installed behavior in `skills/groups` mode.

**Step 3: Remap shortcuts**

Use `Ctrl/Cmd+1..4` for `Skills`, `Sources`, `Recommend`, `Settings`.

### Task 6: Cross-View Jump Consistency

**Files:**
- Modify: `src/electron-v2/src/views/SourcesView.vue` (if needed)
- Modify: `src/electron-v2/src/views/RecommendationsView.vue` (if needed)
- Modify: `src/electron-v2/src/composables/useSkills.ts`

**Step 1: Preserve jump behavior**

Ensure existing `jumpToSkill` call sites continue to work without local view changes.

**Step 2: Verify target mode**

`jumpToSkill` should always land in `Skills` list mode with selected skill visible.

### Task 7: Verification

**Files:**
- Test: `src/electron-v2/src/composables/__tests__/useSearch.test.ts`
- Test: `src/electron-v2/src/composables/__tests__/useSkillLibraryFilters.test.ts`

**Step 1: Run required unit tests**

Run:
`bun x vitest src/electron-v2/src/composables/__tests__/useSearch.test.ts src/electron-v2/src/composables/__tests__/useSkillLibraryFilters.test.ts --run`

Expected: PASS for both files.

**Step 2: Manual behavior check list**

Validate:
- unified list includes installed+available
- status/source filters combine correctly
- count reflects filtered list
- detail actions map by status
- collections mode preserves existing group operations
- `Ctrl/Cmd+1..4` works

### Task 8: Story Status Transition (Finish)

**Files:**
- Modify: `docs/issues/017-unified-search.md`

**Step 1: Mark completed after verification**

Set frontmatter `status` to `completed` only after tests pass.

### Task 9: Commit Message Update

**Files:**
- Modify: `commit.txt`

**Step 1: Merge commit summary for all uncommitted changes**

Keep Conventional Commit format, imperative voice, concise summary, and `Refs: #017` footer.

**Step 2: Ensure message explains why**

Body should explain user-value rationale (single discovery flow + status clarity) rather than file-level change listing.
