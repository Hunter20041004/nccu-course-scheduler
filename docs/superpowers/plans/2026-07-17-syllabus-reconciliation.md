# Syllabus Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair stale saved courses so official syllabus links refresh without losing the user's schedule, locks, attendance choices, or other planning state.

**Architecture:** Add a focused reconciliation module between normalized NCCU data and the candidate catalog. Represent syllabus availability as an explicit three-state value, migrate legacy saved courses to `unverified`, and let a repeated official lookup update an existing candidate instead of stopping at duplicate detection.

**Tech Stack:** Node.js ESM, browser JavaScript, Node test runner, custom static bundle, NCCU public course endpoint, Chrome browser verification.

## Global Constraints

- Use vertical Red → Green → Refactor cycles; add only one failing test before each implementation change.
- Preserve new visitors' empty workspace and all existing local planner data.
- Never replace user-owned fields when official data refreshes.
- Only trust HTTPS URLs on `nccu.edu.tw` or its subdomains.
- Distinguish `available`, `not_uploaded`, and `unverified`; a network error is never `not_uploaded`.
- Do not modify or stage the unrelated `.impeccable/` directory.

---

### Task 1: Reconcile one stale official course

**Files:**
- Create: `src/course-reconciler.mjs`
- Create: `tests/course-reconciler.test.mjs`
- Modify: `scripts/build.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing candidate objects and `nccuCourseToCandidate(officialRow)` output.
- Produces: `reconcileOfficialCandidate(existing, incoming): CourseCandidate`.

- [ ] **Step 1: Write the failing preservation test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileOfficialCandidate } from '../src/course-reconciler.mjs';

test('refreshes official fields while preserving user-owned planning state', () => {
  const existing = {
    id: 'ai-703055001', sectionCode: '703055001', title: '人機互動',
    source: 'nccu-verified-import', sourceUrl: '', attendance: 'async',
    userNote: '優先修', schedule: { day: 4, start: 550, end: 720 },
  };
  const incoming = {
    ...existing,
    teacher: '廖文宏',
    sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/example.html',
    attendance: 'physical', userNote: undefined,
  };

  assert.deepEqual(reconcileOfficialCandidate(existing, incoming), {
    ...incoming,
    attendance: 'async',
    userNote: '優先修',
  });
});
```

- [ ] **Step 2: Run the focused test and confirm Red**

Run: `node --test tests/course-reconciler.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/course-reconciler.mjs`.

- [ ] **Step 3: Add the minimal reconciler**

```js
const USER_OWNED_FIELDS = ['attendance', 'userNote'];

export function reconcileOfficialCandidate(existing, incoming) {
  const reconciled = { ...existing, ...incoming };
  for (const field of USER_OWNED_FIELDS) {
    if (Object.hasOwn(existing, field)) reconciled[field] = existing[field];
  }
  return reconciled;
}
```

Add `src/course-reconciler.mjs` to the client bundle in `scripts/build.mjs`, export `reconcileOfficialCandidate`, include the source in syntax checks, and add `tests/course-reconciler.test.mjs` to `test:unit`.

- [ ] **Step 4: Run the focused test and confirm Green**

Run: `node --test tests/course-reconciler.test.mjs`

Expected: PASS, 1 test.

- [ ] **Step 5: Refactor the ownership list and rerun**

Expand the protected list to the fields stored on candidate objects:

```js
const USER_OWNED_FIELDS = Object.freeze([
  'attendance', 'userNote', 'selectedArrangementId', 'selectedSectionId',
]);
```

Run: `node --test tests/course-reconciler.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the vertical slice**

```bash
git add src/course-reconciler.mjs tests/course-reconciler.test.mjs scripts/build.mjs package.json
git commit -m "fix: reconcile fresh official course fields"
```

### Task 2: Model an available syllabus

**Files:**
- Create: `src/nccu-url.mjs`
- Create: `tests/nccu-url.test.mjs`
- Create: `src/syllabus-state.mjs`
- Create: `tests/syllabus-state.test.mjs`
- Modify: `src/nccu-course-adapter.mjs`
- Modify: `tests/nccu-course-adapter.test.mjs`
- Modify: `scripts/build.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `officialSyllabusState({ sourceUrl, lookupStatus, checkedAt }): SyllabusState`.
- `SyllabusState = { status: 'available'|'not_uploaded'|'unverified', url: string, checkedAt: string|null }`.

- [ ] **Step 1: Write the failing available-state test**

