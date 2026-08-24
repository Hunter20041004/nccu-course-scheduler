# TAICA Asynchronous Course Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct all verified NCCU 115-1 TAICA courses so eight asynchronous-capable courses default to asynchronous scheduling while synchronous-only and flexible non-TAICA courses remain accurately classified.

**Architecture:** Extend the existing verified schedule-correction boundary in `nccu-course-adapter.mjs` with a closed, semester-specific course table rather than inferring from “TAICA”, “遠距”, or “未定或彈性”. Preserve recurring remote meetings so users can switch back to synchronous attendance, store one-time obligations separately, and reuse the same correction function for imports, refreshes, and saved-state migration.

**Tech Stack:** Node.js 22+, ECMAScript modules, Node test runner, dependency-free HTML/CSS/JS build, `playwright-cli` for browser verification.

## Global Constraints

- Scope is NCCU semester 115-1 only; never apply these corrections to 115-2 or later.
- Verified asynchronous course codes are exactly `070421001`, `070422001`, `070423001`, `070424001`, `070425001`, `070426001`, `070427001`, and `070455001`.
- `070450001` is synchronous remote only and must never gain `asyncAllowed: true` from TAICA metadata alone.
- “劇本寫作與 AI 協作” and “人工智慧實務專題” must remain non-asynchronous unless separate official evidence is added later.
- An asynchronous selection hides recurring meetings from the weekly grid; switching to `sync` restores verified recurring meetings.
- Only events with a reliable day and time may enter conflict calculations. Date-only or contradictory obligations are reminders, not fake time ranges.
- Refresh and migration may repair a legacy erroneous default once, but must preserve a user choice after the correction marker is already stored.
- TDD is vertical: one failing test, one minimal implementation, one passing test, then refactor before the next behavior.
- Do not add runtime dependencies.
- Preserve the existing visual system; this is a data and labeling correction, not a redesign.

## File Map

- Modify `src/nccu-course-adapter.mjs`: semester-specific verified TAICA correction data and application.
- Modify `src/course-reconciler.mjs`: one-time default repair during official refresh while preserving later attendance overrides.
- Modify `src/planner-storage.mjs`: saved-state migration through the shared correction boundary.
- Modify `src/planner-core.mjs`: no API redesign; only event reminder behavior if needed for pending-time copy.
- Modify `src/app.mjs`: restore verified course defaults and render truthful attendance copy/reminders.
- Modify `tests/nccu-course-adapter.test.mjs`: verified mappings and counterexamples.
- Modify `tests/course-reconciler.test.mjs`: refresh semantics.
- Modify `tests/planner-storage.test.mjs`: legacy migration and idempotence.
- Modify `tests/planner-core.test.mjs`: default add, synchronous switch, event/reminder behavior.
- Modify `tests/nccu-live-contract.test.mjs`: real NCCU coverage and syllabus wording.
- Modify `tests/rendered-html.test.mjs`: user-visible label and control contract.
- Modify `HANDOFF.md`: implementation and verification evidence.

---

### Task 1: Correct one representative TAICA course end to end

**Files:**
- Modify: `tests/nccu-course-adapter.test.mjs`
- Modify: `src/nccu-course-adapter.mjs`

**Interfaces:**
- Consumes: `nccuCourseToCandidate(course, { checkedAt? })` and `applyVerifiedScheduleCorrections(candidate)`.
- Produces: a corrected candidate for `070424001` with `asyncAllowed`, `attendance`, synchronous meetings, and a correction marker.

- [ ] **Step 1: Write one failing adapter test**

Add this single test after the existing `701889001` correction test:

