# Sunbreak High-Impact Reliability and UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Sunbreak trustworthy enough for real student planning by correcting official-data semantics, enforcing canonical sections and deterministic plans, adding safe migration/recovery, and making the weekly schedule efficient on mobile.

**Architecture:** Add focused pure modules for official-note classification, plan validation, transfer, undo state, and agenda projection. Keep `app.mjs` as the browser orchestrator, but move all new decision logic into tested modules. Sites remains the canonical full product; GitHub Pages becomes a portfolio/share entry with explicit versioned transfer.

**Tech Stack:** Node.js 22 ESM, native `node:test`, vanilla HTML/CSS/JavaScript, Cloudflare/Sites Worker, browser `localStorage`, Chrome integration testing.

## Global Constraints

- Use Red → Green → Refactor vertically: one failing test, one minimal implementation, then refactor before the next behavior.
- Preserve the user’s current browser data; migrations must be idempotent and browser E2E must use an isolated test URL/state.
- Do not store or export Gemini API keys, screenshots, AI profile text, prompts, or raw provider errors.
- Preserve the NCCU official grid, Sunday, asynchronous workspace, wallpaper export, and rain-after-sunlight/light-dreamcore palette.
- Keep every primary mobile touch target at least 44×44px and avoid page-level horizontal overflow at 390px.
- Do not add runtime dependencies.
- Complete real NCCU and deployed-browser boundary tests; mock-only tests are insufficient.

---

### Task 1: Classify informational official notes without creating eligibility rules

**Files:**
- Create: `src/nccu-course-notes.mjs`
- Create: `tests/nccu-course-notes.test.mjs`
- Modify: `src/nccu-course-adapter.mjs`
- Modify: `tests/nccu-course-adapter.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `classifyOfficialNotes({ courseCode, restrictionText })`
- Produces: `{ eligibilityRules, scheduleNotes, deliveryNotes, examEvents, programTags, informationNotes }`
- Consumed by: `nccuCourseToCandidate()` and saved-state migration.

- [ ] **Step 1: Red — information-only note classification**

Add a test asserting that `英語授課。；傳播類課程；本課程為112/113級群C課程；日文系擴大輔系課程` produces no `eligibilityRules`, includes `英語授課` in `deliveryNotes`, and includes the remaining classification phrases in `programTags`.

Run: `node --test tests/nccu-course-notes.test.mjs`  
Expected: FAIL because the module does not exist.

- [ ] **Step 2: Green — minimal classifier**

Implement sentence splitting on `；。\n`, normalization, and explicit information patterns. Return stable arrays and preserve unmatched sentences in `informationNotes`.

Run: `node --test tests/nccu-course-notes.test.mjs`  
Expected: PASS.

- [ ] **Step 3: Red → Green — TAICA mixed note**

Add one failing test for the complete TAICA note. Implement classification so platform, remote delivery, scheduled exhibition/exam, and program mapping become separate typed notes rather than one checkbox.

Run: `node --test tests/nccu-course-notes.test.mjs`  
Expected after implementation: PASS.

- [ ] **Step 4: Integrate adapter**

Replace direct `eligibilityRuleFromOfficialRestriction()` use in `nccuCourseToCandidate()` with `classifyOfficialNotes()`. Preserve `conditions` as display-only official source text and add the typed arrays to the candidate.

Run: `node --test tests/nccu-course-adapter.test.mjs tests/nccu-course-notes.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Refactor and register test**

Add the new test file to `test:unit`, remove duplicated regex classification from the adapter, and run:

`npm run test:unit`  
Expected: all unit tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/nccu-course-notes.mjs src/nccu-course-adapter.mjs tests/nccu-course-notes.test.mjs tests/nccu-course-adapter.test.mjs package.json
git commit -m "fix: classify NCCU notes by meaning"
```

### Task 2: Model explicit eligibility as eligible, blocked, review, or unavailable

**Files:**
- Modify: `src/nccu-course-notes.mjs`
- Modify: `src/planner-core.mjs`
- Modify: `src/eligibility-conditions.mjs`
- Modify: `src/app.mjs`
- Modify: `tests/nccu-course-notes.test.mjs`
- Modify: `tests/planner-core.test.mjs`
- Modify: `tests/eligibility-conditions.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- `classifyOfficialNotes()` creates only explicit required/review rules.
- `evaluateEligibility(course, profile)` returns `eligible | blocked | review | unavailable`.