```js
test('marks a trusted official syllabus URL available', () => {
  assert.deepEqual(officialSyllabusState({
    sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/example.html',
    lookupStatus: 'success', checkedAt: '2026-07-17T18:00:00.000Z',
  }), {
    status: 'available',
    url: 'https://newdoc.nccu.edu.tw/teaschm/1151/example.html',
    checkedAt: '2026-07-17T18:00:00.000Z',
  });
});
```

- [ ] **Step 2: Confirm Red**

Run: `node --test tests/syllabus-state.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/syllabus-state.mjs`.

- [ ] **Step 3: Implement only the available case**

```js
export function trustedNccuUrl(value) {
  try {
    const url = new URL(String(value || ''));
    const officialHost = url.hostname === 'nccu.edu.tw' || url.hostname.endsWith('.nccu.edu.tw');
    return url.protocol === 'https:' && officialHost ? url.href : '';
  } catch {
    return '';
  }
}

export function officialSyllabusState({ sourceUrl, lookupStatus, checkedAt = null }) {
  const url = trustedNccuUrl(sourceUrl);
  if (lookupStatus === 'success' && url) return { status: 'available', url, checkedAt };
  return { status: 'unverified', url: '', checkedAt };
}
```

Update `nccuCourseToCandidate(course, { checkedAt = null } = {})` to include:

```js
syllabus: officialSyllabusState({
  sourceUrl: course.syllabusUrl || course.sourceUrl,
  lookupStatus: 'success',
  checkedAt,
}),
```

Put `trustedNccuUrl` in `src/nccu-url.mjs` and import it from `src/syllabus-state.mjs`. Change the existing adapter helper to `return trustedNccuUrl(course.sourceUrl)` so its public API and existing tests stay compatible. Add a focused `tests/nccu-url.test.mjs` test for HTTPS NCCU subdomains, `javascript:`, HTTP, and lookalike domains before making that change. In `scripts/build.mjs`, wrap `nccu-url.mjs`, then `syllabus-state.mjs`, then `nccu-course-adapter.mjs`; include the new exports and add both sources/tests to `lint` and `test:unit`.

- [ ] **Step 4: Confirm Green and run adapter regression**

Run: `node --test tests/syllabus-state.test.mjs tests/nccu-course-adapter.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nccu-url.mjs src/syllabus-state.mjs src/nccu-course-adapter.mjs tests/nccu-url.test.mjs tests/syllabus-state.test.mjs tests/nccu-course-adapter.test.mjs scripts/build.mjs package.json
git commit -m "feat: model available official syllabi"
```

### Task 3: Distinguish not uploaded from unverified

**Files:**
- Modify: `src/syllabus-state.mjs`
- Modify: `tests/syllabus-state.test.mjs`

**Interfaces:**
- Extends `officialSyllabusState` without changing its return shape.

- [ ] **Step 1: Write the failing not-uploaded test**

```js
test('marks a successful lookup without a URL as not uploaded', () => {
  assert.deepEqual(officialSyllabusState({
    sourceUrl: '', lookupStatus: 'success', checkedAt: '2026-07-17T18:00:00.000Z',
  }), { status: 'not_uploaded', url: '', checkedAt: '2026-07-17T18:00:00.000Z' });
});
```

- [ ] **Step 2: Confirm Red**

Run: `node --test --test-name-pattern="without a URL" tests/syllabus-state.test.mjs`

Expected: FAIL because the actual status is `unverified`.

- [ ] **Step 3: Implement the successful empty response**

```js
if (lookupStatus === 'success') return { status: 'not_uploaded', url: '', checkedAt };
return { status: 'unverified', url: '', checkedAt };
```

- [ ] **Step 4: Confirm Green**

Run: `node --test tests/syllabus-state.test.mjs`

Expected: PASS.

- [ ] **Step 5: Write the next failing network-error test**

```js
test('keeps a failed official lookup unverified', () => {
  assert.deepEqual(officialSyllabusState({
    sourceUrl: '', lookupStatus: 'error', checkedAt: null,
  }), { status: 'unverified', url: '', checkedAt: null });
});
```

- [ ] **Step 6: Run and confirm it already passes for the intended reason**

Run: `node --test --test-name-pattern="failed official lookup" tests/syllabus-state.test.mjs`

Expected: PASS. No production change is needed because Task 2's fallback already implements this behavior.

- [ ] **Step 7: Commit**

```bash
git add src/syllabus-state.mjs tests/syllabus-state.test.mjs
git commit -m "feat: distinguish missing and unknown syllabi"
```

### Task 4: Migrate legacy saved courses safely

**Files:**
- Modify: `src/syllabus-state.mjs`
- Modify: `src/planner-storage.mjs`
- Modify: `tests/planner-storage.test.mjs`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Produces storage version `6`.
- Consumes `officialSyllabusState` for legacy candidates.

