# NCCU Official Grid and Internship Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current day-card schedule with a complete NCCU period grid, support selectable course variants/advisors, and let the student configure automatic or fixed internship windows.

**Architecture:** Add one pure module for NCCU period conversion and one pure module for internship planning. Keep course eligibility/selection logic in `planner-core.mjs`, extend versioned storage for course options and internship settings, then render both courses and internship reservations as layers in a CSS grid. The existing dependency-free Worker build remains unchanged except for bundling the two new modules.

**Tech Stack:** Native JavaScript ESM, Node.js built-in test runner, semantic HTML, CSS Grid, localStorage, Cloudflare Worker Sites deployment.

## Global Constraints

- Use strict vertical TDD: one failing test → minimal implementation → passing test → refactor before the next behavior.
- Display all NCCU periods in this exact order: `A B 1 2 3 4 C D 5 6 7 8 E F G H`.
- Keep the three required courses fixed and preserve all existing catalog, async, conflict, manual-course, and screenshot flows.
- Default internship settings are `2.5` days, `09:00–18:00`, automatic mode.
- Store all state only in the current browser; no backend, OCR upload, or public deployment.
- Mobile keeps the full grid in a horizontally scrollable schedule region.

---

### Task 1: NCCU Period Source of Truth

**Files:**
- Create: `src/nccu-periods.mjs`
- Create: `tests/nccu-periods.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `NCCU_PERIODS: Array<{code,start,end,time,special}>` and `toMinutes(value: string): number`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { NCCU_PERIODS } from '../src/nccu-periods.mjs';

test('defines the 16 official NCCU periods in display order', () => {
  assert.deepEqual(NCCU_PERIODS.map(({ code }) => code),
    ['A', 'B', '1', '2', '3', '4', 'C', 'D', '5', '6', '7', '8', 'E', 'F', 'G', 'H']);
  assert.deepEqual(NCCU_PERIODS.find(({ code }) => code === 'D'), {
    code: 'D', start: 790, end: 840, time: '13:10–14:00', special: false,
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/nccu-periods.test.mjs`

Expected: FAIL because `src/nccu-periods.mjs` does not exist.

- [ ] **Step 3: Implement the official table**

```js
const period = (code, start, end, special = false) => ({
  code, start: toMinutes(start), end: toMinutes(end), time: `${start}–${end}`, special,
});

export function toMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

export const NCCU_PERIODS = [
  period('A', '06:10', '07:00', true), period('B', '07:10', '08:00', true),
  period('1', '08:10', '09:00'), period('2', '09:10', '10:00'),
  period('3', '10:10', '11:00'), period('4', '11:10', '12:00'),
  period('C', '12:10', '13:00'), period('D', '13:10', '14:00'),
  period('5', '14:10', '15:00'), period('6', '15:10', '16:00'),
  period('7', '16:10', '17:00'), period('8', '17:10', '18:00'),
  period('E', '18:10', '19:00'), period('F', '19:10', '20:00'),
  period('G', '20:10', '21:00'), period('H', '21:10', '22:00', true),
];
```

Add `tests/nccu-periods.test.mjs` to `test:unit` in `package.json`.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --test tests/nccu-periods.test.mjs`

Expected: 1 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/nccu-periods.mjs tests/nccu-periods.test.mjs package.json
git commit -m "Add official NCCU period table"
```

### Task 2: Convert Minute Ranges to NCCU Codes

**Files:**
- Modify: `src/nccu-periods.mjs`
- Modify: `tests/nccu-periods.test.mjs`

**Interfaces:**
- Produces: `periodsForRange(start, end)`, `formatNccuSchedule(schedule, dayLabels)`, and `gridPlacement(schedule)`.

- [ ] **Step 1: Add one failing conversion test**

```js
test('converts exact and offset minute ranges to NCCU period codes', () => {
  assert.equal(periodsForRange(790, 960).map(({ code }) => code).join(''), 'D56');
  assert.equal(periodsForRange(1110, 1280).map(({ code }) => code).join(''), 'EFGH');
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/nccu-periods.test.mjs`

Expected: FAIL with `periodsForRange is not defined` or missing export.

- [ ] **Step 3: Implement the minimal conversion API**