- [ ] **Step 1: Red → Green — explicit hard restrictions**

Add a failing test asserting `僅限歐文系及雙主修學生修讀` creates one required rule with a short student-facing label and preserved rationale. Implement the exact explicit-restriction patterns.

Run: `node --test tests/nccu-course-notes.test.mjs`  
Expected after implementation: PASS.

- [ ] **Step 2: Red → Green — unanswered required rule is review**

Add a failing `planner-core` test where a required official condition is not present in `profile.conditionIds`. Change evaluation to return `{ status: 'review' }` when the user has not answered it; add a negative-answer representation `rejectedConditionIds` that returns `blocked`.

Run: `node --test tests/planner-core.test.mjs`  
Expected after implementation: PASS.

- [ ] **Step 3: Red → Green — graduate conditional status migration**

Change existing graduate review tests to expect `review`, remove the obsolete `conditional` status, and update catalog labels to `資格待確認，請看詳細。`.

Run: `node --test tests/planner-core.test.mjs tests/rendered-html.test.mjs`  
Expected after implementation: PASS.

- [ ] **Step 4: Red → Green — condition controls**

Add a condition-model test that exposes `符合／不符合／尚未確認` for course-derived conditions. Update the conditions UI to store accepted and rejected IDs separately and show why each condition exists, affected courses, official rationale, and source type.

Run: `node --test tests/eligibility-conditions.test.mjs tests/rendered-html.test.mjs`  
Expected after implementation: PASS.

- [ ] **Step 5: Refactor and full regression**

Run: `npm run test:unit`  
Expected: PASS with no remaining `conditional` eligibility references.

- [ ] **Step 6: Commit**

```bash
git add src/nccu-course-notes.mjs src/planner-core.mjs src/eligibility-conditions.mjs src/app.mjs tests/nccu-course-notes.test.mjs tests/planner-core.test.mjs tests/eligibility-conditions.test.mjs tests/rendered-html.test.mjs
git commit -m "feat: add reviewable eligibility states"
```

### Task 3: Make course sections atomic and fix Artificial Intelligence Practice Project

**Files:**
- Modify: `src/course-data.mjs`
- Modify: `src/planner-core.mjs`
- Modify: `src/app.mjs`
- Modify: `tests/course-data.test.mjs`
- Modify: `tests/planner-core.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: `selectCourseSection(course, { sectionId, advisorId, arrangementId })`.
- Each section carries section code, teacher, credits, schedule/meetings, delivery mode, eligibility and syllabus URL.

- [ ] **Step 1: Red — Wei Ling-yin section identity**

Add a failing course-data test asserting section `783006001` is taught by `魏綾音`, has three credits, and exposes two arrangements: fixed `週二 34C` and flexible `另約討論時間`.

Run: `node --test tests/course-data.test.mjs`  
Expected: FAIL against the current split variant/advisor model.

- [ ] **Step 2: Green — atomic section data**

Normalize the built-in AI project to section objects. Keep legacy `variants` readable during migration, but make `sections` the source of truth.

Run: `node --test tests/course-data.test.mjs`  
Expected: PASS.

- [ ] **Step 3: Red → Green — atomic selection**

Add a core test that switches from another section to `783006001` and verifies course code, teacher, schedule, meetings, eligibility, source URL and option message change together. Implement `selectCourseSection()` and make `resolveCourseOption()` delegate to it.

Run: `node --test tests/planner-core.test.mjs`  
Expected after implementation: PASS.

- [ ] **Step 4: Red → Green — flexible arrangement**

Add a test selecting `另約討論時間`; expect no fixed physical meeting, `optionStatus: 'flexible'`, and a pending-time warning. Implement arrangement resolution without marking the course asynchronous.

Run: `node --test tests/planner-core.test.mjs`  
Expected after implementation: PASS.

- [ ] **Step 5: Integrate UI and refactor**

Update detailed-course controls to select formal section first, then arrangement/advisor. Ensure header metadata always derives from the resolved section. Add rendered assertions for both Wei arrangements.

Run: `node --test tests/course-data.test.mjs tests/planner-core.test.mjs tests/rendered-html.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/course-data.mjs src/planner-core.mjs src/app.mjs tests/course-data.test.mjs tests/planner-core.test.mjs tests/rendered-html.test.mjs
git commit -m "fix: keep NCCU section metadata atomic"
```

### Task 4: Add an authoritative deterministic plan validator

**Files:**
- Create: `src/plan-validator.mjs`
- Create: `tests/plan-validator.test.mjs`
- Modify: `src/internship-planner.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `validatePlan({ plan, courses, lockedCourseIds, profile, internshipSettings, minimumCredits, minimumInternshipDays })`.
- Returns `{ valid, courseIds, asyncCourseIds, credits, internship, violations, warnings }`.

