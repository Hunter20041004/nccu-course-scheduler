# Empty Workspace and NCCU Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give new visitors an empty personal planner while preserving existing browser data, add bulk candidate clearing, and let users search and import NCCU 115-1 courses directly.

**Architecture:** Keep personal planner data in the existing origin-scoped `localStorage`; only hydrate the legacy built-in catalog when a saved planner state exists. Put official URL/normalization/conversion logic in `nccu-course-adapter.mjs`, expose it to the browser bundle, and have `app.mjs` own UI state and direct CORS requests to NCCU.

**Tech Stack:** Vanilla HTML/CSS/JavaScript ES modules, Node 22 built-in test runner, existing Worker build pipeline, official NCCU JSON search endpoint.

## Global Constraints

- New browsers with no `nccu-course-planner:v3` state must start with zero candidates and zero selected courses.
- Existing parseable state on the same origin must continue to restore the prior catalog, selection, locks, options, profile, conditions and internship settings.
- Search term is fixed to `115-1`; official search needs no Gemini API key.
- Search and manual/AI imports must deduplicate by nine-digit `sectionCode`.
- Bulk clearing removes candidates, selected courses, locks and course options, but preserves profile, custom conditions and internship settings.
- Every behavior change follows one Red → Green → Refactor vertical slice before the next behavior.
- Interactive controls must be keyboard accessible and at least 44px tall on touch layouts.

---

### Task 1: Empty Startup With Legacy State Restoration

**Files:**
- Modify: `src/planner-storage.mjs`
- Modify: `src/app.mjs`
- Modify: `scripts/build.mjs`
- Test: `tests/planner-storage.test.mjs`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `buildCandidateCatalog(officialCourses, addedCourses, deletedCourseIds)` from `planner-core.mjs`.
- Produces: `createStartupCatalog(savedState, officialCourses): Course[]`.

- [ ] **Step 1: Write the failing startup-catalog test**

```js
import { createStartupCatalog } from '../src/planner-storage.mjs';

test('starts new visitors empty but rebuilds the legacy catalog for saved users', () => {
  const official = [{ id: 'hci', title: '人機互動' }];
  const manual = { id: 'manual-1', title: '社團', source: 'manual' };
  assert.deepEqual(createStartupCatalog(null, official), []);
  assert.deepEqual(createStartupCatalog({ addedCourses: [manual], deletedCourseIds: [] }, official), [official[0], manual]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/planner-storage.test.mjs`  
Expected: FAIL because `createStartupCatalog` is not exported.

- [ ] **Step 3: Implement the minimal startup helper and empty app defaults**

```js
// src/planner-storage.mjs
import { buildCandidateCatalog } from './planner-core.mjs';

export function createStartupCatalog(savedState, officialCourses) {
  if (!savedState) return [];
  return buildCandidateCatalog(
    officialCourses,
    savedState.addedCourses || savedState.manualCourses,
    savedState.deletedCourseIds,
  );
}

// src/app.mjs
let courseStore = [];
let selected = [];
// inside restoreState:
courseStore = createStartupCatalog(saved, courses);
```

Add `createStartupCatalog` to the planner-storage exports in `scripts/build.mjs`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/planner-storage.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Add a rendered-bundle regression test**

```js
test('starts a new browser with an empty personal workspace', async () => {
  const html = await (await render()).text();
  assert.match(html, /let courseStore = \[\];/);
  assert.match(html, /let selected = \[\];/);
  assert.match(html, /createStartupCatalog\(saved, courses\)/);
  assert.doesNotMatch(html, /let selected = applyPreset/);
});
```

- [ ] **Step 6: Build and run the rendered test**

Run: `npm run build && node --test tests/rendered-html.test.mjs`  
Expected: PASS, after updating the old `23 門候選課程` expectation to the neutral heading `候選課程`.

- [ ] **Step 7: Commit the startup slice**

```bash
git add src/planner-storage.mjs src/app.mjs scripts/build.mjs tests/planner-storage.test.mjs tests/rendered-html.test.mjs
git commit -m "feat: start new planners with an empty workspace"
```

### Task 2: Bulk Candidate Clearing