```js
export function periodsForRange(start, end) {
  return NCCU_PERIODS.filter((slot) => start < slot.end && slot.start < end);
}

export function formatNccuSchedule(schedule, labels) {
  if (!schedule) return '時間未定';
  const codes = periodsForRange(schedule.start, schedule.end).map(({ code }) => code).join('');
  return codes ? `${labels[schedule.day]} ${codes}` : schedule.label;
}

export function gridPlacement(schedule) {
  const slots = periodsForRange(schedule.start, schedule.end);
  if (!slots.length) return null;
  const first = NCCU_PERIODS.indexOf(slots[0]);
  const last = NCCU_PERIODS.indexOf(slots.at(-1));
  return { rowStart: first + 2, rowSpan: last - first + 1, codes: slots.map(({ code }) => code).join('') };
}
```

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test tests/nccu-periods.test.mjs`

Expected: all period tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/nccu-periods.mjs tests/nccu-periods.test.mjs
git commit -m "Convert course times to NCCU period codes"
```

### Task 3: Format Manually Added Courses with NCCU Codes

**Files:**
- Modify: `src/planner-core.mjs`
- Modify: `tests/planner-core.test.mjs`
- Modify: `scripts/build.mjs`
- Modify: `tests/bundle-syntax.test.mjs`

**Interfaces:**
- Consumes: `formatNccuSchedule(schedule, dayLabels)`.
- Preserves: `createManualCourse(input, sequence)` return shape, with an official `schedule.label`.

- [ ] **Step 1: Change one expectation to fail**

In the existing manual-course test, replace the schedule expectation with:

```js
schedule: { day: 2, start: 550, end: 720, label: '週二 234' },
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test --test-name-pattern="normalizes a manually" tests/planner-core.test.mjs`

Expected: FAIL because the actual label is `週二 09:10–12:00`.

- [ ] **Step 3: Import and apply official formatting**

At the top of `planner-core.mjs`:

```js
import { formatNccuSchedule } from './nccu-periods.mjs';
```

Build the manual schedule first, then set its label:

```js
const manualSchedule = input.mode === 'async' ? null : {
  day, start: timeToMinutes(input.start), end: timeToMinutes(input.end), label: '',
};
if (manualSchedule) manualSchedule.label = formatNccuSchedule(manualSchedule, dayLabels);
```