```js
test('defaults verified TAICA fintech to asynchronous while retaining its synchronous meeting', () => {
  const candidate = nccuCourseToCandidate({
    courseCode: '070424001',
    title: '金融科技導論',
    teacher: '詳備註',
    credits: 3,
    scheduleText: '未定或彈性',
    restrictionText: '【臺灣大專院校人工智慧學程聯盟課程】',
    sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/schmPrv.jsp-yy=115&smt=1&num=070424&gop=00&s=1.html',
  });

  assert.equal(candidate.asyncAllowed, true);
  assert.equal(candidate.deliveryMode, 'asynchronous-optional');
  assert.equal(candidate.attendance, 'async');
  assert.deepEqual(candidate.meetings, [{ day: 3, start: 550, end: 730, label: '週三 09:10–12:10' }]);
  assert.equal(candidate.scheduleCorrectionId, 'nccu-1151-taica-070424001');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test --test-name-pattern="defaults verified TAICA fintech" tests/nccu-course-adapter.test.mjs
```

Expected: FAIL because the current adapter returns `asyncAllowed: false` and no meeting for `未定或彈性`.

- [ ] **Step 3: Add the minimal verified correction record**

Refactor the existing correction constant into records that can describe either replacement or retained meetings. Add this record:

```js
'070424001': Object.freeze({
  correctionId: 'nccu-1151-taica-070424001',
  deliveryMode: 'asynchronous-optional',
  meetings: Object.freeze([
    Object.freeze({ day: 3, start: 550, end: 730, label: '週三 09:10–12:10' }),
  ]),
  deliveryNote: '官方 115-1 課綱：可接受非同步授課；同步遠距為週三 09:10–12:10。',
}),
```

Update `applyVerifiedScheduleCorrections` so a record can set `schedule`, `meetings`, `asyncAllowed: true`, `deliveryMode`, `attendance: 'async'`, and `scheduleCorrectionId` without discarding the verified synchronous meeting.

- [ ] **Step 4: Run the test and verify GREEN**

Run the same command. Expected: PASS, with the rest of `tests/nccu-course-adapter.test.mjs` also green.

- [ ] **Step 5: Refactor and commit**

Keep the source-evidence check shared with the existing `701889001` rule. Run:

```bash
git add src/nccu-course-adapter.mjs tests/nccu-course-adapter.test.mjs
git commit -m "fix: classify verified TAICA fintech as asynchronous"
```

---

### Task 2: Add the remaining seven verified asynchronous mappings one at a time

**Files:**
- Modify: `tests/nccu-course-adapter.test.mjs`
- Modify: `src/nccu-course-adapter.mjs`

**Interfaces:**
- Consumes: the correction-record shape from Task 1.
- Produces: complete `TAICA_1151_CORRECTIONS` coverage for eight asynchronous-capable courses.

For each row below, repeat Steps 1–5 completely before moving to the next row. The table is the exact
input/output manifest: each row becomes one named test and one correction record; do not batch rows.

| Course | Meeting | Required reminder metadata |
| --- | --- | --- |
| `070421001` 資料探勘與應用 | `{ day: 1, start: 540, end: 720, label: '週一 09:00–12:00' }` | event `{ label: '實體考試', date: '2026-12-14', day: 1, start: 540, end: 720 }` |
| `070422001` 基礎程式設計 C++ | `{ day: 1, start: 540, end: 720, label: '週一 09:00–12:00' }` | date-only reminders for `11/2` and `12/21`, plus information note `每週課間測驗，請依最新課綱確認同步要求` |
| `070423001` 人工智慧導論 | `{ day: 4, start: 790, end: 960, label: '週四 13:10–16:00' }` | event `{ label: '實體同步考試', date: '2026-12-10', day: 4, start: 790, end: 960 }` |
| `070425001` 統計學暨實習 | `{ day: 3, start: 550, end: 730, label: '週三 09:10–12:10' }` | reminder `考試日期官方資料不一致（10/28、12/16 或 12/23），待官方確認` and note `週二 13:20–15:10 optional recitation` |
| `070426001` 智慧人機互動 | `{ day: 4, start: 790, end: 960, label: '週四 13:10–16:00' }` | date-only reminder `12/26 共同展示交流` |
| `070427001` 自然語言處理 | `{ day: 4, start: 540, end: 720, label: '週四 09:00–12:00' }` | event `{ label: '實體考試', date: '2026-12-10', day: 4, start: 540, end: 720 }` |
| `070455001` 機器學習 | `{ day: 3, start: 550, end: 730, label: '週三 09:10–12:10' }` | date-only reminder `12/9 實體同步考試，時間待確認` |

