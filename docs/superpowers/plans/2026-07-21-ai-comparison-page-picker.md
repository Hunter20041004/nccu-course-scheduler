# AI 課綱比較頁內選課 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove comparison selection from the candidate catalog and provide a searchable, accessible 2–5 course picker inside the AI syllabus comparison page.

**Architecture:** Keep `comparisonCourseIds` as the single UI selection state and keep the existing Worker, Gemini, ChatGPT, syllabus, and result contracts unchanged. Add one pure `course-comparison-picker.mjs` module for query filtering, maximum-selection enforcement, and deleted-course reconciliation; `app.mjs` owns DOM rendering and events while consuming those pure helpers.

**Tech Stack:** Node.js 22, ES modules, Node test runner, server-rendered HTML/CSS/JavaScript, Cloudflare Workers-compatible Sites build.

## Global Constraints

- Follow vertical TDD: one failing test, minimal implementation, green verification, then refactor before the next test.
- Candidate rows must no longer contain comparison controls or a comparison tray.
- Comparison selection exists only in `AI 功能 → AI 課綱比較`.
- Search matches course title, teacher, or section code and never clears selection.
- Comparison requires 2–5 courses; reaching five disables only unselected courses.
- Gemini, ChatGPT, API Key, profile fields, syllabus retrieval, and result contracts remain unchanged.
- Mobile controls are at least 44px, keyboard accessible, and must not introduce horizontal scrolling.
- Do not persist the comparison search query.
- Execute inline in the current session; do not delegate to subagents.

---

## File Structure

- Create `src/course-comparison-picker.mjs`: pure filtering, toggle-limit, and reconciliation rules.
- Create `tests/course-comparison-picker.test.mjs`: unit coverage for the pure picker rules.
- Modify `src/index.html`: move picker controls from the candidate panel into the AI comparison view and update tutorial copy.
- Modify `src/app.mjs`: render and operate the page-local picker; remove candidate comparison behavior.
- Modify `src/styles.css`: remove candidate comparison styling and add compact responsive picker styling.
- Modify `scripts/build.mjs`: bundle the new pure module before `app.mjs`.
- Modify `package.json`: include the new unit file and syntax check.
- Modify `tests/rendered-html.test.mjs`: verify the rendered interaction contract and responsive accessibility.
- Modify `tests/browser/sunbreak-critical-flows.md`: record desktop/mobile regression results.

---

### Task 1: Move the comparison shell into the AI page

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`
- Modify: `src/app.mjs`

**Interfaces:**
- Consumes: existing IDs `comparison-selected-count`, `course-comparison-status`, `clear-course-comparison`, `open-comparison-profile`, `run-ai-comparison`, and `open-chatgpt-comparison`.
- Produces: `#course-comparison-picker`, `#comparison-course-search`, and `#comparison-course-list` inside `#ai-course-comparison`.

- [ ] **Step 1: Replace the candidate-tray rendering test with a location contract**

```js
test('places comparison selection only inside the AI comparison tool', async () => {
  const html = await (await render()).text();

  assert.doesNotMatch(html, /class="catalog-compare-control"/);
  assert.doesNotMatch(html, /id="course-comparison-tray"/);
  assert.match(html, /id="ai-course-comparison"[\s\S]*id="course-comparison-picker"/);
  assert.match(html, /id="comparison-course-search"[^>]*type="search"/);
  assert.match(html, /id="comparison-course-list"/);
  assert.match(html, /id="comparison-selected-count"/);
  assert.match(html, /id="clear-course-comparison"/);
  assert.match(html, /id="run-ai-comparison"/);
  assert.match(html, /id="open-chatgpt-comparison"/);
});
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `npm run build && node --test --test-name-pattern="places comparison selection only" tests/rendered-html.test.mjs`

Expected: FAIL because the candidate list still renders `.catalog-compare-control` and the comparison tray is outside the AI tool.

- [ ] **Step 3: Move the existing controls into `#ai-course-comparison`**

Remove `#course-comparison-tray` from the candidate panel. Insert this before `#ai-comparison-status`:

```html
<section id="course-comparison-picker" class="course-comparison-picker" aria-labelledby="course-comparison-picker-title">
  <header>
    <div>
      <strong id="course-comparison-picker-title">選擇候選課程</strong>
      <span id="comparison-selected-count">已選 0／5</span>
    </div>
    <button id="clear-course-comparison" type="button">清除選取</button>
  </header>
  <label for="comparison-course-search">搜尋課名、教師或課號
    <input id="comparison-course-search" type="search" autocomplete="off" placeholder="例如：人機互動、韓秉軒或 070426001">
  </label>
  <div id="comparison-course-list" class="comparison-course-list"></div>
  <p id="course-comparison-status" class="form-status" aria-live="polite">再選 2 門就能開始比較。</p>
  <p class="comparison-profile-hint">建議先填寫目標與偏好，比對會更精準。<button id="open-comparison-profile" type="button">前往填寫</button></p>
  <div class="course-comparison-actions">
    <button id="open-chatgpt-comparison" class="button button-quiet" type="button" disabled>帶到 ChatGPT</button>
    <button id="run-ai-comparison" class="button button-primary" type="button" disabled>使用 Gemini 比較</button>
  </div>
</section>
```

Remove the comparison label and `is-comparing` class from the candidate-row template:

```js
return `<article class="catalog-course ${selectedNow ? 'is-selected' : ''}">
  <button class="catalog-select" type="button" data-course-id="${escapeHtml(course.id)}" aria-pressed="${selectedNow}" ${blocked ? 'disabled' : ''}>
```

- [ ] **Step 4: Run the targeted test and verify GREEN**

Run: `npm run build && node --test --test-name-pattern="places comparison selection only" tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 5: Refactor stale candidate markup references and verify GREEN**

Remove the old `const comparing = ...` declaration and keep all non-comparison candidate actions unchanged.

Run: `npm run build && node --test --test-name-pattern="places comparison selection only|candidate course" tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/rendered-html.test.mjs src/index.html src/app.mjs
git commit -m "refactor: move comparison controls into AI tool"
```

---

### Task 2: Add pure course search behavior

**Files:**
- Create: `src/course-comparison-picker.mjs`
- Create: `tests/course-comparison-picker.test.mjs`
- Modify: `scripts/build.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `filterComparisonCourses(courses, query): Course[]`.
- Matching fields: `title`, `teacher`, `sectionCode`, and `id` as a safe fallback.

- [ ] **Step 1: Write one failing unit test for title, teacher, and course-code search**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterComparisonCourses } from '../src/course-comparison-picker.mjs';

const courses = [
  { id: 'hci', title: '智慧人機互動', teacher: '韓秉軒', sectionCode: '070426001' },
  { id: 'nlp', title: '自然語言處理', teacher: '高宏宇', sectionCode: '070427001' },
];

test('filters comparison candidates by title, teacher, or section code', () => {
  assert.deepEqual(filterComparisonCourses(courses, '人機').map(({ id }) => id), ['hci']);
  assert.deepEqual(filterComparisonCourses(courses, '高宏宇').map(({ id }) => id), ['nlp']);
  assert.deepEqual(filterComparisonCourses(courses, ' 070426001 ').map(({ id }) => id), ['hci']);
});
```

- [ ] **Step 2: Run the unit test and verify RED**

Run: `node --test tests/course-comparison-picker.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the minimum pure filter**

```js
const comparisonText = (value) => String(value ?? '').trim().toLocaleLowerCase('zh-Hant');

export function filterComparisonCourses(courses = [], query = '') {
  const term = comparisonText(query);
  if (!term) return courses;
  return courses.filter((course) => [course.title, course.teacher, course.sectionCode, course.id]
    .some((value) => comparisonText(value).includes(term)));
}
```

Add `courseComparisonPicker` to `scripts/build.mjs` and wrap it before `app.mjs`:

```js
const [
  template, styles, nccuPeriods, internshipPlanner, courseData, eligibilityConditions,
  nccuUrl, syllabusState, nccuCourseNotes, courseReconciler, plannerCore, planValidator, plannerStorage, plannerTransfer, plannerUndo, scheduleAgenda, apiKeySession, app,
  aiContracts, courseComparison, geminiClient, nccuCourseAdapter, nccuSyllabus, aiService, worker, aiPlanner, catalogFilters, courseComparisonPicker,
] = await Promise.all([
  read('src/index.html'),
  read('src/styles.css'),
  read('src/nccu-periods.mjs'),
  read('src/internship-planner.mjs'),
  read('src/course-data.mjs'),
  read('src/eligibility-conditions.mjs'),
  read('src/nccu-url.mjs'),
  read('src/syllabus-state.mjs'),
  read('src/nccu-course-notes.mjs'),
  read('src/course-reconciler.mjs'),
  read('src/planner-core.mjs'),
  read('src/plan-validator.mjs'),
  read('src/planner-storage.mjs'),
  read('src/planner-transfer.mjs'),
  read('src/planner-undo.mjs'),
  read('src/schedule-agenda.mjs'),
  read('src/api-key-session.mjs'),
  read('src/app.mjs'),
  read('src/ai-contracts.mjs'),
  read('src/course-comparison.mjs'),
  read('src/gemini-client.mjs'),
  read('src/nccu-course-adapter.mjs'),
  read('src/nccu-syllabus.mjs'),
  read('src/ai-service.mjs'),
  read('src/worker.mjs'),
  read('src/ai-planner.mjs'),
  read('src/catalog-filters.mjs'),
  read('src/course-comparison-picker.mjs'),
]);