**Files:**
- Modify: `src/planner-core.mjs`
- Modify: `src/app.mjs`
- Modify: `src/index.html`
- Modify: `src/styles.css`
- Modify: `scripts/build.mjs`
- Test: `tests/planner-core.test.mjs`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: `clearCandidateCatalog(): { courseStore: [], selected: [], lockedCourseIds: [], courseOptions: {} }`.
- Consumed by: `#clear-candidates` click handler in `app.mjs`.

- [ ] **Step 1: Write the failing bulk-clear test**

```js
test('clears candidates and all course-linked planner state', () => {
  assert.deepEqual(core.clearCandidateCatalog(), {
    courseStore: [], selected: [], lockedCourseIds: [], courseOptions: {},
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/planner-core.test.mjs`  
Expected: FAIL because `clearCandidateCatalog` does not exist.

- [ ] **Step 3: Implement the pure clear operation**

```js
export function clearCandidateCatalog() {
  return { courseStore: [], selected: [], lockedCourseIds: [], courseOptions: {} };
}
```

Add the export to `scripts/build.mjs`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/planner-core.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Write the failing UI contract test**

```js
test('offers a destructive bulk candidate clear without restoring author courses', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="clear-candidates"[^>]*>清空候選課程<\/button>/);
  assert.match(html, /clearCandidateCatalog\(\)/);
  assert.match(html, /確定清空全部候選課程/);
  assert.doesNotMatch(html, /恢復建議方案/);
});
```

- [ ] **Step 6: Implement the accessible button, confirmation and empty state**

```js
byId('clear-candidates').addEventListener('click', () => {
  if (!courseStore.length) return;
  if (!window.confirm('確定清空全部候選課程嗎？已排入課表與鎖定的課程也會移除。')) return;
  ({ courseStore, selected, lockedCourseIds, courseOptions } = clearCandidateCatalog());
  byId('catalog-status').textContent = '已清空候選課程；你的選課條件與實習設定仍保留。';
  persistState();
  renderAll();
});
```

Replace `#reset-plan` with `#clear-candidates`, remove its restore handler, render an empty catalog message linking to the add tab, and style the control with the existing danger semantics and a 44px minimum height.

- [ ] **Step 7: Build and run UI tests**

Run: `npm run build && node --test tests/rendered-html.test.mjs`  
Expected: PASS.

- [ ] **Step 8: Commit the clear slice**

```bash
git add src/planner-core.mjs src/app.mjs src/index.html src/styles.css scripts/build.mjs tests/planner-core.test.mjs tests/rendered-html.test.mjs
git commit -m "feat: clear the candidate catalog in one action"
```

### Task 3: Official NCCU Course Conversion and Deduplication

**Files:**
- Modify: `src/nccu-course-adapter.mjs`
- Modify: `src/ai-service.mjs`
- Modify: `scripts/build.mjs`
- Test: `tests/nccu-course-adapter.test.mjs`

**Interfaces:**
- Produces: `nccuCourseToCandidate(course): CandidateCourse`.
- Produces: `candidateIncludesCourseCode(courseStore, courseCode): boolean`.
- Consumed by: screenshot import service and browser search UI.

- [ ] **Step 1: Write the failing conversion test**

```js
test('converts official periods and restrictions into a schedulable conditional candidate', () => {
  const candidate = nccuCourseToCandidate({
    courseCode: '509041001', title: '德國文學概論', teacher: '蔡莫妮', credits: 2,
    scheduleText: '四78', restrictionText: '僅限歐文系及雙主修學生修讀。', available: true,
    sourceUrl: 'https://newdoc.nccu.edu.tw/example.html',
  });
  assert.equal(candidate.sectionCode, '509041001');
  assert.deepEqual(candidate.meetings.map(({ day, label }) => ({ day, label })), [{ day: 4, label: '四78' }]);
  assert.equal(candidate.eligibilityRules[0].conditionId, 'official-restriction:509041001');
});
```

- [ ] **Step 2: Run the adapter test and verify RED**

Run: `node --test tests/nccu-course-adapter.test.mjs`  
Expected: FAIL because `nccuCourseToCandidate` is not exported.

- [ ] **Step 3: Move the existing pure conversion helpers into the adapter**