- [ ] **Step 1: Write the `070421001` failing test shown below**

The first slice uses this complete test:

```js
test('maps verified TAICA 070421001 to asynchronous attendance and its official obligations', () => {
  const candidate = nccuCourseToCandidate({
    courseCode: '070421001', title: '資料探勘與應用', teacher: '詳備註', credits: 3,
    scheduleText: '未定或彈性', restrictionText: '【臺灣大專院校人工智慧學程聯盟課程】',
    sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/schmPrv.jsp-yy=115&smt=1&num=070421&gop=00&s=1.html',
  });
  assert.equal(candidate.attendance, 'async');
  assert.deepEqual(candidate.meetings, [{ day: 1, start: 540, end: 720, label: '週一 09:00–12:00' }]);
  assert.deepEqual(candidate.events, [{ label: '實體考試', date: '2026-12-14', day: 1, start: 540, end: 720 }]);
});
```

- [ ] **Step 2: Run the `070421001` test and verify RED**

Run `node --test --test-name-pattern="maps verified TAICA 070421001" tests/nccu-course-adapter.test.mjs`. Expected: FAIL on the missing correction.

- [ ] **Step 3: Add only the `070421001` correction record**

Add this exact record:

```js
'070421001': Object.freeze({
  correctionId: 'nccu-1151-taica-070421001', deliveryMode: 'asynchronous-optional',
  meetings: Object.freeze([Object.freeze({ day: 1, start: 540, end: 720, label: '週一 09:00–12:00' })]),
  events: Object.freeze([Object.freeze({ label: '實體考試', date: '2026-12-14', day: 1, start: 540, end: 720 })]),
  deliveryNote: '官方 115-1 課綱：可接受非同步授課；同步遠距為週一 09:00–12:00。',
}),
```

- [ ] **Step 4: Run that test and verify GREEN**

Run the same focused command. Expected: PASS.

- [ ] **Step 5: Commit `070421001`, then execute the six exact slices below**

Commit with `git commit -m "fix: classify TAICA 070421001 attendance"`. Then perform six more
independent Red → Green → Refactor cycles using the exact manifest table values and these exact test
names, correction IDs, and commits:

```text
070422001: test "maps verified TAICA 070422001 obligations without fake times"
  correctionId nccu-1151-taica-070422001
  commit "fix: classify TAICA 070422001 attendance"
070423001: test "maps verified TAICA 070423001 synchronous exam"
  correctionId nccu-1151-taica-070423001
  commit "fix: classify TAICA 070423001 attendance"
070425001: test "reports conflicting official dates for TAICA 070425001"
  correctionId nccu-1151-taica-070425001
  commit "fix: classify TAICA 070425001 attendance"
070426001: test "maps verified TAICA 070426001 showcase reminder"
  correctionId nccu-1151-taica-070426001
  commit "fix: classify TAICA 070426001 attendance"
070427001: test "maps verified TAICA 070427001 physical exam"
  correctionId nccu-1151-taica-070427001
  commit "fix: classify TAICA 070427001 attendance"
070455001: test "maps verified TAICA 070455001 pending-time exam"
  correctionId nccu-1151-taica-070455001
  commit "fix: classify TAICA 070455001 attendance"
```