// Insert immediately after the catalogFilters wrapper and before aiPlanner/app.
wrapModule(courseComparisonPicker, '__courseComparisonPicker', [
  'filterComparisonCourses',
]),
```

In `package.json`, append the new test file to `test:unit`:

```json
"tests/course-comparison-picker.test.mjs"
```

Append the syntax check to `lint`:

```text
node --check src/course-comparison-picker.mjs
```

- [ ] **Step 4: Run the unit test and verify GREEN**

Run: `node --test tests/course-comparison-picker.test.mjs`

Expected: 1 PASS.

- [ ] **Step 5: Keep normalization private and verify the public API remains one function**

Keep `comparisonText` unexported and keep only `filterComparisonCourses` exported at this stage.

Run: `npm run lint && node --test tests/course-comparison-picker.test.mjs`

Expected: PASS with no syntax errors.

- [ ] **Step 6: Commit**

```bash
git add src/course-comparison-picker.mjs tests/course-comparison-picker.test.mjs scripts/build.mjs package.json
git commit -m "feat: add comparison course search rules"
```

---

### Task 3: Enforce the five-course limit and reconcile deleted courses

**Files:**
- Modify: `src/course-comparison-picker.mjs`
- Modify: `tests/course-comparison-picker.test.mjs`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Produces: `toggleComparisonCourse(ids, courseId, checked, max): { ids: string[], limitReached: boolean }`.
- Produces: `reconcileComparisonCourseIds(ids, courses): string[]`.

- [ ] **Step 1: Write a failing test for adding, removing, and refusing a sixth course**

```js
test('keeps comparison selection within five courses while allowing removal', () => {
  const full = ['1', '2', '3', '4', '5'];
  assert.deepEqual(toggleComparisonCourse(full, '6', true), { ids: full, limitReached: true });
  assert.deepEqual(toggleComparisonCourse(full, '3', false), {
    ids: ['1', '2', '4', '5'],
    limitReached: false,
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test --test-name-pattern="within five courses" tests/course-comparison-picker.test.mjs`

Expected: FAIL because `toggleComparisonCourse` is not exported.

- [ ] **Step 3: Implement the minimum toggle rule**

```js
export function toggleComparisonCourse(ids, courseId, checked, max = 5) {
  const current = [...new Set(ids)];
  if (!checked) return { ids: current.filter((id) => id !== courseId), limitReached: false };
  if (current.includes(courseId)) return { ids: current, limitReached: false };
  if (current.length >= max) return { ids: current, limitReached: true };
  return { ids: [...current, courseId], limitReached: false };
}
```

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test --test-name-pattern="within five courses" tests/course-comparison-picker.test.mjs`

Expected: PASS.

- [ ] **Step 5: Write the next failing test for deleted-course reconciliation**

```js
test('removes comparison ids that are no longer candidate courses', () => {
  assert.deepEqual(
    reconcileComparisonCourseIds(['kept', 'deleted'], [{ id: 'kept' }, { id: 'other' }]),
    ['kept'],
  );
});
```

- [ ] **Step 6: Run and verify RED**

Run: `node --test --test-name-pattern="no longer candidate" tests/course-comparison-picker.test.mjs`

Expected: FAIL because `reconcileComparisonCourseIds` is not exported.

- [ ] **Step 7: Implement reconciliation and expose both helpers to the browser bundle**

```js
export function reconcileComparisonCourseIds(ids, courses) {
  const availableIds = new Set(courses.map(({ id }) => id));
  return [...new Set(ids)].filter((id) => availableIds.has(id));
}
```

Update the `wrapModule(courseComparisonPicker, '__courseComparisonPicker', [...])` export list with all three helper names.

- [ ] **Step 8: Run all picker tests and refactor under green**

Run: `node --test tests/course-comparison-picker.test.mjs`

Expected: all picker tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/course-comparison-picker.mjs tests/course-comparison-picker.test.mjs scripts/build.mjs
git commit -m "feat: enforce AI comparison selection rules"
```

---

### Task 4: Render and operate the searchable picker in the AI page

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/app.mjs`

**Interfaces:**
- Consumes: `filterComparisonCourses`, `toggleComparisonCourse`, `reconcileComparisonCourseIds`.
- Produces: `renderCourseComparisonPicker()` and page-local `input` / `change` handlers.

- [ ] **Step 1: Write a failing rendered-behavior contract**

```js
test('renders and updates the searchable AI comparison picker', async () => {
  const html = await (await render()).text();

  assert.match(html, /let comparisonSearchQuery = ''/);
  assert.match(html, /function renderCourseComparisonPicker\(\)/);
  assert.match(html, /filterComparisonCourses\(courseStore, comparisonSearchQuery\)/);
  assert.match(html, /data-comparison-course="\$\{escapeHtml\(course\.id\)\}"/);
  assert.match(html, /candidateScheduleSummary\(course, dayLabels\)/);
  assert.match(html, /byId\('comparison-course-search'\)\.addEventListener\('input'/);
  assert.match(html, /byId\('comparison-course-list'\)\.addEventListener\('change'/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run build && node --test --test-name-pattern="renders and updates the searchable" tests/rendered-html.test.mjs`

Expected: FAIL because the picker renderer and listeners do not exist.

- [ ] **Step 3: Implement the minimum renderer**

Add `let comparisonSearchQuery = '';` next to `comparisonCourseIds` and replace `renderCourseComparisonTray` with:

```js
function renderCourseComparisonPicker() {
  comparisonCourseIds = reconcileComparisonCourseIds(comparisonCourseIds, courseStore);
  const count = comparisonCourseIds.length;
  const visibleCourses = filterComparisonCourses(courseStore, comparisonSearchQuery);
  const list = byId('comparison-course-list');
  byId('comparison-selected-count').textContent = `已選 ${count}／${MAX_COMPARISON_COURSES}`;
  byId('course-comparison-status').textContent = count < 2
    ? `再選 ${2 - count} 門就能開始比較。`
    : count === MAX_COMPARISON_COURSES
      ? '已選滿 5 門；若要更換，請先取消一門。'
      : `已選 ${count} 門，可以開始比較。`;
  byId('run-ai-comparison').disabled = count < 2;
  byId('open-chatgpt-comparison').disabled = count < 2;
  byId('clear-course-comparison').disabled = count === 0;
  list.innerHTML = !courseStore.length
    ? '<div class="comparison-picker-empty"><strong>尚無候選課程</strong><p>請先到「匯入／新增」加入課程。</p><button class="button button-quiet" type="button" data-open-add-panel>前往匯入／新增</button></div>'
    : !visibleCourses.length
      ? '<p class="comparison-picker-empty">找不到符合的候選課程。</p>'
      : visibleCourses.map((course) => {
          const checked = comparisonCourseIds.includes(course.id);
          const disabled = count >= MAX_COMPARISON_COURSES && !checked;
          return `<label class="comparison-picker-course ${checked ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}">
            <input type="checkbox" data-comparison-course="${escapeHtml(course.id)}" aria-label="選擇 ${escapeHtml(course.title)}進行課綱比較" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
            <span><strong>${escapeHtml(course.title)}</strong><small>${escapeHtml(course.sectionCode || '—')} · ${escapeHtml(course.teacher || '—')}</small><small>${escapeHtml(candidateScheduleSummary(course, dayLabels))}</small></span>
            <b>${course.credits} 學分</b>
          </label>`;
        }).join('');
}
```

Call `renderCourseComparisonPicker()` from `renderAll()` after `renderCatalog()` and remove `renderCourseComparisonTray()` from `renderCatalog()`.

- [ ] **Step 4: Add search and selection events**

```js
byId('comparison-course-search').addEventListener('input', (event) => {
  comparisonSearchQuery = event.target.value;
  renderCourseComparisonPicker();
});

byId('comparison-course-list').addEventListener('change', (event) => {
  const input = event.target.closest('[data-comparison-course]');
  if (!input) return;
  const result = toggleComparisonCourse(comparisonCourseIds, input.dataset.comparisonCourse, input.checked);
  comparisonCourseIds = result.ids;
  renderCourseComparisonPicker();
});
```

Remove the `[data-compare-course]` branch from `catalogList`'s `change` handler. Replace the clear action with:

```js
byId('clear-course-comparison').addEventListener('click', () => {
  comparisonCourseIds = [];
  byId('course-comparison-status').textContent = '已清除課程比較清單。';
  renderCourseComparisonPicker();
});
```

- [ ] **Step 5: Run and verify GREEN**

Run: `npm run build && node --test --test-name-pattern="searchable AI comparison picker|comparison" tests/rendered-html.test.mjs`

Expected: comparison rendered tests PASS.

- [ ] **Step 6: Refactor action status to remain inside the AI page**

In both action handlers, replace the status binding with this exact name while leaving request bodies and result rendering unchanged:

```js
const pickerStatus = byId('course-comparison-status');
```

Use `pickerStatus` for the loading, success, and error messages. Do not assign to `comparisonCourseIds` in either handler.

Run: `npm run build && node --test --test-name-pattern="comparison|ChatGPT" tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/rendered-html.test.mjs src/app.mjs
git commit -m "feat: select comparison courses inside AI tool"
```

---

### Task 5: Polish responsive UX and update instructions

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/styles.css`
- Modify: `src/index.html`
- Modify: `src/app.mjs`

**Interfaces:**
- Consumes: the picker DOM from Task 1 and renderer from Task 4.
- Produces: accessible 44px controls, no horizontal overflow, and accurate tutorial wording.

- [ ] **Step 1: Write the failing accessibility and mobile styling test**

```js
test('keeps the AI comparison picker readable and actionable on phones', async () => {
  const html = await (await render()).text();

  assert.match(html, /\.comparison-picker-course\s*\{[^}]*min-height:\s*56px/s);
  assert.match(html, /\.comparison-picker-course input\s*\{[^}]*min-height:\s*20px/s);
  assert.match(html, /\.comparison-course-list\s*\{[^}]*overflow:\s*auto/s);
  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.course-comparison-actions\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(html, /AI 課綱比較[\s\S]*在比較頁搜尋並勾選 2 至 5 門候選課程/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run build && node --test --test-name-pattern="comparison picker readable" tests/rendered-html.test.mjs`

Expected: FAIL because the new picker styles and tutorial copy are absent.

- [ ] **Step 3: Replace stale styles with the picker design**

```css
.catalog-course { grid-template-columns: minmax(0, 1fr) auto; }
.course-comparison-picker { display: grid; gap: 10px; border: 1px solid #C8BCE0; border-radius: var(--radius-control); background: linear-gradient(145deg, var(--surface), var(--violet-soft)); padding: 12px; }
.course-comparison-picker > header, .course-comparison-picker > header > div { display: flex; align-items: center; gap: 8px; }
.course-comparison-picker > header { justify-content: space-between; }
.course-comparison-picker > header span { color: var(--violet); font-size: .68rem; font-weight: 850; font-variant-numeric: tabular-nums; }
.course-comparison-picker > header button, .comparison-profile-hint button { min-height: 44px; border: 0; border-radius: 6px; background: transparent; color: var(--violet); padding: 0 8px; cursor: pointer; font-size: .65rem; font-weight: 850; }
.comparison-course-list { display: grid; max-height: min(42vh, 360px); overflow: auto; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); scrollbar-gutter: stable; }
.comparison-picker-course { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; min-height: 56px; align-items: center; gap: 8px; border-bottom: 1px solid var(--line); padding: 7px 9px; cursor: pointer; }
.comparison-picker-course:last-child { border-bottom: 0; }
.comparison-picker-course input { width: 20px; min-height: 20px; accent-color: var(--violet); }
.comparison-picker-course span { display: grid; min-width: 0; gap: 2px; }
.comparison-picker-course strong, .comparison-picker-course small { overflow-wrap: anywhere; }
.comparison-picker-course small { color: var(--muted); font-size: .63rem; }
.comparison-picker-course b { font-size: .66rem; white-space: nowrap; }
.comparison-picker-course.is-selected { background: var(--violet-soft); color: #563092; }
.comparison-picker-course.is-disabled { cursor: not-allowed; opacity: .48; }
.comparison-picker-empty { display: grid; place-items: center; gap: 8px; min-height: 120px; margin: 0; padding: 18px; color: var(--muted); text-align: center; }
```

Remove `.catalog-compare-control`, `.catalog-course.is-comparing`, and `.course-comparison-tray` rules. At `max-width: 640px`, set `.course-comparison-actions { grid-template-columns: 1fr; }` and `.comparison-picker-course { grid-template-columns: 24px minmax(0, 1fr); }` with `.comparison-picker-course > b { grid-column: 2; }`.

- [ ] **Step 4: Update tutorial and quick-tour wording**

In the AI comparison tutorial section, replace the candidate-page instruction with:

```html
<li><strong>選擇課程：</strong>進入「AI 功能 → AI 課綱比較」，在比較頁搜尋並勾選 2 至 5 門候選課程。</li>
```

Keep the ChatGPT fallback explanation and update the quick-tour AI step to say selection happens inside the comparison tool.

Replace the AI quick-tour entry with:

```js
{ target: 'ai-feature-hub', tab: 'ai', aiTool: 'hub', compactView: 'tools', title: 'AI 功能', body: '先選擇「AI 排課推薦」或「AI 課綱比較」。推薦會依最低學分與實習偏好產生三個無衝堂方案；比較可在工具內搜尋並勾選 2 至 5 門候選課程。個人資料皆為選填，未填仍可客觀比較。' },
```

- [ ] **Step 5: Run and verify GREEN, then refactor selectors**

Run: `npm run build && node --test --test-name-pattern="comparison picker readable|tutorial|comparison" tests/rendered-html.test.mjs`

Expected: PASS. Confirm these removed selectors have zero matches:

Run: `rg -n 'catalog-compare-control|catalog-course\.is-comparing|course-comparison-tray' src tests`

Expected: no output. Do not alter the established Sunbreak palette.

- [ ] **Step 6: Commit**

```bash
git add tests/rendered-html.test.mjs src/styles.css src/index.html src/app.mjs
git commit -m "style: polish AI comparison course picker"
```

---

### Task 6: Full regression, browser QA, and release readiness

**Files:**
- Modify: `tests/browser/sunbreak-critical-flows.md`

**Interfaces:**
- Consumes: the complete comparison picker implementation.
- Produces: repeatable automated and browser verification evidence.

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`

Expected: all unit tests, build checks, and rendered HTML tests PASS.

- [ ] **Step 2: Run syntax and live NCCU contract checks**

Run: `npm run lint && npm run test:contract:nccu && git diff --check`

Expected: all checks PASS. If the live NCCU endpoint is unavailable, record the exact contract failure separately and do not weaken the test.

- [ ] **Step 3: Test the desktop critical flow in Chrome**

Start the local server with `npm run dev`, open the shown local URL, and verify:

1. Candidate rows have no comparison checkbox or comparison tray.
2. AI 功能 → AI 課綱比較 shows the full searchable candidate list.
3. Search by title, teacher, and section code narrows the list without clearing selected courses.
4. One selected course keeps Gemini and ChatGPT disabled; two enables them; five disables only unselected courses.
5. Clearing restores all controls.
6. Deleting a selected candidate removes it from the comparison count.
7. Returning to the AI hub and back preserves selection.
8. Missing API Key opens the existing setup dialog and preserves selection.
9. Candidate add/remove, detail, syllabus, lock, delete, and filters still work.
10. Browser console contains no errors.

- [ ] **Step 4: Test the mobile critical flow**

Repeat at a 390 × 844 viewport and verify no horizontal scrolling, all picker rows and actions have comfortable touch targets, long names wrap, and both empty states are readable.

- [ ] **Step 5: Record the evidence**

Append a dated section to `tests/browser/sunbreak-critical-flows.md` with desktop/mobile viewport, actions performed, observed results, and console status.

- [ ] **Step 6: Commit the QA record**

```bash
git add tests/browser/sunbreak-critical-flows.md
git commit -m "test: verify AI comparison picker flows"
```

- [ ] **Step 7: Push the validated Main branch**

```bash
git push origin main
```

Expected: remote `main` points to the same commit as local `HEAD`.