- [ ] **Step 1: Write the failing migration test**

```js
test('migrates a legacy official course without source evidence to unverified', () => {
  const stored = JSON.stringify({ version: 5, state: {
    selectedIds: ['ai-703055001'],
    lockedCourseIds: ['ai-703055001'],
    attendance: { 'ai-703055001': 'async' },
    addedCourses: [{
      id: 'ai-703055001', sectionCode: '703055001',
      source: 'nccu-verified-import', sourceUrl: '',
    }],
  } });
  const migrated = parsePlannerState(stored, null);
  assert.equal(migrated.addedCourses[0].syllabus.status, 'unverified');
  assert.deepEqual(migrated.selectedIds, ['ai-703055001']);
  assert.deepEqual(migrated.lockedCourseIds, ['ai-703055001']);
  assert.equal(migrated.attendance['ai-703055001'], 'async');
});
```

- [ ] **Step 2: Confirm Red**

Run: `node --test --test-name-pattern="legacy official course" tests/planner-storage.test.mjs`

Expected: FAIL because `syllabus` is undefined.

- [ ] **Step 3: Implement the version-six migration**

Add a candidate migration inside `migratePlannerState`:

```js
const addedCourses = (state.addedCourses || state.manualCourses || []).map((course) => {
  if (course.source !== 'nccu-verified-import' || course.syllabus) return course;
  return {
    ...course,
    syllabus: officialSyllabusState({
      sourceUrl: course.sourceUrl,
      lookupStatus: course.sourceUrl ? 'success' : 'legacy',
      checkedAt: null,
    }),
  };
});
```

Import `officialSyllabusState` from `./syllabus-state.mjs`. In the browser bundle, wrap `syllabus-state.mjs` before `planner-storage.mjs` so stripping ESM imports still leaves the helper in scope.

Return `addedCourses`, serialize as version `6`, and allow versions 4, 5, and 6 in `parsePlannerState`.

- [ ] **Step 4: Confirm Green and run storage regression**

Run: `node --test tests/planner-storage.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/syllabus-state.mjs src/planner-storage.mjs tests/planner-storage.test.mjs scripts/build.mjs
git commit -m "fix: migrate stale syllabus state safely"
```

### Task 5: Refresh an existing candidate from search

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes `reconcileOfficialCandidate` and `nccuCourseToCandidate`.
- Produces search-result actions `data-add-nccu-course` and `data-refresh-nccu-course`.

- [ ] **Step 1: Write the failing rendered-flow test**

```js
test('lets an existing official candidate refresh instead of disabling the result', async () => {
  const html = await renderedHtml();
  assert.match(html, /data-refresh-nccu-course/);
  assert.match(html, /reconcileOfficialCandidate\(existingCourse, candidate\)/);
  assert.match(html, /更新官方資料/);
});
```

- [ ] **Step 2: Confirm Red**

Run: `node --test --test-name-pattern="existing official candidate refresh" tests/rendered-html.test.mjs`

Expected: FAIL because refresh markup and handler are absent.

- [ ] **Step 3: Implement the refresh action**

In `renderNccuSearchResults`, replace the disabled duplicate state with:

```js
const existing = courseStore.find((candidate) => candidate.sectionCode === course.courseCode);
const action = existing
  ? `<button class="button button-quiet" type="button" data-refresh-nccu-course="${escapeHtml(course.courseCode)}">更新官方資料</button>`
  : `<button class="button button-primary" type="button" data-add-nccu-course="${escapeHtml(course.courseCode)}">加入候選</button>`;
```

Add a shared refresh helper so search results and the course-detail menu use the same behavior:

```js
async function refreshOfficialCandidateByCode(courseCode) {
  const officialCourse = nccuSearchResults.find((course) => course.courseCode === courseCode)
    || (await searchNccuCourses({ term: '115-1', keyword: courseCode }))
      .find((course) => course.courseCode === courseCode);
  const existingIndex = courseStore.findIndex(
    (course) => course.sectionCode === officialCourse?.courseCode,
  );
  if (!officialCourse || existingIndex < 0) throw new Error('official-course-not-found');
  const existingCourse = courseStore[existingIndex];
  const candidate = nccuCourseToCandidate(officialCourse, { checkedAt: new Date().toISOString() });
  courseStore = courseStore.map((course, index) => (
    index === existingIndex ? reconcileOfficialCandidate(existingCourse, candidate) : course
  ));
  persistState();
  renderAll();
  renderNccuSearchResults();
  return candidate;
}

const refreshButton = event.target.closest('[data-refresh-nccu-course]');
if (refreshButton) {
  const candidate = await refreshOfficialCandidateByCode(refreshButton.dataset.refreshNccuCourse);
  byId('nccu-course-search-status').textContent = `已更新「${candidate.title}」的官方資料。`;
}
```