For each test, construct the candidate exactly as in the shown `070421001` test with that row's
course code/title and official `num=` URL; assert `attendance`, the row's exact `meetings`, and the
row's exact reminder metadata. For each implementation, add only that row's exact values to the
correction table; reliable timed obligations use `day/start/end`, while date-only or contradictory
obligations omit those three fields so conflict detection cannot invent precision.

---

### Task 3: Protect synchronous-only and unrelated flexible courses

**Files:**
- Modify: `tests/nccu-course-adapter.test.mjs`
- Modify: `src/nccu-course-adapter.mjs` only if the negative test reveals over-broad matching.

**Interfaces:**
- Consumes: `applyVerifiedScheduleCorrections(candidate)`.
- Produces: explicit regression proof that classification is by exact course code plus 115-1 source.

- [ ] **Step 1: Write one failing counterexample test for synchronous-only TAICA**

```js
test('keeps TAICA physical AI synchronous-only despite remote and TAICA notes', () => {
  const candidate = nccuCourseToCandidate({
    courseCode: '070450001', title: '實體人工智慧', teacher: '詳備註', credits: 3,
    scheduleText: '未定或彈性',
    restrictionText: '【臺灣大專院校人工智慧學程聯盟課程】TAICA衛星課程，遠距上課使用NTUCOOL平台。',
    sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/schmPrv.jsp-yy=115&smt=1&num=070450&gop=00&s=1.html',
  });
  assert.equal(candidate.asyncAllowed, false);
  assert.equal(candidate.attendance, undefined);
});
```

- [ ] **Step 2: Run and verify RED or meaningful GREEN**

Run the named test. If it already passes, temporarily replace the exact-code lookup with a TAICA-text match and prove the test fails, then restore the exact-code implementation and prove it passes; record this mutation check in `HANDOFF.md`.

- [ ] **Step 3: Add the unrelated-flexible counterexample as the next vertical slice**

After the first slice is green, add a separate test for `070401001`「劇本寫作與 AI 協作」with `scheduleText: '未定或彈性'` and assert `asyncAllowed === false`. Run red/mutation-green as above.

- [ ] **Step 4: Add the AI-project counterexample as the next vertical slice**

Add a separate test for `783006001`「人工智慧實務專題」and assert it receives no TAICA correction. Run red/mutation-green as above.

- [ ] **Step 5: Commit**

```bash
git add src/nccu-course-adapter.mjs tests/nccu-course-adapter.test.mjs
git commit -m "test: guard TAICA asynchronous classification boundaries"
```

---

### Task 4: Preserve the default through course selection and synchronous switching

**Files:**
- Modify: `tests/planner-core.test.mjs`
- Modify: `src/planner-core.mjs`

**Interfaces:**
- Consumes: corrected candidate `{ asyncAllowed: true, attendance: 'async', meetings: [...] }`.
- Produces: `toggleSelectableCourse` that respects a verified default even when the course has option metadata.

- [ ] **Step 1: Write one failing selection test**

```js
test('adds a verified TAICA course with its asynchronous default and retained sync meeting', () => {
  const course = {
    id: 'ai-070424001', title: '金融科技導論', available: true,
    asyncAllowed: true, attendance: 'async',
    meetings: [{ day: 3, start: 550, end: 730, label: '週三 09:10–12:10' }],
  };
  assert.deepEqual(core.toggleSelectableCourse([], course, profile), [course]);
});
```

- [ ] **Step 2: Run and verify RED**

Run `node --test --test-name-pattern="adds a verified TAICA course" tests/planner-core.test.mjs`. Expected: FAIL only if an existing selection path overwrites the verified default.

- [ ] **Step 3: Implement the minimal default-preservation rule**

Route all additions through a small helper:

```js
function defaultAttendance(course) {
  return course.asyncAllowed && course.attendance === 'async' ? 'async' : 'physical';
}
```

Use it in both the simple and option-bearing branches without changing manual-course behavior.

- [ ] **Step 4: Verify GREEN, then add synchronous-switch behavior**