- [ ] **Step 1: Red → Green — weekly and event conflicts**

Write one failing test for overlapping physical meetings, implement conflict rejection using `findConflicts()`, then add and satisfy a separate event-conflict test.

Run after each cycle: `node --test tests/plan-validator.test.mjs`.

- [ ] **Step 2: Red → Green — locked-course preservation**

Add one test where a plan omits a locked course. Implement canonical merging and a `missing-locked-course` violation if the course is unavailable from the candidate set.

- [ ] **Step 3: Red → Green — eligibility**

Add separate tests for `blocked`, `unavailable`, and `review`. Block the first two; keep `review` as a warning requiring user confirmation.

- [ ] **Step 4: Red → Green — asynchronous attendance**

Reject IDs in `asyncCourseIds` unless `asyncAllowed === true`; exclude legitimate async courses from weekly conflicts while retaining one-time events.

- [ ] **Step 5: Red → Green — credits and internship**

Add separate tests for requested minimum credits and minimum internship days. Use `calculateInternshipPlan()` with resolved physical meetings. Return machine-readable violation codes and Traditional Chinese explanations.

- [ ] **Step 6: Refactor and register test**

Keep validator deterministic and side-effect free. Add the test file to `test:unit`.

Run: `npm run test:unit`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/plan-validator.mjs src/internship-planner.mjs tests/plan-validator.test.mjs package.json
git commit -m "feat: validate every recommended schedule"
```

### Task 5: Allow only valid AI routes to be displayed or applied

**Files:**
- Modify: `src/ai-service.mjs`
- Modify: `src/ai-contracts.mjs`
- Modify: `src/ai-planner.mjs`
- Modify: `src/app.mjs`
- Modify: `tests/ai-service.test.mjs`
- Modify: `tests/ai-contracts.test.mjs`
- Modify: `tests/ai-planner.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `validatePlan()`.
- Produces recommendation results with `plans` containing only valid routes and `shortfallReason` when fewer than three distinct routes exist.

- [ ] **Step 1: Red → Green — no conflicting route cards**

Add a failing AI service test where all model routes conflict. Replace conflict-warning output with validator filtering; expect zero invalid plans and a shortfall explanation.

Run: `node --test tests/ai-service.test.mjs`  
Expected after implementation: PASS.

- [ ] **Step 2: Red → Green — minimum credits and async fill**

Retain existing minimum-credit tests, but assert every returned route is valid and meets the requested minimum when feasible. If infeasible, expect fewer plans and a factual reason rather than a low-credit route.

- [ ] **Step 3: Red → Green — internship hard requirement**

Add a request containing an explicit minimum internship day requirement. Ensure AI prompting includes it and deterministic validation filters routes that fail it.

- [ ] **Step 4: Red → Green — preview and apply guard**

Add browser-facing tests that invalid plans cannot render an enabled apply button. Revalidate in `applyRecommendedPlan()` so stale or tampered route data cannot bypass the rule.