Catch lookup errors at the event boundary, retain the last successful candidate, and show `官方資料暫時無法更新，已保留目前資料。`; never change the syllabus state to `not_uploaded` on that path.

- [ ] **Step 4: Confirm Green**

Run: `node --test tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.mjs src/styles.css tests/rendered-html.test.mjs
git commit -m "fix: refresh existing official candidates"
```

### Task 6: Render all three syllabus states

**Files:**
- Modify: `src/app.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes `course.syllabus.status` and `course.syllabus.url`.

- [ ] **Step 1: Write the failing copy contract test**

```js
test('renders available, not-uploaded, and unverified syllabus actions', async () => {
  const html = await renderedHtml();
  assert.match(html, /查看課綱/);
  assert.match(html, /老師尚未上傳課綱/);
  assert.match(html, /課綱狀態暫時無法確認/);
  assert.match(html, /重新查詢官方資料/);
});
```

- [ ] **Step 2: Confirm Red**

Run: `node --test --test-name-pattern="not-uploaded" tests/rendered-html.test.mjs`

Expected: FAIL because the UI still contains `目前無課綱`.

- [ ] **Step 3: Implement explicit rendering**

```js
function syllabusAction(course) {
  const syllabus = course.syllabus || { status: 'unverified', url: '' };
  if (syllabus.status === 'available') {
    return `<a class="catalog-syllabus" href="${escapeHtml(syllabus.url)}" target="_blank" rel="noopener noreferrer" role="menuitem">查看課綱</a>`;
  }
  if (syllabus.status === 'not_uploaded') {
    return '<button class="catalog-syllabus" type="button" role="menuitem" disabled>老師尚未上傳課綱</button>';
  }
  return `<button class="catalog-syllabus" type="button" role="menuitem" data-refresh-nccu-course="${escapeHtml(course.sectionCode)}">課綱狀態暫時無法確認 · 重新查詢官方資料</button>`;
}
```

Remove all `目前無課綱` branches for official courses.

- [ ] **Step 4: Confirm Green**

Run: `node --test tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.mjs tests/rendered-html.test.mjs
git commit -m "fix: explain official syllabus availability"
```

### Task 7: Verify the real boundary and public flows

**Files:**
- Modify: `tests/nccu-live-contract.test.mjs`
- Modify: `tests/browser/sunbreak-critical-flows.md`

**Interfaces:**
- Verifies the real NCCU response and deployed browser behavior.

- [ ] **Step 1: Add one live contract for a known syllabus**

```js
test('live NCCU HCI course exposes a trusted syllabus link', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '703055001' });
  const candidate = nccuCourseToCandidate(rows.find((row) => row.courseCode === '703055001'));
  assert.equal(candidate.syllabus.status, 'available');
  assert.match(candidate.syllabus.url, /^https:\/\/newdoc\.nccu\.edu\.tw\//);
});
```

- [ ] **Step 2: Run the contract**

Run: `node --test --test-name-pattern="trusted syllabus link" tests/nccu-live-contract.test.mjs`

Expected: PASS against the current official 115-1 endpoint. If NCCU is unavailable, retain the prior successful evidence and report the external boundary failure; do not weaken the assertion.

- [ ] **Step 3: Run the full automated gate**

Run: `npm run verify`

Expected: all unit, rendered HTML, build, lint, and NCCU contract tests pass.

- [ ] **Step 4: Verify in Chrome**

Use a saved legacy candidate without `sourceUrl`, search its nine-digit course code, click `更新官方資料`, and verify:

```text
候選課程仍在課表
鎖定狀態未變
實體／同步／非同步選擇未變
選單顯示「查看課綱」
連結網域為 newdoc.nccu.edu.tw
沒有 console error
```

Also verify a fixture with `not_uploaded` and a forced lookup failure show different copy.

- [ ] **Step 5: Record and commit verification**

Update `tests/browser/sunbreak-critical-flows.md` with date, viewport, exact course code, observed result, and console status.

```bash
git add tests/nccu-live-contract.test.mjs tests/browser/sunbreak-critical-flows.md
git commit -m "test: verify syllabus reconciliation boundary"
```

- [ ] **Step 6: Push the completed phase**

Run: `git push origin feature/sunbreak-redesign`

Expected: remote branch advances; draft PR remains open and unmerged.