After green, add a separate test proving `{ ...course, attendance: 'sync' }` contributes its retained meeting to `findConflicts`. Run that test red → minimal implementation if needed → green.

- [ ] **Step 5: Commit**

```bash
git add src/planner-core.mjs tests/planner-core.test.mjs
git commit -m "fix: preserve verified asynchronous course defaults"
```

---

### Task 5: Repair official refreshes without overwriting later choices

**Files:**
- Modify: `tests/course-reconciler.test.mjs`
- Modify: `src/course-reconciler.mjs`

**Interfaces:**
- Consumes: `scheduleCorrectionId`, existing/incoming attendance, and verified meetings.
- Produces: `reconcileOfficialCandidate(existing, incoming)` with one-time correction semantics.

- [ ] **Step 1: Write a failing legacy-refresh test**

Use an existing `070424001` course with `attendance: 'physical'`, no correction marker, and no meetings. Reconcile it with a corrected incoming candidate and assert `attendance === 'async'`, `asyncAllowed === true`, and the verified meeting is stored.

- [ ] **Step 2: Run and verify RED**

Run `node --test --test-name-pattern="repairs legacy TAICA" tests/course-reconciler.test.mjs`. Expected: FAIL because the current repair condition only detects stale recurring schedules.

- [ ] **Step 3: Implement marker-based one-time repair**

Use this decision:

```js
const appliesNewCorrection = incoming.scheduleCorrectionId
  && existing.scheduleCorrectionId !== incoming.scheduleCorrectionId;
if (appliesNewCorrection) reconciled.attendance = incoming.attendance;
```

Keep all `USER_OWNED_FIELDS` preservation, then apply the new correction only when its marker was not previously present.

- [ ] **Step 4: Verify GREEN, then protect user overrides**

After green, add a separate test where existing and incoming share `nccu-1151-taica-070424001` but existing attendance is `sync`; assert refresh preserves `sync`. Run red/mutation-green, then the full reconciler test file.

- [ ] **Step 5: Commit**

```bash
git add src/course-reconciler.mjs tests/course-reconciler.test.mjs
git commit -m "fix: migrate TAICA attendance during official refresh"
```

---

### Task 6: Migrate existing browser data idempotently

**Files:**
- Modify: `tests/planner-storage.test.mjs`
- Modify: `src/planner-storage.mjs`

**Interfaces:**
- Consumes: `applyVerifiedScheduleCorrections(course)` and saved `attendance` map.
- Produces: version-6-compatible migrated state; no storage-version bump unless the implementation proves necessary.

- [ ] **Step 1: Write one failing migration test for an uncorrected saved TAICA course**

Create a version-6 stored state containing selected `ai-070424001`, `attendance: physical`, official 115-1 source, no correction marker, and no meetings. Assert migration adds the marker and meeting and changes both course/default attendance to `async`.

- [ ] **Step 2: Run and verify RED**

Run `node --test --test-name-pattern="migrates legacy TAICA fintech" tests/planner-storage.test.mjs`. Expected: FAIL on missing correction/default repair.

- [ ] **Step 3: Implement correction-marker migration**

Capture the marker before and after applying the shared correction:

```js
const receivedNewCorrection = correctedCourse.scheduleCorrectionId
  && course.scheduleCorrectionId !== correctedCourse.scheduleCorrectionId;
if (receivedNewCorrection) correctedAttendanceIds.push(correctedCourse.id);
```

Do not depend only on whether the old course had a recurring schedule.

- [ ] **Step 4: Verify GREEN, then add the override/idempotence slice**

Add a separate saved course already containing the correction marker with `attendance: 'sync'`; serialize and migrate twice and assert `sync` remains unchanged and the second migration equals the first.

- [ ] **Step 5: Commit**

```bash
git add src/planner-storage.mjs tests/planner-storage.test.mjs
git commit -m "fix: migrate saved TAICA asynchronous defaults"
```