Export `meetingsFromNccuText`, `eligibilityRuleFromOfficialRestriction`, and `nccuCourseToCandidate`. Keep the existing normalized candidate shape, but change the conditions copy to `由政大 115-1 公開課程資料匯入` so it is correct for both screenshot and direct search. Import and use `nccuCourseToCandidate` from `ai-service.mjs` instead of its private `officialToCandidate`.

- [ ] **Step 4: Run adapter and AI service tests**

Run: `node --test tests/nccu-course-adapter.test.mjs tests/ai-service.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Write the failing cross-source duplicate test**

```js
test('detects an existing NCCU section code regardless of import source', () => {
  assert.equal(candidateIncludesCourseCode([
    { id: 'hci', sectionCode: '703055001', source: 'built-in' },
  ], '703055001'), true);
  assert.equal(candidateIncludesCourseCode([], '703055001'), false);
});
```

- [ ] **Step 6: Implement code-based duplicate detection**

```js
export function candidateIncludesCourseCode(courseStore, courseCode) {
  const normalized = String(courseCode || '').trim();
  return Boolean(normalized) && courseStore.some((course) => String(course.sectionCode || '').trim() === normalized);
}
```

- [ ] **Step 7: Run tests and commit the adapter slice**

Run: `node --test tests/nccu-course-adapter.test.mjs tests/ai-service.test.mjs`  
Expected: PASS.

```bash
git add src/nccu-course-adapter.mjs src/ai-service.mjs scripts/build.mjs tests/nccu-course-adapter.test.mjs tests/ai-service.test.mjs
git commit -m "refactor: share verified nccu course conversion"
```

### Task 4: Search and Import NCCU 115-1 Courses

**Files:**
- Modify: `src/index.html`
- Modify: `src/styles.css`
- Modify: `src/app.mjs`
- Modify: `scripts/build.mjs`
- Test: `tests/rendered-html.test.mjs`
- Test: `tests/nccu-live-contract.test.mjs`

**Interfaces:**
- Consumes: `searchNccuCourses({ term: '115-1', keyword })`.
- Consumes: `nccuCourseToCandidate(result)` and `candidateIncludesCourseCode(courseStore, result.courseCode)`.
- Produces: accessible `#nccu-course-search-form`, `#nccu-course-results`, and add buttons with `data-add-nccu-course`.

- [ ] **Step 1: Write the failing rendered UI contract test**

```js
test('searches and imports official NCCU 115-1 courses without an AI key', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="nccu-course-search-form"/);
  assert.match(html, /id="nccu-course-query"/);
  assert.match(html, /id="nccu-course-results"/);
  assert.match(html, /searchNccuCourses\(\{ term: '115-1', keyword: query \}\)/);
  assert.match(html, /data-add-nccu-course/);
  assert.match(html, /nccuCourseToCandidate/);
});
```

- [ ] **Step 2: Build and verify RED**

Run: `npm run build && node --test tests/rendered-html.test.mjs`  
Expected: FAIL because the official search form is absent.

- [ ] **Step 3: Add the search markup and client bundle exports**

Add this section before the manual form:

```html
<section class="nccu-search-section">
  <h2>政大 115-1 課程庫</h2>
  <p>直接搜尋課名、教師或九碼課號，不需要 API Key。</p>
  <form id="nccu-course-search-form" class="nccu-search-form" role="search">
    <label for="nccu-course-query">搜尋官方課程</label>
    <div><input id="nccu-course-query" type="search" autocomplete="off" placeholder="例如：人機互動"><button class="button button-primary" type="submit">搜尋</button></div>
    <p id="nccu-course-search-status" class="form-status" aria-live="polite"></p>
  </form>
  <div id="nccu-course-results" class="nccu-course-results" aria-live="polite"></div>
</section>
```

Wrap the adapter into the browser script before `app.mjs` and export `searchNccuCourses`, `nccuCourseToCandidate`, and `candidateIncludesCourseCode`.

- [ ] **Step 4: Add search state, rendering and submit behavior**

