# Scheduler Activity and Locking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the private NCCU scheduler with clear-all, optional required-course locking, custom activities, Sunday scheduling, and active-course-only imports.

**Architecture:** Keep the dependency-free static Worker bundle and extend the existing pure planner core. Courses and custom activities remain one schedulable item shape so the existing conflict engine can compare all physical meetings. UI state adds a serializable `lockedCourseIds` array; official catalog membership remains separate from current schedule selection.

**Tech Stack:** Node.js ES modules, dependency-free HTML/CSS/JavaScript, Node test runner, OpenAI Sites, Chrome browser testing.

## Global Constraints

- Use vertical TDD: one failing test, minimal implementation, green verification, then the next test.
- Keep the rain-after-sunlight light dreamcore palette; do not add mint green or sky blue.
- Preserve the official NCCU A, B, 1–8, C–H period codes.
- Keep at least 10 compact candidate rows visible in the validated desktop viewport.
- Keep the site private and persist user state only in browser local storage.
- Project and Coda name: `nccu-course-planner`.

---

### Task 1: Exclude unavailable official courses

**Files:**
- Modify: `tests/course-data.test.mjs`
- Modify: `src/course-data.mjs`

**Interfaces:**
- Consumes: exported `courses` array.
- Produces: `courses` containing 23 active official course groups and no `available: false` item.

- [ ] **Step 1: Write the failing test**

```js
test('imports only course groups that are open in 115-1', () => {
  assert.equal(courses.length, 23);
  assert.equal(courses.every((course) => course.available !== false), true);
  assert.equal(courses.some((course) => course.id === 'applied-ml'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern='imports only course groups' tests/course-data.test.mjs`

Expected: FAIL because the current data has 24 groups and includes `applied-ml`.

- [ ] **Step 3: Write minimal implementation**