---

### Task 7: Make reminders truthful and user-visible labels explicit

**Files:**
- Modify: `tests/planner-core.test.mjs`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/planner-core.mjs`
- Modify: `src/app.mjs`

**Interfaces:**
- Consumes: timed and date-only `events`, `attendance`, `asyncAllowed`.
- Produces: reminder strings and UI copy distinguishing chosen asynchronous attendance from undecided time.

- [ ] **Step 1: Write one failing date-only reminder test**

```js
test('formats a pending-time TAICA obligation without inventing a conflict time', () => {
  assert.equal(core.formatCourseEventReminder(
    { title: '機器學習' },
    { date: '2026-12-09', label: '實體同步考試，時間待確認' },
  ), '機器學習：2026-12-09 實體同步考試，時間待確認');
});
```

Run it. If already green, mutate `formatCourseEventReminder` to omit the date and prove the test fails, restore, and record the mutation proof.

- [ ] **Step 2: Write and pass one no-fake-conflict test**

Add a separate test passing a date-only event and an overlapping weekly course to `findConflicts`; assert no event conflict is created. If the current code errors on missing time, guard conflict checks with `Number.isFinite(event.day/start/end)`.

- [ ] **Step 3: Write one failing rendered-contract test**

Assert built HTML contains the selected-course label logic `attendance === 'async' ? '非同步遠距'` and the general capability copy `可同步／非同步遠距`. Run only `tests/rendered-html.test.mjs` with a matching name.

- [ ] **Step 4: Implement minimal UI copy**

Change only user-visible delivery wording; keep the existing controls and layout. The non-selected flexible lane remains `時間未定`, while corrected selected courses read `非同步遠距`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
node --test tests/planner-core.test.mjs
npm run build
node --test --test-name-pattern="TAICA attendance labels" tests/rendered-html.test.mjs
git add src/planner-core.mjs src/app.mjs tests/planner-core.test.mjs tests/rendered-html.test.mjs
git commit -m "fix: distinguish asynchronous remote courses from undecided time"
```

---

### Task 8: Verify the real NCCU boundary

**Files:**
- Modify: `tests/nccu-live-contract.test.mjs`

**Interfaces:**
- Consumes: live NCCU search and `fetchOfficialSyllabus`.
- Produces: calibrated evidence that the source still exposes all nine TAICA courses and the decisive syllabus phrase.

- [ ] **Step 1: Add one live coverage test**

Search `TAICA`, compare the exact set of nine section codes, and assert `070424001` is included. Run and confirm it passes against the live source; if the source set differs, stop and report the upstream change instead of editing expected data blindly.

- [ ] **Step 2: Add one live syllabus contract test**

Fetch the official `070424001` syllabus and assert it contains `可接受非同步授課` and `星期三 9:10~12:10`. Run this test alone.

- [ ] **Step 3: Add the synchronous-only calibration test**

Fetch `070450001`; assert its syllabus contains `同步遠距` and does not contain `可接受非同步授課`. This proves the method distinguishes allowed from disallowed courses.

- [ ] **Step 4: Run the complete NCCU contract suite**

```bash
npm run test:contract:nccu
```

Expected: all contract tests pass; report the exact test count from output.

- [ ] **Step 5: Commit**

```bash
git add tests/nccu-live-contract.test.mjs
git commit -m "test: verify live TAICA asynchronous course contracts"
```

---

### Task 9: Product understanding checkpoint and full verification

**Files:**
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: all completed implementation slices.
- Produces: evidence package before final browser QA and release.

- [ ] **Step 1: Record the nine-field product checkpoint in `HANDOFF.md`**

Write concise evidence for: product capability; user experience; technical components; data flow; design reason; alternative rejected; security/cost; tests run with counts; remaining limits.

- [ ] **Step 2: Run the full verification suite**

```bash
npm test
npm run lint
npm run test:contract:nccu
```

