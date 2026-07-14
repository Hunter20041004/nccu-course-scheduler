# Sunbreak Course Planner Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved Sunbreak redesign, course-driven customizable eligibility conditions, and removal of redundant quick presets without changing `main`.

**Architecture:** Add a pure eligibility-condition module that normalizes legacy requirements, builds definitions and impact explanations, and validates custom facts. Migrate persisted state to version 4, then replace the vertical dreamcore page with a compact two-pane workbench whose right side hosts courses, AI, conditions, internship, and import/add flows. Keep the dependency-free HTML/CSS/ES-module build and verify the real bundled worker through Playwright CLI.

**Tech Stack:** Node.js 22, native ES modules, HTML, CSS, Node test runner, Playwright CLI, local HTTP worker.

## Global Constraints

- Work only on `feature/sunbreak-redesign`; do not merge `main`.
- Use strict vertical Red → Green → Refactor; one failing test before each production behavior.
- Preserve scheduling, locking, deletion, internship, activity, screenshot import, and Groq recommendation flows.
- Never expose or commit the Groq secret.
- Add no frontend framework or runtime dependency.
- No mint green, sky blue, glassmorphism, oversized hero, emoji controls, or panel radius over 16px.
- Show at least ten candidate rows at 1440×900; interactive targets are at least 44px.
- Every non-eligible status exposes a textual reason.
- Final verification uses a real local server, Playwright CLI, four viewports, keyboard navigation, and reduced motion.

---

### Task 1: Normalize course-driven conditions

**Files:**
- Create: `src/eligibility-conditions.mjs`
- Create: `tests/eligibility-conditions.test.mjs`
- Modify: `scripts/build.mjs`
- Modify: `package.json`

**Interfaces:**
- `profileConditionIds(profile) -> string[]`
- `rulesForCourse(course) -> EligibilityRule[]`
- `buildConditionDefinitions(courses, customConditions) -> ConditionDefinition[]`

- [ ] Write one failing test: legacy `programs: ['innovation']` and `prerequisites: ['statistics']` normalize to `program:innovation` and `prerequisite:statistics`.
- [ ] Run `node --test tests/eligibility-conditions.test.mjs`; confirm failure is the missing module/export.
- [ ] Implement only `profileConditionIds`; rerun and confirm green.
- [ ] Write one failing test for legacy course rule normalization.
- [ ] Implement only `rulesForCourse`; rerun and confirm green.
- [ ] Write one failing test that course-derived definitions precede unique custom definitions with human labels.
- [ ] Implement only `buildConditionDefinitions`; rerun and refactor duplicate normalization while green.
- [ ] Register the module in build/unit scripts; run `npm test`.
- [ ] Commit: `feat: normalize course eligibility conditions`.

### Task 2: Explain impacts and evaluate generalized rules

**Files:**
- Modify: `src/eligibility-conditions.mjs`
- Modify: `src/planner-core.mjs`
- Modify: `tests/eligibility-conditions.test.mjs`
- Modify: `tests/planner-core.test.mjs`
- Modify: `scripts/build.mjs`

**Interfaces:**
- `buildConditionImpacts(courses, definitions, profile) -> ConditionImpact[]`
- `evaluateEligibility(course, profile)` consumes generalized IDs and remains backward compatible.

- [ ] Write one failing test: an unchecked required condition reports `沒有時無法直接加入`, the affected course, and the rationale.
- [ ] Run the focused test and confirm the impact builder is missing.
- [ ] Implement the smallest impact builder; rerun and refactor wording while green.
- [ ] Write one failing test: a missing explicit `review` rule returns `conditional` with its rationale.
- [ ] Implement generalized rule evaluation; run planner-core tests.
- [ ] Write one failing test: a selected custom condition makes an explicit required-rule course eligible.
- [ ] Implement the minimum selection lookup; run focused then full tests.
- [ ] Commit: `feat: explain eligibility condition impacts`.

### Task 3: Migrate saved state to version 4

**Files:**
- Modify: `src/planner-storage.mjs`
- Modify: `tests/planner-storage.test.mjs`

**Interfaces:**
- `serializePlannerState(state)` emits version 4.
- `parsePlannerState(raw, fallback)` migrates version 3 and preserves all other state.

- [ ] Write one failing migration test using a full version-3 state with selections, locks, custom courses, deletions, options, imports, internship settings, programs, and prerequisites.
- [ ] Run `node --test tests/planner-storage.test.mjs`; confirm the migration assertion fails.
- [ ] Implement only v3 profile migration and preserve all other properties; rerun.
- [ ] Write one failing version-4 round-trip test.
- [ ] Bump serialization to version 4; rerun focused and full tests.
- [ ] Refactor migration helpers while green.
- [ ] Commit: `feat: migrate planner conditions to storage v4`.