Remove the `applied-ml` object from `src/course-data.mjs`; keep the eligibility engine's synthetic unavailable test unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/course-data.mjs tests/course-data.test.mjs
git commit -m "Exclude unavailable courses from catalog"
```

### Task 2: Clear current schedule state

**Files:**
- Modify: `tests/planner-core.test.mjs`
- Modify: `src/planner-core.mjs`

**Interfaces:**
- Produces: `clearPlannerSelection(): { selected: [], lockedCourseIds: [], courseOptions: {} }`.

- [ ] **Step 1: Write the failing test**

```js
test('clears selected items, locks, and course options in one action', () => {
  assert.deepEqual(core.clearPlannerSelection(), {
    selected: [],
    lockedCourseIds: [],
    courseOptions: {},
  });
});
```

- [ ] **Step 2: Run RED**

Run: `node --test --test-name-pattern='clears selected items' tests/planner-core.test.mjs`

Expected: FAIL because `clearPlannerSelection` does not exist.

- [ ] **Step 3: Implement minimal core function**

```js
export function clearPlannerSelection() {
  return { selected: [], lockedCourseIds: [], courseOptions: {} };
}
```

- [ ] **Step 4: Run GREEN and commit**

Run the RED command, then commit `src/planner-core.mjs` and its test with message `Add clear schedule state transition`.

### Task 3: Make required courses removable when unlocked

**Files:**
- Modify: `tests/planner-core.test.mjs`
- Modify: `src/planner-core.mjs`

**Interfaces:**
- Changes: `toggleCourse(selected, course)` so required status alone no longer prevents removal.

- [ ] **Step 1: Replace the legacy protection test with the new failing behavior**

```js
test('removes an unlocked required course from the selection', () => {
  const required = { id: 'agentic', title: 'Agentic AI', required: true };
  assert.deepEqual(core.toggleCourse([required], required), []);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test --test-name-pattern='removes an unlocked required' tests/planner-core.test.mjs`

Expected: FAIL because the required course remains selected.

- [ ] **Step 3: Implement minimal removal rule**

```js
export function toggleCourse(selected, course) {
  const isSelected = selected.some((item) => item.id === course.id);
  if (isSelected) return selected.filter((item) => item.id !== course.id);
  return [...selected, { ...course, attendance: course.attendance || 'physical' }];
}
```

- [ ] **Step 4: Run GREEN and commit**

Run the RED command, then commit with message `Allow unlocked required courses to be removed`.

### Task 4: Lock and unlock required courses

**Files:**
- Modify: `tests/planner-core.test.mjs`
- Modify: `src/planner-core.mjs`

**Interfaces:**
- Produces: `toggleCourseLock(lockedCourseIds, courseId): string[]`.
- Extends: `toggleCourse(selected, course, lockedCourseIds = [])` after the lock transition is green.

- [ ] **Step 1: Write the failing lock transition test**

```js
test('toggles a course id in the locked course list', () => {
  assert.deepEqual(core.toggleCourseLock([], 'agentic'), ['agentic']);
  assert.deepEqual(core.toggleCourseLock(['agentic'], 'agentic'), []);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test --test-name-pattern='toggles a course id' tests/planner-core.test.mjs`

Expected: FAIL because the function does not exist.

- [ ] **Step 3: Implement minimal transition**

```js
export function toggleCourseLock(lockedCourseIds, courseId) {
  return lockedCourseIds.includes(courseId)
    ? lockedCourseIds.filter((id) => id !== courseId)
    : [...lockedCourseIds, courseId];
}
```

- [ ] **Step 4: Run GREEN**

Run the RED command. Expected: PASS.

- [ ] **Step 5: Write the next failing locked-removal test**

```js
test('keeps a locked required course in the selection', () => {
  const required = { id: 'agentic', required: true };
  assert.deepEqual(core.toggleCourse([required], required, ['agentic']), [required]);
});
```

- [ ] **Step 6: Run RED, add the locked-id guard, then run GREEN and commit**

Run the locked test and confirm it fails because the course is removed. Extend the function signature and add:

```js
if (isSelected && lockedCourseIds.includes(course.id)) return selected;
```

Run the targeted tests and commit with message `Add required course locking transition`.

### Task 5: Create typed custom activities

**Files:**
- Modify: `tests/planner-core.test.mjs`
- Modify: `src/planner-core.mjs`

**Interfaces:**
- Extends: `createManualCourse(input, sequence)` with `input.itemType`.
- Produces manual items with `itemType`, zero credits for non-course activities, and a physical schedule when applicable.

- [ ] **Step 1: Write the failing club activity test**

```js
test('creates a weekly club activity that participates in scheduling', () => {
  const activity = core.createManualCourse({
    title: '攝影社', itemType: 'club', credits: '3', mode: 'physical',
    day: '7', start: '14:00', end: '16:00',
  }, 8);
  assert.equal(activity.itemType, 'club');
  assert.equal(activity.credits, 0);
  assert.equal(activity.schedule.day, 7);
  assert.equal(activity.schedule.label, '週日 14:00–16:00');
});
```

- [ ] **Step 2: Run RED**

Run: `node --test --test-name-pattern='creates a weekly club activity' tests/planner-core.test.mjs`

Expected: FAIL because item type and Sunday label are absent.

- [ ] **Step 3: Implement minimal typed item shape**

```js
const itemType = input.itemType || 'course';
return {
  id: `manual-${sequence}`,
  title: input.title.trim(),
  itemType,
  credits: itemType === 'course' ? Number(input.credits) : 0,
  source: 'manual',
  attendance: input.mode,
  asyncAllowed: input.mode === 'async',
  required: false,
  available: true,
  schedule: manualSchedule,
  conditions: [itemType === 'course' ? '手動新增，尚未查證官方資料' : '自訂每週行程'],
};
```

Also extend the local day label array through `週日`.

- [ ] **Step 4: Run GREEN and commit**

Run the RED command, then commit with message `Support typed custom schedule activities`.

### Task 6: Detect Sunday activity conflicts

**Files:**
- Modify: `tests/planner-core.test.mjs`
- Modify: `src/course-data.mjs`

**Interfaces:**
- Extends exported `dayLabels` through index 7 (`週日`).
- Reuses: `findConflicts(selected)`.

- [ ] **Step 1: Write the failing Sunday conflict test**

```js
test('reports a conflict between Sunday activities', () => {
  const first = { id: 'club', title: '攝影社', schedule: { day: 7, start: 840, end: 960 } };
  const second = { id: 'meeting', title: '組織會議', schedule: { day: 7, start: 900, end: 1020 } };
  assert.equal(core.findConflicts([first, second])[0].message, '攝影社 與 組織會議 每週時段重疊');
});
```

- [ ] **Step 2: Run RED**

If the pure overlap engine already passes, add the missing data-contract assertion instead:

```js
assert.equal(dayLabels[7], '週日');
```

Run the targeted test and confirm it fails because the exported label is missing.

- [ ] **Step 3: Add `週日` to the exported label array, run GREEN, and commit**

Commit message: `Extend planner through Sunday`.

### Task 7: Wire clear, locking, custom activity, and Sunday UI

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Consumes: `clearPlannerSelection`, `toggleCourseLock`, extended `toggleCourse`, `dayLabels[7]`, and typed manual items.
- Produces: `lockedCourseIds` persistence, `#clear-schedule`, `[data-lock-course]`, `#manual-item-type`, and a seven-day grid.

- [ ] **Step 1: RED→GREEN clear-schedule interaction**

Add a rendered test asserting `id="clear-schedule"`, `clearPlannerSelection()`, persistence, and `renderAll()`. Run only that test and confirm RED. Add the header button and handler:

```js
byId('clear-schedule').addEventListener('click', () => {
  const cleared = clearPlannerSelection();
  selected = cleared.selected;
  lockedCourseIds = cleared.lockedCourseIds;
  courseOptions = cleared.courseOptions;
  byId('planner-status').textContent = '已清空目前課表。';
  persistState();
  renderAll();
});
```

Run GREEN before continuing.

- [ ] **Step 2: RED→GREEN lock control and persistence**

Add one rendered test for `[data-lock-course]`, `lockedCourseIds`, and `saved.lockedCourseIds || []`; confirm RED. Add `let lockedCourseIds = []`, serialize/restore it, render the required-course action as a lock button, and wire:

```js
const lockButton = event.target.closest('[data-lock-course]');
if (lockButton) {
  lockedCourseIds = toggleCourseLock(lockedCourseIds, lockButton.dataset.lockCourse);
  persistState();
  renderAll();
  return;
}
```

Pass `lockedCourseIds` into every removal call. Run GREEN.

- [ ] **Step 3: RED→GREEN remove default required-course restoration**

Add a rendered test that the restore path no longer loops over required courses. Confirm it fails, remove the `courseStore.filter((course) => course.required).forEach(...)` block, then run GREEN.

- [ ] **Step 4: RED→GREEN custom activity form**

Add one rendered test for `id="manual-item-type"` and options `club`, `organization`, and `personal`; confirm RED. Replace the copy with「新增課程或行程」and pass `itemType` to `createManualCourse`. Add a change handler that disables the credit input for non-course types. Run GREEN.

- [ ] **Step 5: RED→GREEN Sunday grid**

Add one rendered test for `dayLabels.slice(1, 8)`, a day-cell loop containing 7, and seven-column CSS; confirm RED. Change header and cell generation to 1–7, manual day options to 1–7, and CSS to:

```css
.nccu-grid {
  grid-template-columns: 60px repeat(7, minmax(96px, 1fr));
  min-width: 840px;
}
```

Run GREEN.

- [ ] **Step 6: Refactor visual states under green tests**

Add `is-locked`, `is-club`, `is-organization`, and `is-personal` classes in `gridCourseBlock`. Use the existing orange, violet, rain blue-grey, and ink tokens. Preserve 44px targets and candidate density.

- [ ] **Step 7: Run full suite and commit**

Run: `npm test && npm run lint && git diff --check`

Commit message: `Add flexible schedule activities and locking`.

### Task 8: Deliver folder, private deployment, Coda project, and Chrome QA

**Files:**
- Create: `/Users/cengweiting/Documents/Codex/2026-07-13/new-chat/outputs/nccu-course-planner/`
- Modify through deployment: `.openai/hosting.json` only if Sites requires it.

**Interfaces:**
- Produces: the updated private Sites URL, a source folder without `.git`, and a Coda project named `nccu-course-planner`.

- [ ] **Step 1: Fresh verification**

Run: `npm test && npm run lint && git diff --check && git status --short`.

Expected: all tests pass and only intentional committed changes exist.

- [ ] **Step 2: Create the user-facing project folder**

Use a mechanical copy that excludes `.git` and `node_modules`, includes `src`, `tests`, `scripts`, `docs`, `dist`, `package.json`, and `.openai/hosting.json`, and verify expected files with `rg --files`.

- [ ] **Step 3: Publish exact commit privately**

Push the current branch to the existing Sites source repository, package with `scripts/package-site.sh`, save one version using the pushed SHA, deploy with `deploy_private_site_version`, and poll until `succeeded`.

- [ ] **Step 4: Chrome production QA**

On the deployed private URL verify: active-only catalog; 7 weekday headers; add/remove required course; lock blocks removal; unlock allows removal; clear empties schedule; add Sunday club and overlapping Sunday personal event; conflict warning appears; reload preserves manual items and locks; restore suggestion remains functional.

- [ ] **Step 5: Create the Coda project**

Use the user's signed-in Chrome session. Inspect existing project naming and destination structure, then create `nccu-course-planner` with a concise project summary and the private website URL. Do not publish or share the Coda content beyond its current workspace permissions.

- [ ] **Step 6: Final handoff**

Return the private URL, the project folder link, Chrome QA evidence, and the Coda creation result.