Expected: zero failures. If any pre-existing unrelated test fails, list it and stop release work.

- [ ] **Step 3: Commit the checkpoint**

```bash
git add HANDOFF.md
git commit -m "docs: record TAICA correction verification"
```

---

### Task 10: Two-round desktop and mobile visual verification

**Files:**
- Modify: `.gitignore` only if `/.screenshots/` is absent.
- Modify: `HANDOFF.md`
- Create locally, ignored: `.screenshots/taica-async/round-1/desktop.png`, `.screenshots/taica-async/round-1/mobile.png`, `.screenshots/taica-async/round-2/desktop.png`, `.screenshots/taica-async/round-2/mobile.png`.

**Interfaces:**
- Consumes: local production-like dev server and real browser storage flow.
- Produces: user-view evidence at 1280×800 and 375×812.

- [ ] **Step 1: Start the dev server and open a clean browser session**

Run `npm run dev`; note the exact local URL. Open with `playwright-cli`, clear local storage, dismiss the first-use dialog, and search `070424001` through the real NCCU flow.

- [ ] **Step 2: Exercise the core flow**

Add the course to candidates and schedule. Verify: lane says `金融科技導論 · 非同步遠距`; no Wednesday weekly block; reminder shows the 12/23 exam; details offer synchronous and asynchronous choices. Switch to sync and verify the Wednesday block appears; reload and verify sync persists.

- [ ] **Step 3: Capture exactly two round-1 screenshots**

```bash
playwright-cli resize 1280 800
playwright-cli screenshot --filename=.screenshots/taica-async/round-1/desktop.png
playwright-cli resize 375 812
playwright-cli screenshot --filename=.screenshots/taica-async/round-1/mobile.png
```

- [ ] **Step 4: Inspect round 1 against every UI checklist item**

Explicitly record pass/fail for hierarchy, whitespace, typography, palette, alignment, 375px responsiveness/no horizontal scroll, hover/focus/empty/loading/error states, and microinteraction. Check `playwright-cli console` for errors and warnings. Fix every failed item using a focused test-first slice.

- [ ] **Step 5: Capture and inspect exactly two round-2 screenshots**

Repeat into `round-2`. Do not reopen round-1 images. All checklist items and console checks must pass.

- [ ] **Step 6: Record final screenshot paths and commit**

Add only the paths and QA conclusions to `HANDOFF.md`; screenshots stay ignored.

```bash
git add HANDOFF.md .gitignore
git commit -m "docs: record TAICA browser verification"
```

---

### Task 11: Review, merge safety, push, and production verification

**Files:**
- Modify: `HANDOFF.md` only for final evidence.

- [ ] **Step 1: Apply `requesting-code-review` and resolve all Critical/Important findings**

Review the spec line by line against the diff. Any code change from review requires its own failing regression test before implementation.

- [ ] **Step 2: Run fresh pre-release verification**

```bash
npm test
npm run lint
npm run test:contract:nccu
git diff --check
git status --short --branch
```

Expected: zero test/lint/contract failures; only known ignored or user-owned files remain.

- [ ] **Step 3: Push `main` and verify the remote contains the release commit**

The work is already on `main`; do not manufacture a merge commit. Run `git push origin main`, then compare `git rev-parse HEAD` with `git ls-remote origin refs/heads/main`.

- [ ] **Step 4: Verify GitHub Pages and canonical Sites deployment**

Wait for the existing GitHub Pages workflow and existing Sites deployment flow. Do not create a new production URL. Verify both URLs return HTTP 200, then exercise search → add → asynchronous lane → switch sync → reload on the canonical Sites URL and check console output.

- [ ] **Step 5: Record final release evidence and push the documentation commit**

Update `HANDOFF.md` with commit hashes, exact test counts, remote equality, deployment URLs, console result, core-flow result, and remaining upstream-data limitations. Commit and push once more, then verify remote equality again.
