# Candidate Multi-Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an expandable multi-select filter bar that lets students combine candidate status, weekday, daypart, and keyword filters without breaking existing candidate-course actions.

**Architecture:** Add a dependency-free `src/catalog-filters.mjs` pure-function module that receives courses plus explicit filter state and returns matching courses. Keep browser control state in native checkboxes inside `src/index.html`; `src/app.mjs` reads those controls, calls the pure filter, updates the active-count badge, and renders the existing rows unchanged.

**Tech Stack:** Browser-native HTML/CSS/JavaScript modules, Node.js built-in test runner, custom static/worker bundler, Sites hosting.

## Global Constraints

- Follow Red → Green → Refactor one failing test at a time.
- Keep exactly one expandable filter panel; add no modal and no dependency.
- Status options are `selected`, `remote`, and `review`.
- Weekday options are integer days `1` through `7`.
- Daypart options are `morning`, `afternoon`, `evening`, and `flexible`.
- Same-group selections use OR; different groups and keyword search use AND.
- When weekday and daypart are active, the same fixed meeting must satisfy both.
- Morning is 06:10–12:00, afternoon 12:10–18:00, and evening 18:10–22:00; overlap, not start time, determines a match.
- `attendance === 'async'` and courses without fixed meetings match `flexible`; `asyncAllowed` alone does not.
- Closing the panel preserves checked filters; reloading resets them.
- Preserve all existing add/remove, details, lock, delete, syllabus, attendance, and scheduling behavior.
- All controls use native semantics, visible focus, and at least 44px effective touch targets.

---

### Task 1: Filter one weekday with a pure function

**Files:**
- Create: `src/catalog-filters.mjs`
- Create: `tests/catalog-filters.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: courses shaped with `id`, optional `schedule`, and optional `meetings`.
- Produces: `filterCandidateCourses(courses, filters): course[]`.

- [ ] **Step 1: Write the first failing weekday test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCandidateCourses } from '../src/catalog-filters.mjs';

test('keeps only courses meeting on one selected weekday', () => {
  const courses = [
    { id: 'tue', schedule: { day: 2, start: 490, end: 600 } },
    { id: 'thu', schedule: { day: 4, start: 610, end: 720 } },
    { id: 'flexible' },
  ];

  assert.deepEqual(
    filterCandidateCourses(courses, { weekdays: [4] }).map(({ id }) => id),
    ['thu'],
  );
});
```

Add `tests/catalog-filters.test.mjs` to `test:unit` in `package.json` immediately before `tests/planner-core.test.mjs`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/catalog-filters.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/catalog-filters.mjs`.

- [ ] **Step 3: Add the minimum weekday implementation**

Create `src/catalog-filters.mjs`:

```js
function fixedMeetings(course = {}) {
  if (course.attendance === 'async') return [];
  if (course.meetings?.length) return course.meetings;
  return course.schedule ? [course.schedule] : [];
}