Update `scripts/build.mjs` to read `src/nccu-periods.mjs` before the other modules and strip local `import` lines as well as `export`. Add the module to `tests/bundle-syntax.test.mjs` in the same order.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test tests/planner-core.test.mjs tests/bundle-syntax.test.mjs`

Expected: all selected tests pass and the combined browser bundle parses.

- [ ] **Step 5: Commit**

```bash
git add src/planner-core.mjs tests/planner-core.test.mjs scripts/build.mjs tests/bundle-syntax.test.mjs
git commit -m "Use NCCU codes for manual course times"
```

### Task 4: Course Variant and Advisor Resolution

**Files:**
- Modify: `src/course-data.mjs`
- Modify: `src/planner-core.mjs`
- Modify: `tests/planner-core.test.mjs`

**Interfaces:**
- Produces: `resolveCourseOption(course, selection)` and `applyCourseOption(selected, courseId, selection)`.
- Selection shape: `{ variantId: string|null, advisorId: string|null }`.

- [ ] **Step 1: Write the failing advisor-resolution test**

```js
test('resolves the AI project advisor to the correct mutually exclusive meeting', () => {
  const course = {
    id: 'ai-practical-project', title: '人工智慧實務專題',
    variants: [{ id: '070395001', sectionCode: '070395001', advisors: [
      { id: 'wu-chih-hsun', teacher: '吳致勳', schedule: { day: 2, start: 790, end: 960, label: '週二 D56' } },
      { id: 'wu-yi-chieh', teacher: '吳怡潔', schedule: { day: 3, start: 790, end: 960, label: '週三 D56' } },
    ] }],
  };
  const resolved = core.resolveCourseOption(course, { variantId: '070395001', advisorId: 'wu-chih-hsun' });
  assert.equal(resolved.teacher, '吳致勳');
  assert.equal(resolved.schedule.label, '週二 D56');
  assert.equal(resolved.optionStatus, 'resolved');
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test --test-name-pattern="resolves the AI project advisor" tests/planner-core.test.mjs`

Expected: FAIL because `resolveCourseOption` is missing.

- [ ] **Step 3: Implement option resolution and real data**

```js
export function resolveCourseOption(course, selection = {}) {
  if (!course.variants?.length) return course;
  const variant = course.variants.find(({ id }) => id === selection.variantId);
  if (!variant) return { ...course, schedule: null, optionStatus: 'pending', optionMessage: '請選擇正式課號' };
  const advisor = variant.advisors?.find(({ id }) => id === selection.advisorId);
  if (variant.advisors?.length && !advisor) {
    return { ...course, ...variant, schedule: null, optionStatus: 'pending', optionMessage: '請選擇指導老師' };
  }
  const source = advisor || variant;
  return {
    ...course, ...variant, ...source,
    selectedVariantId: variant.id,
    selectedAdvisorId: advisor?.id || null,
    optionStatus: source.schedule ? 'resolved' : 'flexible',
    optionMessage: source.schedule ? null : (source.optionMessage || '時間尚未確認'),
  };
}

export function applyCourseOption(selected, courseId, selection) {
  return selected.map((course) => course.id === courseId
    ? { ...resolveCourseOption(course, selection), attendance: course.attendance }
    : course);
}
```

Add `variants` to `ai-practical-project`: `783006001` with time pending, and `070395001` with Chen flexible, Wu Chih-hsun Tuesday D56, and Wu Yi-chieh Wednesday D56.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test tests/planner-core.test.mjs`

Expected: all core tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/course-data.mjs src/planner-core.mjs tests/planner-core.test.mjs
git commit -m "Support selectable course variants and advisors"
```

### Task 5: Preserve Course Options in Versioned Storage

**Files:**
- Modify: `src/planner-storage.mjs`
- Modify: `tests/planner-storage.test.mjs`
- Modify: `src/app.mjs`

**Interfaces:**
- State adds `courseOptions: Record<string,{variantId,advisorId}>`.
- Storage version increments from `1` to `2`; incompatible version 1 returns the provided fallback.

- [ ] **Step 1: Add one failing round-trip assertion**

```js
const state = {
  selectedIds: ['ai-practical-project'], attendance: {}, profile: {}, manualCourses: [],
  courseOptions: { 'ai-practical-project': { variantId: '070395001', advisorId: 'wu-chih-hsun' } },
};
assert.deepEqual(parsePlannerState(serializePlannerState(state), null), state);
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/planner-storage.test.mjs`

Expected: FAIL because the stored state omits `courseOptions` or has version 1.

- [ ] **Step 3: Upgrade storage and restore options**

Set `STORAGE_VERSION = 2`. Include `courseOptions` in the serialized payload. During `restoreState`, resolve every selected base course with its saved selection before applying attendance. During `persistState`, write the two selected option IDs for courses that define variants.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test tests/planner-storage.test.mjs tests/bundle-syntax.test.mjs`

Expected: all storage and bundle tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/planner-storage.mjs tests/planner-storage.test.mjs src/app.mjs
git commit -m "Persist course option selections"
```

### Task 6: Custom Automatic Internship Planning

**Files:**
- Create: `src/internship-planner.mjs`
- Create: `tests/internship-planner.test.mjs`
- Modify: `package.json`
- Modify: `scripts/build.mjs`
- Modify: `tests/bundle-syntax.test.mjs`

**Interfaces:**
- Produces: `DEFAULT_INTERNSHIP_SETTINGS`, `validateInternshipSettings(settings)`, and `calculateInternshipPlan(selected, settings)`.

- [ ] **Step 1: Write the failing default-plan test**

```js
test('finds three equivalent internship days in the concentrated plan', () => {
  const result = calculateInternshipPlan(concentrated, {
    targetDays: 2.5, start: '09:00', end: '18:00', mode: 'auto', fixedDays: {},
  });
  assert.equal(result.availableDays, 3);
  assert.equal(result.meetsTarget, true);
  assert.deepEqual(result.suggestedWindows.map(({ day, mode }) => ({ day, mode })), [
    { day: 2, mode: 'full' }, { day: 3, mode: 'full' }, { day: 1, mode: 'morning' },
  ]);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/internship-planner.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement automatic full/half-day planning**

Implement these exact rules: convert times with `toMinutes`; split the window around a one-hour middle break; a full window is worth `1`, morning/afternoon is worth `0.5`; inspect every physical `schedule` and each item of `meetings`; choose conflict-free full weekdays first, then conflict-free half-days in weekday order until `targetDays` is reached; return maximum conflict-free `availableDays`, target-limited `suggestedWindows`, `tentative` when a selected physical course has no resolved schedule, and `meetsTarget = availableDays >= targetDays && !tentative`.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test tests/internship-planner.test.mjs`

Expected: 1 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/internship-planner.mjs tests/internship-planner.test.mjs package.json scripts/build.mjs tests/bundle-syntax.test.mjs
git commit -m "Add configurable automatic internship planning"
```

### Task 7: Fixed Internship Days and Conflict Reporting

**Files:**
- Modify: `src/internship-planner.mjs`
- Modify: `tests/internship-planner.test.mjs`

**Interfaces:**
- Fixed day values are `none|full|morning|afternoon` keyed by weekday number strings.
- `calculateInternshipPlan` returns `displayWindows` and `conflicts` for fixed mode.

- [ ] **Step 1: Write one failing fixed-conflict test**

```js
test('counts only conflict-free fixed internship windows', () => {
  const selected = [{ id: 'course', title: '週二課程', attendance: 'physical', schedule: { day: 2, start: 790, end: 960 } }];
  const result = calculateInternshipPlan(selected, {
    targetDays: 1.5, start: '09:00', end: '18:00', mode: 'fixed',
    fixedDays: { 2: 'full', 3: 'morning' },
  });
  assert.equal(result.availableDays, 0.5);
  assert.equal(result.conflicts[0].courseId, 'course');
  assert.equal(result.meetsTarget, false);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test --test-name-pattern="fixed internship" tests/internship-planner.test.mjs`

Expected: FAIL because fixed mode is not handled.

- [ ] **Step 3: Implement fixed windows and validation**

For fixed mode, turn each non-`none` entry into one display window, keep conflicting windows visible, count only conflict-free windows, and return a message naming the weekday and overlapping course. Add validation returning `{field:'end', message:'實習結束時間必須晚於開始時間，且每日時段至少兩小時。'}` when the range is shorter than 120 minutes.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test tests/internship-planner.test.mjs`

Expected: all internship tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/internship-planner.mjs tests/internship-planner.test.mjs
git commit -m "Support fixed internship days and conflicts"
```

### Task 8: Render the Complete Official Grid

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `NCCU_PERIODS`, `gridPlacement`, `formatNccuSchedule`, and the current selected course state.
- Produces: a `role="table"` grid with 6 weekday columns, 16 period rows, and layered course buttons.

- [ ] **Step 1: Write the failing rendered-page contract**

```js
test('renders the full NCCU period grid and spanning course blocks', async () => {
  const html = await (await render()).text();
  assert.match(html, /class="schedule-scroll"/);
  assert.match(html, /class="nccu-grid"/);
  assert.match(html, /NCCU_PERIODS\.map/);
  assert.match(html, /gridPlacement\(meeting\)/);
  assert.match(html, /data-period-code/);
  assert.match(html, /--row-span/);
});
```

- [ ] **Step 2: Build and verify RED**

Run: `npm run build && node --test --test-name-pattern="full NCCU period grid" tests/rendered-html.test.mjs`

Expected: FAIL because the current schedule is a two-column day-card list.

- [ ] **Step 3: Implement grid markup, rendering, and CSS**

Wrap `#schedule-grid` in `.schedule-scroll`. Render weekday headers, one sticky period header per official slot, background cells, then each physical meeting as a button with CSS variables `--grid-column`, `--grid-row`, and `--row-span`. Set `.nccu-grid` to seven columns (`76px` plus six day columns), 17 rows, and `min-width: 860px`; make `.schedule-scroll` horizontally scrollable; use `position: sticky` for weekday headers and the first column. Use solid dark green for required courses and light green for removable optional courses.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm run build && node --test tests/rendered-html.test.mjs && node --test tests/bundle-syntax.test.mjs`

Expected: all rendered and bundle tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/index.html src/app.mjs src/styles.css tests/rendered-html.test.mjs
git commit -m "Render complete NCCU grid timetable"
```

### Task 9: Course Option Controls in the Catalog

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Catalog controls use `data-course-variant` and `data-course-advisor`.
- Changes call `applyCourseOption`, persist, and rerender all summaries and warnings.

- [ ] **Step 1: Write one failing interaction contract**

```js
test('lets a selected multi-option course choose its official section and advisor', async () => {
  const html = await (await render()).text();
  assert.match(html, /data-course-variant/);
  assert.match(html, /data-course-advisor/);
  assert.match(html, /applyCourseOption\(selected, courseId, selection\)/);
  assert.match(html, /請選擇指導老師/);
});
```

- [ ] **Step 2: Build and verify RED**

Run: `npm run build && node --test --test-name-pattern="multi-option course" tests/rendered-html.test.mjs`

Expected: FAIL because option selectors are absent.

- [ ] **Step 3: Implement progressive option controls**

Show the section selector only when the course is selected. Show the advisor selector after a variant with advisors is selected. Add option-pending messages to `renderWarnings`; changing either selector updates the stored selection without changing credits or adding a second course. Style the controls as compact labeled rows below the catalog course button.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm run build && node --test tests/rendered-html.test.mjs tests/planner-core.test.mjs`

Expected: all rendered and core tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app.mjs src/styles.css tests/rendered-html.test.mjs
git commit -m "Add course section and advisor controls"
```

### Task 10: Internship Settings UI and Grid Reservations

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `src/planner-storage.mjs`
- Modify: `tests/planner-storage.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Form IDs: `internship-target`, `internship-start`, `internship-end`, `internship-mode`, `internship-fixed-days`, `internship-status`.
- Stored field: `internshipSettings` matching `DEFAULT_INTERNSHIP_SETTINGS`.

- [ ] **Step 1: Write one failing storage test**

```js
test('round-trips internship target, hours, mode, and fixed weekdays', () => {
  const state = {
    selectedIds: [], attendance: {}, profile: {}, manualCourses: [], courseOptions: {},
    internshipSettings: { targetDays: 3, start: '10:00', end: '17:00', mode: 'fixed', fixedDays: { 2: 'full' } },
  };
  assert.deepEqual(parsePlannerState(serializePlannerState(state), null), state);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test --test-name-pattern="internship target" tests/planner-storage.test.mjs`

Expected: FAIL because `internshipSettings` is omitted.

- [ ] **Step 3: Persist the settings and verify GREEN**

Include `internshipSettings` in the storage payload and restore it over `DEFAULT_INTERNSHIP_SETTINGS`.

Run: `node --test tests/planner-storage.test.mjs`

Expected: all storage tests pass.

- [ ] **Step 4: Write the next failing UI contract**

```js
test('includes editable automatic and fixed internship settings', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="internship-target"/);
  assert.match(html, /id="internship-start"/);
  assert.match(html, /id="internship-end"/);
  assert.match(html, /id="internship-mode"/);
  assert.match(html, /data-internship-day/);
  assert.match(html, /calculateInternshipPlan\(selected, internshipSettings\)/);
});
```

- [ ] **Step 5: Build and verify RED**

Run: `npm run build && node --test --test-name-pattern="editable automatic" tests/rendered-html.test.mjs`

Expected: FAIL because the form is absent.

- [ ] **Step 6: Implement the settings form and reservation layer**

Add a collapsible settings panel above the planner. Validate on change; on error restore the last valid values and focus the end field. Automatic mode hides fixed-day selects; fixed mode shows five selects with `none/full/morning/afternoon`. Call `calculateInternshipPlan` from stats, warnings, and grid rendering. Render every `displayWindow` below course blocks with a hatched neutral background, `自動建議` or `固定實習` label, and a conflict class when applicable. Update the summary to `availableDays / targetDays 天`, prefixed with `暫估` when tentative.

- [ ] **Step 7: Run and verify GREEN**

Run: `npm test`

Expected: all unit, build, rendered-page, and bundle tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/index.html src/app.mjs src/styles.css src/planner-storage.mjs tests/planner-storage.test.mjs tests/rendered-html.test.mjs
git commit -m "Add adjustable internship days and hours"
```

### Task 11: Regression Verification and Private Redeployment

**Files:**
- Verify: all source and test files
- Generated: `dist/server/index.js`, deployment archive

**Interfaces:**
- Reuses the existing opaque Sites `project_id` from `.openai/hosting.json`.

- [ ] **Step 1: Run complete local verification**

Run: `npm test && npm run lint && git diff --check`

Expected: every test passes, lint exits 0, and diff check prints nothing.

- [ ] **Step 2: Verify acceptance data**

Run a Node ESM check asserting the concentrated preset formats Human-Computer Interaction as `週四 234`, Agentic AI as `週四 D56`, Creative Entrepreneurship Intro as `週四 EFG`, and the default internship result remains at least `2.5` days with no hard conflict.

Expected: command exits 0 and prints the verified labels and internship summary.

- [ ] **Step 3: Commit the exact validated source**

```bash
git add .
git diff --cached --check
git commit -m "Complete NCCU grid and internship planner"
```

If prior task commits leave no changes, do not create an empty commit.

- [ ] **Step 4: Push, package, save, and deploy privately**

Push the current `main` HEAD to the existing Sites source repository using a fresh short-lived credential as a per-command HTTP authorization header. Run the Sites `package-site.sh` helper, save a new site version using that exact pushed commit SHA and archive, then call `deploy_private_site_version`.

- [ ] **Step 5: Poll and report the production result**

Poll `get_deployment_status` until `succeeded` or `failed`. On success, return the exact private production URL and note the updated official grid, course-option selector, and internship controls. On failure, report the platform failure message without exposing credentials.