- [ ] **Step 5: Refactor**

Remove duplicated local repair logic now covered by the validator, retaining language-preference ranking and maximum-credit construction only as candidate generation.

Run: `npm run test:unit`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ai-service.mjs src/ai-contracts.mjs src/ai-planner.mjs src/app.mjs tests/ai-service.test.mjs tests/ai-contracts.test.mjs tests/ai-planner.test.mjs tests/rendered-html.test.mjs
git commit -m "fix: show only feasible AI schedules"
```

### Task 6: Version planner storage and migrate existing data safely

**Files:**
- Modify: `src/planner-storage.mjs`
- Modify: `src/nccu-course-adapter.mjs`
- Modify: `tests/planner-storage.test.mjs`

**Interfaces:**
- Storage payload becomes version 5.
- Produces: `migratePlannerState(state)` and idempotent saved-course normalization.

- [ ] **Step 1: Red → Green — version-five round trip**

Update the version assertion to 5 and implement parsing for version 5 without changing state.

- [ ] **Step 2: Red → Green — note reclassification migration**

Add a saved course containing the existing giant TAICA required rule. Expect the rule removed from eligibility and typed notes preserved after startup normalization.

- [ ] **Step 3: Red → Green — section migration**

Add a legacy AI-project `variantId/advisorId` state. Migrate it to `selectedSectionId`, `selectedAdvisorId`, and arrangement without changing selected/locked IDs.

- [ ] **Step 4: Red → Green — idempotency**

Assert migrating a state twice is deep-equal to migrating once.

Run: `node --test tests/planner-storage.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planner-storage.mjs src/nccu-course-adapter.mjs tests/planner-storage.test.mjs
git commit -m "feat: migrate planner data to trusted schema"
```

### Task 7: Add secure JSON export, import preview, and cross-site migration

**Files:**
- Create: `src/planner-transfer.mjs`
- Create: `tests/planner-transfer.test.mjs`
- Modify: `src/app.mjs`
- Modify: `src/index.html`
- Modify: `src/styles.css`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `exportPlannerTransfer(state)`.
- Produces: `previewPlannerTransfer(raw, currentState)`.
- Produces: `applyPlannerTransfer(preview, currentState)`.

- [ ] **Step 1: Red → Green — safe export allowlist**

Test that planner data is exported with `{ format: 'sunbreak-planner', version: 1 }`, while API keys, profile text, screenshots, provider responses, and unknown fields are omitted.

- [ ] **Step 2: Red → Green — invalid import is non-mutating**

Test malformed JSON, wrong format, unsupported version, invalid IDs and non-array fields. Return a structured error without changing current state.

- [ ] **Step 3: Red → Green — import preview**

Test preview counts for added/replaced/skipped courses and settings. Implement explicit merge semantics: transferred planner data replaces planner state only after confirmation; API session remains untouched.

- [ ] **Step 4: Integrate UI**

Add `匯出排課資料` and `從舊版匯入` to the More menu and tutorial. Static Pages also shows `匯出並前往完整版`; the full site never shows self-referential Live Demo copy.

- [ ] **Step 5: Browser-safe download/upload**

Use Blob download and file input, revoke object URLs, announce preview/results through `aria-live`, and never write raw imported text to HTML.

Run: `npm test`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/planner-transfer.mjs src/app.mjs src/index.html src/styles.css tests/planner-transfer.test.mjs tests/rendered-html.test.mjs package.json
git commit -m "feat: transfer planner data between sites"
```

### Task 8: Make destructive actions undoable and lower their visual priority

**Files:**
- Create: `src/planner-undo.mjs`
- Create: `tests/planner-undo.test.mjs`
- Modify: `src/app.mjs`
- Modify: `src/index.html`
- Modify: `src/styles.css`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `createUndoSnapshot(kind, state, now)`.
- Produces: `restoreUndoSnapshot(snapshot, now, ttlMs = 15000)`.

- [ ] **Step 1: Red → Green — restore within 15 seconds**