### Task 4: Build the customizable condition workspace

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `src/eligibility-conditions.mjs`
- Modify: `tests/eligibility-conditions.test.mjs`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `scripts/build.mjs`

**Interfaces:**
- UI consumes definition/impact builders.
- Saved state adds `customConditions` and `profile.conditionIds`.

- [ ] Write one failing rendered-flow test for `condition-list`, custom condition fields, toggling/deletion event delegation, and absence of fixed innovation/statistics checkbox IDs.
- [ ] Build and run rendered tests; confirm RED.
- [ ] Implement degree/year controls and the minimum rendered condition list with reason, affected count, and consequences; confirm GREEN.
- [ ] Write one failing pure test for empty and duplicate custom condition validation.
- [ ] Implement `validateCustomCondition`; confirm GREEN.
- [ ] Write one failing rendered-flow test for adding a valid custom condition and persisting it.
- [ ] Wire the form and save state; confirm GREEN.
- [ ] Write one failing rendered-flow test for deleting a custom condition.
- [ ] Implement delegated deletion and profile cleanup; confirm GREEN.
- [ ] Run `npm test`; commit `feat: add customizable eligibility workspace`.

### Task 5: Remove presets and create the two-pane workbench

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Workspace tabs: `catalog`, `ai`, `conditions`, `internship`, `add`.
- Compact-screen view switch: `schedule`, `tools`.

- [ ] Write one failing rendered test asserting preset markup/listeners are absent, workspace tabs/panels exist, and schedule precedes tools.
- [ ] Build/run and confirm RED on the current preset UI.
- [ ] Remove quick presets and relocate existing forms into labeled panels; confirm GREEN.
- [ ] Write one failing test for workspace tab selected/hidden/ARIA behavior.
- [ ] Implement delegated tab switching; confirm GREEN.
- [ ] Write one failing test for compact-screen schedule/tool switching.
- [ ] Implement the view switch; confirm GREEN.
- [ ] Run `npm test`; commit `feat: reorganize planner into a two-pane workspace`.

### Task 6: Apply the Sunbreak system and compact course index

**Files:**
- Modify: `src/styles.css`
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Candidate rows expose selected, locked, eligibility, and placement-highlight state through semantic classes/data attributes.

- [ ] Write one failing visual-contract test for semantic tokens, workbench sizing, 44px controls, focus-visible/reduced-motion rules, and absence of backdrop blur, dream/weather markup, oversized hero, and radii over 16px.
- [ ] Build/run and confirm RED on dreamcore CSS.
- [ ] Replace the shell/CSS with neutral violet-white, royal blue, iris violet, amber, flat rules, 4px spacing, serif identity, and sans operational type; confirm GREEN.
- [ ] Write one failing test for compact candidate rows with persistent `詳細`, `鎖定`, and `刪除` controls.
- [ ] Implement row markup and semantic states; confirm GREEN.
- [ ] Write one failing test for timed course-placement feedback.
- [ ] Implement a 180–220ms destination highlight with reduced-motion fallback; confirm GREEN.
- [ ] Run `npm test`; commit `feat: apply the Sunbreak planner interface`.

### Task 7: Turn AI results into strategy routes

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Exactly three apply actions remain; preview is non-mutating.

- [ ] Write one failing rendered test for route metadata, locked-course carryover, `預覽`, compact weekday visualization, and separate `套用方案`.
- [ ] Build/run and confirm RED.
- [ ] Implement route preview markup and delegated preview toggling without assigning `selected`; confirm GREEN.
- [ ] Run AI-focused tests, refactor preview helpers while green, then run `npm test`.
- [ ] Commit: `feat: show AI recommendations as strategy routes`.

### Task 8: Real-browser contract and final verification

**Files:**
- Create: `tests/browser/sunbreak-critical-flows.md`
- Modify defects only through a fresh focused Red → Green → Refactor cycle.

- [ ] Start `npm run dev` and open `http://127.0.0.1:4173/` with Playwright CLI.
- [ ] Verify candidate add/remove, details, lock/unlock, delete/cancel, clear, workspace tabs, add/toggle/delete condition, eligibility changes, internship modes, Sunday activity conflict, missing screenshot error, AI boundary behavior, and reload persistence.
- [ ] Verify 1440×900, 1024×768, 768×1024, and 375×812; keyboard navigation; reduced motion; no body overflow; at least ten desktop rows.
- [ ] Inspect Playwright console and requests for uncaught errors or failed local resources.
- [ ] Record evidence and any expected external failures in the browser contract document.
- [ ] Run `npm test`, `npm run lint`, `npm run test:contract:nccu`, `git diff --check`, and `git status --short`.
- [ ] Commit: `test: verify Sunbreak planner critical flows`.