export function filterCandidateCourses(courses = [], filters = {}) {
  const weekday = Number(filters.weekdays?.[0]);
  return courses.filter((course) => (
    !Number.isFinite(weekday)
    || fixedMeetings(course).some((meeting) => Number(meeting.day) === weekday)
  ));
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Step 2 command. Expected: 1 test passes, 0 fails.

- [ ] **Step 5: Commit the weekday slice**

```bash
git add package.json src/catalog-filters.mjs tests/catalog-filters.test.mjs
git commit -m "feat: filter candidates by weekday"
```

### Task 2: Support weekday OR and exact daypart overlap

**Files:**
- Modify: `src/catalog-filters.mjs`
- Modify: `tests/catalog-filters.test.mjs`

**Interfaces:**
- Extends: `filterCandidateCourses(courses, { weekdays, dayparts })`.
- Produces: same-meeting weekday/daypart matching with official NCCU time boundaries.

- [ ] **Step 1: Add one failing multiple-weekday test**

```js
test('treats multiple weekdays as any selected weekday', () => {
  const courses = [
    { id: 'mon', schedule: { day: 1, start: 490, end: 600 } },
    { id: 'tue', schedule: { day: 2, start: 490, end: 600 } },
    { id: 'thu', schedule: { day: 4, start: 610, end: 720 } },
  ];

  assert.deepEqual(
    filterCandidateCourses(courses, { weekdays: [2, 4] }).map(({ id }) => id),
    ['tue', 'thu'],
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test --test-name-pattern="multiple weekdays" tests/catalog-filters.test.mjs
```

Expected: FAIL because the first slice only reads the first selected weekday.

- [ ] **Step 3: Normalize weekday values**

Replace the weekday set declaration with:

```js
const weekdays = new Set((filters.weekdays || []).map(Number).filter(Number.isFinite));
```

- [ ] **Step 4: Rerun the focused test and verify GREEN**

Run the Step 2 command. Expected: 1 matching test passes.

- [ ] **Step 5: Add one failing same-meeting daypart test**

```js
test('requires weekday and daypart to match the same fixed meeting', () => {
  const courses = [{
    id: 'split',
    meetings: [
      { day: 2, start: 490, end: 600 },
      { day: 4, start: 790, end: 900 },
    ],
  }];

  assert.deepEqual(filterCandidateCourses(courses, {
    weekdays: [2],
    dayparts: ['afternoon'],
  }), []);
  assert.deepEqual(filterCandidateCourses(courses, {
    weekdays: [4],
    dayparts: ['afternoon'],
  }).map(({ id }) => id), ['split']);
});
```

- [ ] **Step 6: Run the daypart test and verify RED**

Run:

```bash
node --test --test-name-pattern="same fixed meeting" tests/catalog-filters.test.mjs
```

Expected: FAIL because `dayparts` is not implemented.

- [ ] **Step 7: Implement official daypart windows and same-meeting matching**

Add above the exported function:

```js
export const CATALOG_DAYPARTS = Object.freeze({
  morning: { start: 370, end: 720 },
  afternoon: { start: 730, end: 1080 },
  evening: { start: 1090, end: 1320 },
});

function overlapsWindow(meeting, window) {
  return meeting.start < window.end && window.start < meeting.end;
}

function meetingMatches(meeting, weekdays, dayparts, fixedDayparts) {
  const weekdayMatches = !weekdays.size || weekdays.has(Number(meeting.day));
  const daypartMatches = !dayparts.size || fixedDayparts.some((daypart) => (
    overlapsWindow(meeting, CATALOG_DAYPARTS[daypart])
  ));
  return weekdayMatches && daypartMatches;
}
```

Replace the filter body with:

```js
const weekdays = new Set((filters.weekdays || []).map(Number).filter(Number.isFinite));
const dayparts = new Set(filters.dayparts || []);
const fixedDayparts = [...dayparts].filter((daypart) => CATALOG_DAYPARTS[daypart]);
return courses.filter((course) => {
  const meetings = fixedMeetings(course);
  if (!weekdays.size && !dayparts.size) return true;
  return meetings.some((meeting) => meetingMatches(meeting, weekdays, dayparts, fixedDayparts));
});
```

- [ ] **Step 8: Run all catalog-filter tests and verify GREEN**

```bash
node --test tests/catalog-filters.test.mjs
```

Expected: all tests pass.

- [ ] **Step 9: Commit the meeting slice**

```bash
git add src/catalog-filters.mjs tests/catalog-filters.test.mjs
git commit -m "feat: filter candidates by daypart"
```

### Task 3: Model flexible time without confusing async capability

**Files:**
- Modify: `src/catalog-filters.mjs`
- Modify: `tests/catalog-filters.test.mjs`

**Interfaces:**
- Extends: daypart `flexible`.
- Produces: explicit separation between chosen async attendance, missing fixed time, and mere async capability.

- [ ] **Step 1: Write the failing flexible-time test**

```js
test('matches chosen asynchronous and time-undecided courses but not async capability alone', () => {
  const courses = [
    { id: 'chosen-async', attendance: 'async', asyncAllowed: true, schedule: { day: 2, start: 490, end: 600 } },
    { id: 'undecided' },
    { id: 'capable-only', asyncAllowed: true, schedule: { day: 4, start: 790, end: 900 } },
  ];

  assert.deepEqual(
    filterCandidateCourses(courses, { dayparts: ['flexible'] }).map(({ id }) => id),
    ['chosen-async', 'undecided'],
  );
  assert.deepEqual(
    filterCandidateCourses(courses, { weekdays: [2], dayparts: ['flexible'] }),
    [],
  );
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
node --test --test-name-pattern="async capability alone" tests/catalog-filters.test.mjs
```

Expected: FAIL because flexible courses are not included.

- [ ] **Step 3: Implement flexible matching**

Inside the course filter, replace the final meeting return with:

```js
const flexibleMatches = dayparts.has('flexible') && meetings.length === 0;
if (weekdays.size) {
  return meetings.some((meeting) => meetingMatches(meeting, weekdays, dayparts, fixedDayparts));
}
return flexibleMatches
  || meetings.some((meeting) => meetingMatches(meeting, weekdays, dayparts, fixedDayparts));
```

This keeps a flexible course out when a weekday is also required because it has no fixed day.

- [ ] **Step 4: Run the flexible test and verify GREEN**

Run the Step 2 command. Expected: 1 matching test passes.

- [ ] **Step 5: Commit the flexible slice**

```bash
git add src/catalog-filters.mjs tests/catalog-filters.test.mjs
git commit -m "feat: filter flexible candidate times"
```

### Task 4: Combine status filters, keyword search, and active count

**Files:**
- Modify: `src/catalog-filters.mjs`
- Modify: `tests/catalog-filters.test.mjs`

**Interfaces:**
- Consumes: `query`, `selectedIds`, `eligibilityStatuses`, `statuses`, `weekdays`, and `dayparts`.
- Produces: `filterCandidateCourses(...)` and `countActiveCatalogFilters(filters): number`.

- [ ] **Step 1: Add one failing status-combination test**

```js
test('uses OR within status and AND between status weekday and daypart groups', () => {
  const courses = [
    { id: 'selected-tue-am', title: '產品設計', schedule: { day: 2, start: 490, end: 600 } },
    { id: 'remote-thu-pm', title: '人工智慧', asyncAllowed: true, schedule: { day: 4, start: 790, end: 900 } },
    { id: 'review-thu-pm', title: '金融科技', schedule: { day: 4, start: 790, end: 900 } },
  ];

  assert.deepEqual(filterCandidateCourses(courses, {
    selectedIds: ['selected-tue-am'],
    eligibilityStatuses: { 'review-thu-pm': 'review' },
    statuses: ['remote', 'review'],
    weekdays: [4],
    dayparts: ['afternoon'],
  }).map(({ id }) => id), ['remote-thu-pm', 'review-thu-pm']);
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
node --test --test-name-pattern="OR within status" tests/catalog-filters.test.mjs
```

Expected: FAIL because status filtering is not implemented.

- [ ] **Step 3: Implement status OR before schedule matching**

At the start of the exported function add:

```js
const statuses = new Set(filters.statuses || []);
const selectedIds = new Set(filters.selectedIds || []);
const eligibilityStatuses = filters.eligibilityStatuses || {};
```

At the beginning of each course predicate add:

```js
const statusMatches = !statuses.size || [...statuses].some((status) => (
  (status === 'selected' && selectedIds.has(course.id))
  || (status === 'remote' && course.asyncAllowed === true)
  || (status === 'review' && eligibilityStatuses[course.id] === 'review')
));
if (!statusMatches) return false;
```

- [ ] **Step 4: Run the status test and verify GREEN**

Run the Step 2 command. Expected: 1 matching test passes.

- [ ] **Step 5: Add one failing keyword-and-count test**

```js
test('combines normalized keyword search and counts individual checked filters', () => {
  const courses = [
    { id: 'hci', title: '人機互動', teacher: '廖文宏', sectionCode: '703055001' },
    { id: 'finance', title: '金融科技導論', teacher: '張智星', sectionCode: '070424001' },
  ];

  assert.deepEqual(
    filterCandidateCourses(courses, { query: '703055001' }).map(({ id }) => id),
    ['hci'],
  );
  assert.equal(countActiveCatalogFilters({
    statuses: ['selected'], weekdays: [2, 4], dayparts: ['afternoon'],
  }), 4);
});
```

Update the import at the top of `tests/catalog-filters.test.mjs` to:

```js
import {
  countActiveCatalogFilters,
  filterCandidateCourses,
} from '../src/catalog-filters.mjs';
```

- [ ] **Step 6: Run the keyword-and-count test and verify RED**

```bash
node --test --test-name-pattern="normalized keyword" tests/catalog-filters.test.mjs
```

Expected: FAIL because `countActiveCatalogFilters` is not exported and query is not applied.

- [ ] **Step 7: Implement query and active count**

Add above the exported filter:

```js
export function countActiveCatalogFilters(filters = {}) {
  return ['statuses', 'weekdays', 'dayparts']
    .reduce((total, key) => total + new Set(filters[key] || []).size, 0);
}
```

At the start of the filter function add:

```js
const query = String(filters.query || '').trim().toLowerCase();
```

At the start of each predicate add:

```js
const haystack = `${course.title || ''} ${course.teacher || ''} ${course.sectionCode || ''}`.toLowerCase();
if (query && !haystack.includes(query)) return false;
```

- [ ] **Step 8: Run all catalog-filter tests and verify GREEN**

```bash
node --test tests/catalog-filters.test.mjs
```

Expected: all tests pass.

- [ ] **Step 9: Refactor repeated set construction and rerun**

Keep set construction once per function call, not inside the course loop. Run Step 8 again and expect all tests to remain green.

- [ ] **Step 10: Commit the compound-filter slice**

```bash
git add src/catalog-filters.mjs tests/catalog-filters.test.mjs
git commit -m "feat: combine candidate filters"
```

### Task 5: Add the expandable accessible filter panel

**Files:**
- Modify: `src/index.html`
- Modify: `src/styles.css`
- Modify: `src/app.mjs`
- Modify: `scripts/build.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `filterCandidateCourses`, `countActiveCatalogFilters`, existing `renderCatalog()`, selected courses, and eligibility results.
- Produces: `#catalog-filter-toggle`, `#catalog-filter-panel`, checkbox data attributes, active count, and clear action.

- [ ] **Step 1: Write one failing rendered-interface test**

```js
test('renders an expandable accessible multi-select candidate filter panel', async () => {
  const html = await (await render()).text();

  assert.match(html, /id="catalog-filter-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="catalog-filter-panel"/);
  assert.match(html, /id="catalog-filter-panel"[^>]*hidden/);
  for (const value of ['selected', 'remote', 'review']) {
    assert.match(html, new RegExp(`data-catalog-status-filter="${value}"`));
  }
  for (const day of [1, 2, 3, 4, 5, 6, 7]) {
    assert.match(html, new RegExp(`data-catalog-day-filter="${day}"`));
  }
  for (const value of ['morning', 'afternoon', 'evening', 'flexible']) {
    assert.match(html, new RegExp(`data-catalog-daypart-filter="${value}"`));
  }
  assert.match(html, /id="clear-catalog-filters"/);
});
```

- [ ] **Step 2: Build and run the focused test to verify RED**

```bash
npm run build && node --test --test-name-pattern="expandable accessible multi-select" tests/rendered-html.test.mjs
```

Expected: FAIL because the old single select is still rendered.

- [ ] **Step 3: Replace the single select with native controls**

Replace `.catalog-tools` in `src/index.html` with:

```html
<div class="catalog-tools">
  <label>搜尋課名、教師或課號<input id="catalog-search" type="search" placeholder="例如：人機互動"></label>
  <button id="catalog-filter-toggle" class="catalog-filter-toggle" type="button" aria-expanded="false" aria-controls="catalog-filter-panel">篩選 <span id="catalog-filter-count" hidden>0</span></button>
</div>
<section id="catalog-filter-panel" class="catalog-filter-panel" aria-label="候選課程進階篩選" hidden>
  <header><strong>進階篩選</strong><button id="clear-catalog-filters" type="button">清除篩選</button></header>
  <fieldset><legend>課程狀態</legend><div class="catalog-filter-options">
    <label><input type="checkbox" data-catalog-status-filter="selected">已加入</label>
    <label><input type="checkbox" data-catalog-status-filter="remote">可非同步</label>
    <label><input type="checkbox" data-catalog-status-filter="review">資格待確認</label>
  </div></fieldset>
  <fieldset><legend>星期</legend><div class="catalog-filter-options">
    <label><input type="checkbox" data-catalog-day-filter="1">週一</label><label><input type="checkbox" data-catalog-day-filter="2">週二</label><label><input type="checkbox" data-catalog-day-filter="3">週三</label><label><input type="checkbox" data-catalog-day-filter="4">週四</label><label><input type="checkbox" data-catalog-day-filter="5">週五</label><label><input type="checkbox" data-catalog-day-filter="6">週六</label><label><input type="checkbox" data-catalog-day-filter="7">週日</label>
  </div></fieldset>
  <fieldset><legend>上課時段</legend><div class="catalog-filter-options">
    <label><input type="checkbox" data-catalog-daypart-filter="morning">上午 06:10–12:00</label>
    <label><input type="checkbox" data-catalog-daypart-filter="afternoon">下午 12:10–18:00</label>
    <label><input type="checkbox" data-catalog-daypart-filter="evening">晚上 18:10–22:00</label>
    <label><input type="checkbox" data-catalog-daypart-filter="flexible">非同步／時間未定</label>
  </div></fieldset>
</section>
```

- [ ] **Step 4: Rerun the interface test and verify GREEN**

Run Step 2. Expected: the focused test passes.

- [ ] **Step 5: Add one failing wiring-and-responsive test**

```js
test('wires candidate multi-filters and stacks them on compact screens', async () => {
  const html = await (await render()).text();

  assert.match(html, /filterCandidateCourses\(courseStore, filters\)/);
  assert.match(html, /countActiveCatalogFilters\(filters\)/);
  assert.match(html, /catalog-filter-toggle[\s\S]*aria-expanded/);
  assert.match(html, /clear-catalog-filters[\s\S]*renderCatalog\(\)/);
  assert.match(html, /\.catalog-filter-panel\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.catalog-filter-panel\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(html, /\.catalog-filter-option|\.catalog-filter-options label/);
  assert.match(html, /min-height:\s*44px/);
});
```

- [ ] **Step 6: Build and run the wiring test to verify RED**

```bash
npm run build && node --test --test-name-pattern="wires candidate multi-filters" tests/rendered-html.test.mjs
```

Expected: FAIL because app wiring, bundling, and styles do not exist.

- [ ] **Step 7: Bundle the pure filter module**

In `scripts/build.mjs`:

1. Add `catalogFilters` after `plannerCore` in the Promise result list.
2. Add `read('src/catalog-filters.mjs')` at the matching position in the Promise input list.
3. Add before the planner-core wrapper in `script`:

```js
wrapModule(catalogFilters, '__catalogFilters', [
  'CATALOG_DAYPARTS', 'filterCandidateCourses', 'countActiveCatalogFilters',
]),
```

The browser bundle then exposes the two functions to `src/app.mjs` without adding runtime imports.

- [ ] **Step 8: Wire controls into `src/app.mjs`**

Add before `renderCatalog()`:

```js
function currentCatalogFilters() {
  return {
    query: byId('catalog-search').value,
    selectedIds: selected.map(({ id }) => id),
    eligibilityStatuses: Object.fromEntries(courseStore.map((course) => [
      course.id,
      evaluateEligibility(course, profile).status,
    ])),
    statuses: [...document.querySelectorAll('[data-catalog-status-filter]:checked')]
      .map((input) => input.dataset.catalogStatusFilter),
    weekdays: [...document.querySelectorAll('[data-catalog-day-filter]:checked')]
      .map((input) => Number(input.dataset.catalogDayFilter)),
    dayparts: [...document.querySelectorAll('[data-catalog-daypart-filter]:checked')]
      .map((input) => input.dataset.catalogDaypartFilter),
  };
}

function renderCatalogFilterCount(filters) {
  const count = countActiveCatalogFilters(filters);
  const badge = byId('catalog-filter-count');
  badge.textContent = String(count);
  badge.hidden = count === 0;
  byId('catalog-filter-toggle').setAttribute('aria-label', count
    ? `篩選，已啟用 ${count} 個條件`
    : '篩選候選課程');
}
```

Replace the first lines and manual predicate in `renderCatalog()` with:

```js
const filters = currentCatalogFilters();
const visible = filterCandidateCourses(courseStore, filters);
renderCatalogFilterCount(filters);
```

Keep the existing count, empty state, and row-rendering code after those lines unchanged.

Replace the old `catalog-filter` change listener with:

```js
byId('catalog-filter-toggle').addEventListener('click', () => {
  const panel = byId('catalog-filter-panel');
  const expanded = panel.hidden;
  panel.hidden = !expanded;
  byId('catalog-filter-toggle').setAttribute('aria-expanded', String(expanded));
});

document.querySelectorAll([
  '[data-catalog-status-filter]',
  '[data-catalog-day-filter]',
  '[data-catalog-daypart-filter]',
].join(',')).forEach((input) => input.addEventListener('change', renderCatalog));

byId('clear-catalog-filters').addEventListener('click', () => {
  document.querySelectorAll([
    '[data-catalog-status-filter]',
    '[data-catalog-day-filter]',
    '[data-catalog-daypart-filter]',
  ].join(',')).forEach((input) => { input.checked = false; });
  renderCatalog();
});
```

- [ ] **Step 9: Add compact existing-style CSS**

Replace the existing `.catalog-tools` rule and append:

```css
.catalog-tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: end; margin: 10px 0 5px; }
.catalog-filter-toggle { min-width: 108px; min-height: 44px; border: 1px solid var(--line-strong); border-radius: var(--radius-control); background: var(--surface); color: var(--ink); padding: 8px 12px; font: inherit; font-size: .72rem; font-weight: 850; cursor: pointer; }
.catalog-filter-toggle[aria-expanded="true"] { border-color: var(--blue); background: var(--blue-soft); color: var(--blue); }
.catalog-filter-toggle span { display: inline-grid; min-width: 20px; min-height: 20px; margin-left: 4px; place-items: center; border-radius: 999px; background: var(--blue); color: white; font-size: .62rem; }
.catalog-filter-panel[hidden] { display: none; }
.catalog-filter-panel { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 8px 0; padding: 10px; border: 1px solid #C8BCE0; border-radius: var(--radius-control); background: linear-gradient(145deg, var(--surface), var(--violet-soft)); }
.catalog-filter-panel > header { grid-column: 1 / -1; display: flex; min-height: 44px; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); }
.catalog-filter-panel > header strong { font-size: .74rem; }
.catalog-filter-panel > header button { min-height: 44px; border: 0; background: transparent; color: var(--blue); font: inherit; font-size: .68rem; font-weight: 850; cursor: pointer; }
.catalog-filter-panel fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
.catalog-filter-panel legend { margin-bottom: 5px; color: var(--muted); font-size: .62rem; font-weight: 850; }
.catalog-filter-options { display: flex; flex-wrap: wrap; gap: 6px; }
.catalog-filter-options label { display: inline-flex; min-height: 44px; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 999px; background: rgb(255 255 255 / 72%); padding: 7px 10px; color: var(--ink); font-size: .66rem; font-weight: 760; cursor: pointer; }
.catalog-filter-options label:has(input:checked) { border-color: var(--blue); background: var(--blue-soft); color: var(--blue); }
.catalog-filter-options input { width: 16px; height: 16px; accent-color: var(--blue); }
```

Inside `@media (max-width: 640px)` add:

```css
.catalog-filter-panel { grid-template-columns: 1fr; }
```

- [ ] **Step 10: Build and run the wiring test to verify GREEN**

Run Step 6. Expected: the focused test passes.

- [ ] **Step 11: Refactor and run focused filter plus rendered tests**

Keep the three explicit checkbox selectors because they make the accepted values visible. Run:

```bash
npm run build && node --test tests/catalog-filters.test.mjs && node --test --test-name-pattern="candidate filter|candidate row|course details" tests/rendered-html.test.mjs
```

Expected: all matching tests pass.

- [ ] **Step 12: Commit the UI slice**

```bash
git add src/index.html src/styles.css src/app.mjs scripts/build.mjs tests/rendered-html.test.mjs
git commit -m "feat: add expandable candidate filters"
```

### Task 6: Update the permanent tutorial and publish the validated site

**Files:**
- Modify: `src/index.html`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: existing `#guide-details` tutorial chapter.
- Produces: discoverable instructions for multi-select status, weekday, daypart, flexible time, and clearing filters.

- [ ] **Step 1: Write one failing tutorial test**

```js
test('teaches the expandable candidate filters in the permanent tutorial', async () => {
  const html = await (await render()).text();
  const tutorial = tutorialDialog(html);

  for (const copy of [
    '展開「篩選」',
    '星期與上課時段可複選',
    '非同步／時間未定',
    '清除篩選',
  ]) assert.match(tutorial, new RegExp(copy));
});
```

- [ ] **Step 2: Build and run the tutorial test to verify RED**

```bash
npm run build && node --test --test-name-pattern="expandable candidate filters" tests/rendered-html.test.mjs
```

Expected: FAIL because the tutorial does not mention the new controls.

- [ ] **Step 3: Add one concise instruction to `#guide-details`**

Insert after the candidate-time instruction:

```html
<li>展開「篩選」可同時選擇課程狀態、星期與上課時段；星期與上課時段可複選，也能單獨找出「非同步／時間未定」課程。按「清除篩選」會保留搜尋文字，只移除勾選條件。</li>
```

- [ ] **Step 4: Rerun the tutorial test and verify GREEN**

Run Step 2. Expected: the focused test passes.

- [ ] **Step 5: Run complete verification**

```bash
npm run verify
```

Expected: unit tests, build, rendered HTML tests, syntax checks, and all live NCCU contract tests pass with zero failures.

- [ ] **Step 6: Inspect the final diff and commit**

```bash
git diff --check
git status --short
git add src/index.html tests/rendered-html.test.mjs
git commit -m "docs: teach candidate multi-filters"
```

- [ ] **Step 7: Push and publish the existing public site**

Push `feature/sunbreak-redesign`, package the exact validated `HEAD`, save a new Sites version for project `appgprj_6a5587c540b0819191572c9cb320c553`, and deploy that saved version to the existing public URL:

```text
https://nccu-course-planner-1151.huntertseng.chatgpt.site
```

Poll the deployment until `status: succeeded`, then verify the live HTML contains `catalog-filter-toggle`, `data-catalog-day-filter="7"`, and `非同步／時間未定`.