Test schedule and candidate snapshots restore exact prior state before expiry and return null after expiry.

- [ ] **Step 2: Red → Green — a new destructive action replaces the old snapshot**

Test the controller holds only one snapshot and retains no API/session fields.

- [ ] **Step 3: Integrate More menu**

Move both clear actions into an accessible More menu. Keep confirmation, create snapshot before mutation, and show a 15-second live toast with `復原`.

- [ ] **Step 4: Refactor keyboard and motion behavior**

Close menu on Escape/outside click, restore focus to trigger, and respect reduced motion. Ensure toast text is readable without color.

Run: `npm test`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planner-undo.mjs src/app.mjs src/index.html src/styles.css tests/planner-undo.test.mjs tests/rendered-html.test.mjs package.json
git commit -m "feat: undo destructive planner actions"
```

### Task 9: Simplify candidate actions with an accessible overflow menu

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Main candidate surface continues toggling schedule membership.
- `詳細` remains visible.
- `課綱`, `鎖定/解鎖`, and `刪除` move into the course More menu.

- [ ] **Step 1: Red — action hierarchy markup**

Add rendered assertions that each candidate has a visible detailed-data button and a named More trigger, while syllabus/lock/delete controls live inside its menu.

Run: `node --test tests/rendered-html.test.mjs`  
Expected: FAIL.

- [ ] **Step 2: Green — menu rendering and delegation**

Implement a menu per active course using stable course IDs, event delegation, correct link safety, and existing lock/delete handlers.

- [ ] **Step 3: Red → Green — keyboard behavior**

Add static interaction hooks for Enter/Space, Escape and focus return. Ensure disabled syllabus remains understandable as `無課綱`.

- [ ] **Step 4: CSS refactor**

Keep candidate rows compact, avoid overlap at desktop/mobile widths, and preserve 44×44px controls.

Run: `npm test`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.mjs src/styles.css tests/rendered-html.test.mjs
git commit -m "refactor: simplify candidate course actions"
```

### Task 10: Add a mobile agenda view while preserving the NCCU grid

**Files:**
- Create: `src/schedule-agenda.mjs`
- Create: `tests/schedule-agenda.test.mjs`
- Modify: `src/app.mjs`
- Modify: `src/index.html`
- Modify: `src/styles.css`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildWeeklyAgenda({ selected, internshipPlan, dayLabels })`.
- Mobile view preference: `agenda | grid`, stored under a non-sensitive local preference key.

- [ ] **Step 1: Red → Green — agenda projection**

Test Monday–Sunday grouping, chronological sorting, locked/conflict metadata, internship blocks, and separation of async/flexible courses.

- [ ] **Step 2: Red → Green — empty days and Sunday**

Test that empty days are omitted from the compact agenda while Sunday events remain included.

- [ ] **Step 3: Integrate view switcher**

Add `行程／方格` segmented controls to the schedule panel. Agenda is the default at mobile breakpoints; desktop remains grid. Persist manual selection.

- [ ] **Step 4: Responsive CSS**

At 390px, prevent document-level horizontal overflow, set workspace tabs to at least 44px high, keep the grid’s intentional internal scroller, and ensure agenda cards wrap safely.

- [ ] **Step 5: Render regression**

Add assertions for accessible switcher state, agenda region labels, conflict text and non-color status markers.

Run: `npm test`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/schedule-agenda.mjs src/app.mjs src/index.html src/styles.css tests/schedule-agenda.test.mjs tests/rendered-html.test.mjs package.json
git commit -m "feat: add a mobile weekly agenda"
```

### Task 11: Clarify internship certainty, deployment copy, and structured errors