```js
let nccuSearchResults = [];

byId('nccu-course-search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = byId('nccu-course-query').value.trim();
  const status = byId('nccu-course-search-status');
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  if (!query) { status.textContent = '請輸入課名、教師或九碼課號。'; return; }
  submit.disabled = true;
  status.textContent = '正在查詢政大 115-1 課程庫…';
  try {
    nccuSearchResults = await searchNccuCourses({ term: '115-1', keyword: query });
    status.textContent = nccuSearchResults.length ? `找到 ${nccuSearchResults.length} 門課。` : '找不到符合的課程，請改用較短的課名或教師姓名。';
    renderNccuSearchResults();
  } catch {
    status.textContent = '政大課程資料暫時無法查詢，請稍後重試。';
  } finally { submit.disabled = false; }
});
```

Render semantic result articles with title, teacher, code, credits, schedule, restriction, official outline link, and a 44px `加入候選` button. On `data-add-nccu-course`, convert the row, skip duplicates by section code, append it, persist, render all panels, and announce success.

- [ ] **Step 5: Style loading, results, mobile layout and empty catalog CTA**

Use the existing `--canvas`, `--line`, `--ink`, `--muted`, `--primary` and radius tokens. Keep one-column results, visible focus rings, wrapping restriction text, no horizontal overflow, and `min-height: 44px` for search/add controls.

- [ ] **Step 6: Build and run all rendered tests**

Run: `npm run build && node --test tests/rendered-html.test.mjs`  
Expected: PASS.

- [ ] **Step 7: Extend the real NCCU contract test**

```js
test('live NCCU 115-1 search returns a course that can become a scheduler candidate', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '人機互動' });
  const candidate = nccuCourseToCandidate(rows.find((row) => row.courseCode === '703055001'));
  assert.equal(candidate.sectionCode, '703055001');
  assert.ok(candidate.meetings.length > 0);
});
```

- [ ] **Step 8: Run the real boundary test and commit**

Run: `npm run test:contract:nccu`  
Expected: PASS with live 115-1 results.

```bash
git add src/index.html src/styles.css src/app.mjs scripts/build.mjs tests/rendered-html.test.mjs tests/nccu-live-contract.test.mjs
git commit -m "feat: search the official nccu course catalog"
```

### Task 5: Documentation, Browser QA and Public Deployment

**Files:**
- Modify: `src/index.html`
- Modify: `README.md`
- Test: `tests/portfolio-release.test.mjs`

**Interfaces:**
- Consumes the completed empty-workspace, official-search and clear-candidate flows.
- Produces public instructions and verified deployments.

- [ ] **Step 1: Write the failing documentation contract test**

```js
test('documents the empty personal workspace and official search flow', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /新訪客.*空白/);
  assert.match(readme, /政大 115-1.*搜尋/);
  assert.match(readme, /同一.*網址.*瀏覽器/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/portfolio-release.test.mjs`  
Expected: FAIL because the new workflow is not documented.

- [ ] **Step 3: Update the tutorial center and README**

Explain the three candidate-entry methods, that official search does not need an API key, that new visitors start empty, and that saved data is origin-scoped. Remove copy implying the 23 author courses are a public default.

- [ ] **Step 4: Run complete automated verification**

Run: `npm run verify`  
Expected: unit tests, build, rendered HTML tests, lint, and live NCCU contract all PASS.

- [ ] **Step 5: Run desktop and mobile browser flows**

Using Playwright CLI or Chrome:

1. Clear the planner storage key and reload; verify zero candidates and zero course blocks.
2. Search `人機互動`; verify official results and add `703055001`.
3. Add it to the schedule; reload; verify it remains.
4. Search the same course; verify `已加入` is disabled.
5. Clear candidates; verify candidate list, schedule, locks and options are empty while internship settings remain.
6. Repeat the core search/add flow in a mobile viewport with no horizontal overflow or clipped controls.

- [ ] **Step 6: Commit documentation**

```bash
git add src/index.html README.md tests/portfolio-release.test.mjs
git commit -m "docs: explain personal course catalog setup"
```

- [ ] **Step 7: Push and verify public deployment**

Run:

```bash
git push origin feature/sunbreak-redesign:main
gh run watch --repo Hunter20041004/nccu-course-scheduler --exit-status
curl -I -L --max-time 30 https://hunter20041004.github.io/nccu-course-scheduler/
```

Expected: GitHub Actions succeeds and the public URL returns HTTP 200. Confirm the deployed HTML includes `nccu-course-search-form`, `clear-candidates`, and the empty-workspace startup code.
