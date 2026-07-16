# Inline Course Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the clipped floating course detail card with a complete, responsive inline panel that allows only one expanded course at a time.

**Architecture:** Keep expansion state as transient UI state in `src/app.mjs`. Render the detail trigger in the action group and render the expanded panel as a direct child of each `.catalog-course`, spanning the article grid. Use the existing event delegation on `#catalog-list` to toggle the single expanded course without persisting UI state.

**Tech Stack:** Browser-native JavaScript, semantic HTML buttons/sections, CSS Grid, Node test runner, Playwright CLI with Chrome.

## Global Constraints

- Follow one-test-at-a-time Red → Green → Refactor TDD.
- Do not persist `expandedCourseId` in localStorage.
- Never truncate detail text with ellipsis.
- Only trusted NCCU HTTPS syllabus URLs may be clickable.
- All interactive controls remain at least 44×44px.
- The page must not horizontally overflow at 375–390px.

---

### Task 1: Render complete details in the course row

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/app.mjs`

**Interfaces:**
- Consumes: `candidateScheduleSummary(course, dayLabels)`, `trustedOfficialSyllabusUrl(course)`, and `eligibilityLabel(status)`.
- Produces: transient `expandedCourseId: string | null`, `.catalog-details-trigger`, and `.course-details-panel`.

- [ ] **Step 1: Write the failing rendered-output test**

```js
test('renders complete course details as an inline panel', async () => {
  const html = await (await render()).text();
  assert.match(html, /let expandedCourseId = null/);
  assert.match(html, /class="catalog-details-trigger"[^>]*aria-expanded=/);
  assert.match(html, /class="course-details-panel"/);
  for (const label of ['課程名稱', '課號', '授課教師', '學分', '上課時間', '修課資格', '資料來源']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /開啟官方課綱/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run build && node --test tests/rendered-html.test.mjs --test-name-pattern="renders complete course details"`

Expected: FAIL because `expandedCourseId`, the trigger, and inline panel do not exist.

- [ ] **Step 3: Add minimal transient state and complete panel markup**

In `src/app.mjs`, add `let expandedCourseId = null;`. Replace the native floating `<details>` fragment with a button:

```js
const expanded = expandedCourseId === course.id;
const detailTrigger = `<button class="catalog-details-trigger" type="button"
  data-details-course="${escapeHtml(course.id)}" aria-expanded="${expanded}"
  aria-controls="course-details-${escapeHtml(course.id)}">詳細</button>`;
```

Render the panel after `.course-actions` only when `expanded` is true. Include a definition grid for title, section code, teacher, credits, schedule, eligibility, source; full condition and section lists; and the trusted syllabus link or a plain unavailable message.

- [ ] **Step 4: Rebuild and verify GREEN**

Run: `npm run build && node --test tests/rendered-html.test.mjs --test-name-pattern="renders complete course details"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.mjs tests/rendered-html.test.mjs
git commit -m "feat: render complete inline course details"
```

### Task 2: Make detail expansion mutually exclusive

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/app.mjs`

**Interfaces:**
- Consumes: `expandedCourseId` and delegated clicks on `catalogList`.
- Produces: click behavior where selecting the same id closes it and selecting another id replaces it.

- [ ] **Step 1: Write the failing interaction-wiring test**

```js
test('keeps only one inline course detail panel open', async () => {
  const html = await (await render()).text();
  assert.match(html, /event\.target\.closest\('\[data-details-course\]'\)/);
  assert.match(html, /expandedCourseId = expandedCourseId === detailButton\.dataset\.detailsCourse\s*\? null\s*: detailButton\.dataset\.detailsCourse/);
  assert.match(html, /renderCatalog\(\)/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run build && node --test tests/rendered-html.test.mjs --test-name-pattern="keeps only one inline"`

Expected: FAIL because delegated detail toggling is missing.

- [ ] **Step 3: Add the delegated toggle before course selection handling**

```js
const detailButton = event.target.closest('[data-details-course]');
if (detailButton) {
  expandedCourseId = expandedCourseId === detailButton.dataset.detailsCourse
    ? null
    : detailButton.dataset.detailsCourse;
  renderCatalog();
  return;
}
```

- [ ] **Step 4: Rebuild and verify GREEN**

Run: `npm run build && node --test tests/rendered-html.test.mjs --test-name-pattern="keeps only one inline"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.mjs tests/rendered-html.test.mjs
git commit -m "feat: toggle one course detail panel at a time"
```

### Task 3: Remove clipping and make the panel responsive

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `.course-details-panel`, `.course-details-facts`, and `.catalog-details-trigger` from Task 1.
- Produces: in-flow grid-spanning layout with wrapped text and mobile-safe columns.

- [ ] **Step 1: Write the failing responsive-layout test**

```js
test('keeps complete course details in flow without clipping', async () => {
  const html = await (await render()).text();
  assert.match(html, /\.course-details-panel\s*\{[^}]*grid-column:\s*1 \/ -1/s);
  assert.match(html, /\.course-details-panel\s*\{[^}]*position:\s*relative/s);
  assert.doesNotMatch(html, /\.course-details-card\s*\{[^}]*position:\s*absolute/s);
  assert.match(html, /\.course-details-panel[^}]*overflow-wrap:\s*anywhere/s);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run build && node --test tests/rendered-html.test.mjs --test-name-pattern="keeps complete course details in flow"`

Expected: FAIL because the old `.course-details-card` remains absolutely positioned.

- [ ] **Step 3: Replace floating-card CSS with in-flow responsive CSS**

Use `.course-details-panel { position: relative; grid-column: 1 / -1; ... overflow-wrap: anywhere; }`, an adaptive facts grid, natural wrapping lists, and a 640px media rule that reduces the facts grid to two columns. Remove all obsolete `.course-details`, summary, and `.course-details-card` positioning rules.

- [ ] **Step 4: Run focused and full verification**

Run: `npm run verify`

Expected: all unit, rendered, lint, and live NCCU contract tests pass.

- [ ] **Step 5: Chrome QA and commit**

At desktop and 390×844, verify: panel is fully readable, only one panel exists, `document.documentElement.scrollWidth === innerWidth`, all action controls are at least 44×44px, and the console has zero errors.

```bash
git add src/styles.css tests/rendered-html.test.mjs
git commit -m "fix: keep course details readable in flow"
```

### Task 4: Publish the verified revision

**Files:**
- Rebuild generated `dist/` through the existing build script.

**Interfaces:**
- Consumes: verified Git commit.
- Produces: updated GitHub Pages and Sites public deployments.

- [ ] **Step 1: Confirm clean source and push the exact commit to `main`**

Run: `git status --short && git push origin HEAD:main`

Expected: clean status and successful push.

- [ ] **Step 2: Publish the same commit through Sites**

Run the existing Sites packaging and version deployment flow using `.openai/hosting.json` project id.

- [ ] **Step 3: Verify both public responses**

Check that both public URLs return HTTP 200 and include `.course-details-panel` plus the new expansion wiring.