**Files:**
- Modify: `src/internship-planner.mjs`
- Modify: `src/worker.mjs`
- Modify: `src/app.mjs`
- Modify: `src/index.html`
- Modify: `tests/internship-planner.test.mjs`
- Modify: `tests/worker.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Internship result exposes `confirmedDays` and `pendingDays`.
- Worker errors expose `{ code, message, retryable, requestId }` with `Cache-Control: no-store`.

- [ ] **Step 1: Red → Green — confirmed versus pending internship days**

Add a failing test with one unresolved physical course. Return confirmed availability separately from potential availability and render `已確認 X 天＋待確認 Y 天`.

- [ ] **Step 2: Red → Green — structured worker errors**

Add tests for invalid key, rate limit, timeout and upstream failure. Generate a request ID, stable error code and retryable flag; omit provider bodies and secrets.

- [ ] **Step 3: Red → Green — retry-preserving UI**

Ensure retryable errors display a retry action without clearing AI form fields or planner state.

- [ ] **Step 4: Deployment-aware copy**

Use host detection so static Pages explains its role and full Sites contains no GitHub-to-Live-Demo self-reference. Update tutorial and API dialog consistently.

Run: `npm test`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/internship-planner.mjs src/worker.mjs src/app.mjs src/index.html tests/internship-planner.test.mjs tests/worker.test.mjs tests/rendered-html.test.mjs
git commit -m "fix: clarify uncertain and retryable states"
```

### Task 12: Verify real boundaries, browser flows, documentation, and deploy

**Files:**
- Modify: `tests/nccu-live-contract.test.mjs`
- Modify: `tests/browser/sunbreak-critical-flows.md`
- Modify: `README.md`
- Modify: `.openai/hosting.json` only if the existing Sites workflow requires metadata changes; never change `project_id`.

**Interfaces:**
- Verifies the real NCCU search/syllabus contract and production Sites deployment.

- [ ] **Step 1: Expand NCCU live contract vertically**

Add one real information-note course assertion, run it, then one explicit-restriction assertion, run it, then one official syllabus assertion. Each test validates actual fields consumed by the app.

Run after each cycle: `npm run test:contract:nccu`  
Expected: PASS or a clearly identified upstream outage; do not alter mocks to hide a contract mismatch.

- [ ] **Step 2: Full local verification**

Run:

```bash
npm test
npm run lint
npm run test:contract:nccu
```

Expected: all commands PASS.

- [ ] **Step 3: Chrome desktop test**

Use an isolated query/test state to verify official search, official syllabus, eligibility review, both Wei arrangements, valid AI route display/apply, transfer preview, clear/undo, More menus and no console errors.

- [ ] **Step 4: Chrome 390×844 test**

Verify agenda default, grid switch, Sunday, internal-only grid scrolling, 44px tabs/actions, overflow menus, tutorial and no document-level horizontal overflow. Reset viewport afterward.

- [ ] **Step 5: Update documentation**

Document canonical/full versus static/portfolio roles, transfer steps, eligibility states, section selection, agenda view, undo, AI guarantees and privacy boundaries.

- [ ] **Step 6: Commit verified implementation**

```bash
git add tests/nccu-live-contract.test.mjs tests/browser/sunbreak-critical-flows.md README.md
git commit -m "docs: document trusted scheduling workflow"
```

- [ ] **Step 7: Publish through the existing Sites project**

Use `.openai/hosting.json` project ID unchanged. Build the exact committed source, save a Sites version, deploy that version, wait for terminal success, then inspect deployment status.

- [ ] **Step 8: Production Chrome smoke test**

Verify the deployed URL with a fresh browser state. Do not alter the user’s existing saved timetable. Confirm official search, API-key onboarding, transfer import/export, undo, agenda/grid and deterministic route behavior.

- [ ] **Step 9: Final repository check**

Run `git status --short` and report any pre-existing/unrelated files separately. The only expected untracked path is the existing `.impeccable/` critique artifact unless intentionally committed.

## Plan Self-Review

- Spec coverage: all data semantics, eligibility states, section identity, AI validation, transfer, undo, candidate hierarchy, mobile agenda, errors, contracts and deployment requirements map to a task.
- Placeholder scan: no TBD/TODO/“similar to” implementation gaps.
- Type consistency: typed note arrays, four eligibility states, section selection, validator result, transfer format and error result use the same names throughout.
- TDD order: each behavior begins with a failing test and immediately receives the minimal implementation before the next behavior.
