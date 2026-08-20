# One-time Exam Schedule Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make NCCU 115-1 course `701889001` occupy no recurring weekly slot while retaining its week-11 in-person exam as a one-time conflict event.

**Architecture:** A pure correction function in the NCCU adapter applies verified syllabus semantics at the source boundary. New imports call it during candidate conversion; storage migration calls the same function so existing browser data is repaired without deleting user-owned state.

**Tech Stack:** Node.js ESM, Node test runner, browser localStorage, static frontend bundle.

## Global Constraints

- Use one vertical Red → Green → Refactor cycle at a time.
- Do not build a general syllabus parser in this fix.
- Preserve unrelated user-owned candidate fields and selections.
- Do not infer a calendar date not explicitly present in the syllabus.

---

### Task 1: Correct newly imported official course data

**Files:**
- Modify: `tests/nccu-course-adapter.test.mjs`
- Modify: `src/nccu-course-adapter.mjs`

**Interfaces:**
- Produces: `applyVerifiedScheduleCorrections(candidate): candidate`
- `nccuCourseToCandidate(course)` returns corrected schedule semantics for `701889001`.

- [ ] **Step 1: Write one failing adapter test**

Add a test that converts official course `701889001` with `scheduleText: '二78E'` and expects
`schedule === null`, `meetings === []`, `asyncAllowed === true`, `attendance === 'async'`, and
one event `{ label: '第 11 週上機考', week: 11, day: 2, start: 970, end: 1140 }`.

- [ ] **Step 2: Confirm Red**

Run: `node --test --test-name-pattern="one-time week-11 exam" tests/nccu-course-adapter.test.mjs`

Expected: FAIL because the current adapter returns a recurring Tuesday meeting.

- [ ] **Step 3: Implement the smallest source-boundary correction**

Export `applyVerifiedScheduleCorrections(candidate)` from `src/nccu-course-adapter.mjs`. Match
`sectionCode === '701889001'`; return all unrelated courses unchanged. For the matched course,
replace recurring schedule fields, set asynchronous defaults, append the one-time event without
duplicating it, and add a concise delivery note citing the official syllabus semantics.

- [ ] **Step 4: Confirm Green and regression**

Run: `node --test tests/nccu-course-adapter.test.mjs`

Expected: PASS, including existing fixed-period conversion tests.

### Task 2: Repair existing saved browser data

**Files:**
- Modify: `tests/planner-storage.test.mjs`
- Modify: `src/planner-storage.mjs`

**Interfaces:**
- Consumes: `applyVerifiedScheduleCorrections(candidate)`
- `migratePlannerState(state)` repairs matching saved course objects.

- [ ] **Step 1: Write one failing migration test**

Create a version-6 saved state containing selected `ai-701889001` with recurring `二78E`, a user
note, and lock state. Expect parsing to retain identity, user note, selection and lock while changing
the saved course to asynchronous semantics and the week-11 event.

- [ ] **Step 2: Confirm Red**

Run: `node --test --test-name-pattern="one-time exam course" tests/planner-storage.test.mjs`

Expected: FAIL because version-6 data currently passes through unchanged.

- [ ] **Step 3: Reuse the adapter correction in migration**

Apply `applyVerifiedScheduleCorrections` to every saved official course inside
`migratePlannerState`. Preserve all fields not explicitly changed by the verified correction.

- [ ] **Step 4: Confirm Green**

Run: `node --test tests/planner-storage.test.mjs`

Expected: PASS.

### Task 3: Verify user-visible scheduling and release

**Files:**
- Modify: `HANDOFF.md`
- Modify: `.gitignore` only if `.screenshots/` is not already ignored.

**Interfaces:**
- Browser flow: search `701889001` → add candidate → add to schedule → inspect grid and asynchronous workspace.

- [ ] **Step 1: Run focused integration regressions**

Run: `node --test tests/planner-core.test.mjs tests/plan-validator.test.mjs tests/schedule-agenda.test.mjs tests/internship-planner.test.mjs`

Expected: PASS; a one-time event can still create an event warning while no weekly block is created.

- [ ] **Step 2: Deliver the product-understanding checkpoint**

Explain product capability, user experience, technical components, data flow, design reason,
alternatives, security/cost, current test evidence and remaining limits before full tests.

- [ ] **Step 3: Run the complete project verification**

Run: `npm run test:unit && npm test && npm run lint && npm run test:contract:nccu`

Expected: every command exits 0.

- [ ] **Step 4: Run two screenshot review rounds**

Start the local dev server. In each round capture exactly desktop 1280×800 and mobile 375×812.
Exercise the real course-add flow and verify the course appears in the asynchronous workspace, not
the Tuesday grid. Review hierarchy, spacing, typography, color, alignment, responsiveness, states,
and motion. Fix only regressions caused by this change; repeat the pair after any correction.

- [ ] **Step 5: Update handoff, commit, push and deploy**

Record final test evidence and screenshot paths in `HANDOFF.md`. Commit only task files plus the
existing user-owned handoff/history edits when their intent is understood and preserved. Push
`main`, verify the remote contains the commit, deploy through the existing production workflow,
then open the canonical URL and repeat the core flow with zero critical console or server errors.
