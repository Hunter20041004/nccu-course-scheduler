# Catalog Schedule, Eligibility, and Syllabus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show NCCU period times and safe syllabus actions in every course candidate while correcting and migrating informational notes that were misclassified as enrollment requirements.

**Architecture:** Keep official-text classification and URL trust in `nccu-course-adapter.mjs`, saved-catalog repair in `planner-storage.mjs`, and reusable schedule summarization in `planner-core.mjs`. `app.mjs` consumes those tested interfaces for compact rendering; `styles.css` handles wrapping and mobile fit without changing the existing visual system.

**Tech Stack:** Node.js ES modules, browser-native HTML/CSS/JavaScript, Node test runner, generated Worker/static bundle, Playwright CLI for Chrome QA, GitHub Pages and OpenAI Sites hosting.

## Global Constraints

- Follow Red → Green → Refactor one vertical slice at a time.
- Preserve original NCCU notes in course details even when they are informational.
- Do not infer or construct missing syllabus URLs.
- Accept syllabus URLs only when they use HTTPS on `nccu.edu.tw` or a subdomain.
- Keep interactive controls at least 44px high and allow the mobile action row to wrap.
- Existing browser data must be repaired without clearing courses, selections, locks, or valid requirements.
- Do not add dependencies or decorative animation.

---

### Task 1: Classify Explicit Restrictions Without Blocking Informational Notes

**Files:**
- Modify: `tests/nccu-course-adapter.test.mjs`
- Modify: `src/nccu-course-adapter.mjs`
- Modify: `tests/nccu-live-contract.test.mjs`

**Interfaces:**
- Consumes: NCCU normalized course `{ courseCode, restrictionText }`.
- Produces: `eligibilityRuleFromOfficialRestriction(course): EligibilityRule[]` with an empty array for informational notes.

- [ ] **Step 1: Write the failing informational-note test**

```js
test('keeps expanded-minor course notes informational', () => {
  assert.deepEqual(eligibilityRuleFromOfficialRestriction({
    courseCode: '010056001',
    restrictionText: '日文系擴大輔系課程',
  }), []);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="expanded-minor" tests/nccu-course-adapter.test.mjs`

Expected: FAIL because the current broad `輔系` pattern creates a required rule.

- [ ] **Step 3: Implement explicit restrictive grammar**

```js
function hasExplicitEnrollmentRestriction(value) {
  return /(?:僅限|(?:^|[；。])限(?=.{0,24}(?:學生|修讀|選修|本系|本院))|須|需|先修|不得|優先)/
    .test(value);
}

export function eligibilityRuleFromOfficialRestriction(course) {
  const restriction = String(course.restrictionText || '').trim();
  if (!restriction || !hasExplicitEnrollmentRestriction(restriction)) return [];
  const audience = restriction.match(/^僅限(.+?)學生修讀[。.]?$/)?.[1];
  const prerequisiteLanguage = restriction.match(/先修習[^。；]{0,30}(日文|英文|德文|法文)/)?.[1];
  const conditionLabel = prerequisiteLanguage && restriction.includes('或')
    ? `我符合本課程任一項${prerequisiteLanguage}先修資格`
    : audience
      ? `我是${audience.replace('及雙主修', '或雙主修')}學生`
      : `我符合：${restriction.replace(/[。.]$/, '')}`;
  return [{
    conditionId: `official-restriction:${course.courseCode}`,
    conditionLabel,
    conditionDescription: `政大官方備註：${restriction}`,
    enforcement: 'required',
    rationale: restriction,
  }];
}
```

- [ ] **Step 4: Run adapter tests and verify GREEN**

Run: `node --test tests/nccu-course-adapter.test.mjs tests/ai-service.test.mjs`

Expected: PASS; explicit `僅限歐文系及雙主修學生修讀`, `限本系學生`, and prerequisite rules remain required.

- [ ] **Step 5: Cover the real NCCU row**

Add to `tests/nccu-live-contract.test.mjs`:

```js
test('live NCCU expanded-minor note stays informational', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '010056001' });
  const candidate = nccuCourseToCandidate(rows.find((row) => row.courseCode === '010056001'));
  assert.equal(candidate.schedule.label, '四34');
  assert.deepEqual(candidate.eligibilityRules, []);
  assert.ok(candidate.conditions.includes('日文系擴大輔系課程'));
});
```

Run: `node --test tests/nccu-live-contract.test.mjs`

Expected: all live NCCU contract tests PASS.

- [ ] **Step 6: Commit the classifier slice**

```bash
git add src/nccu-course-adapter.mjs tests/nccu-course-adapter.test.mjs tests/ai-service.test.mjs tests/nccu-live-contract.test.mjs
git commit -m "fix: distinguish course notes from enrollment limits"
```

---

### Task 2: Repair Misclassified Rules in Saved Candidate Data

**Files:**
- Modify: `tests/nccu-course-adapter.test.mjs`
- Modify: `src/nccu-course-adapter.mjs`
- Modify: `tests/planner-storage.test.mjs`
- Modify: `src/planner-storage.mjs`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Consumes: a saved candidate with `eligibilityRules`.
- Produces: `sanitizeOfficialEligibilityRules(course): Course`, preserving the course and valid rules while removing only informational `official-restriction:*` rules.
- `createStartupCatalog(savedState, officialCourses)` applies the sanitizer to every restored course.

- [ ] **Step 1: Write the failing sanitizer test**

```js
test('removes only informational official eligibility rules', () => {
  const course = sanitizeOfficialEligibilityRules({
    id: 'ai-010056001',
    eligibilityRules: [
      { conditionId: 'official-restriction:010056001', enforcement: 'required', rationale: '日文系擴大輔系課程' },
      { conditionId: 'custom:portfolio', enforcement: 'required', rationale: '自訂條件' },
    ],
  });
  assert.deepEqual(course.eligibilityRules, [
    { conditionId: 'custom:portfolio', enforcement: 'required', rationale: '自訂條件' },
  ]);
});
```

- [ ] **Step 2: Run the sanitizer test and verify RED**

Run: `node --test --test-name-pattern="removes only informational" tests/nccu-course-adapter.test.mjs`

Expected: FAIL because `sanitizeOfficialEligibilityRules` is not exported.

- [ ] **Step 3: Implement minimal idempotent sanitization**

```js
export function sanitizeOfficialEligibilityRules(course = {}) {
  const eligibilityRules = (course.eligibilityRules || []).filter((rule) => {
    if (!String(rule.conditionId || '').startsWith('official-restriction:')) return true;
    if (!rule.rationale) return true;
    return eligibilityRuleFromOfficialRestriction({
      courseCode: course.sectionCode || course.id,
      restrictionText: rule.rationale,
    }).length > 0;
  });
  return eligibilityRules.length === (course.eligibilityRules || []).length
    ? course
    : { ...course, eligibilityRules };
}
```

- [ ] **Step 4: Run the sanitizer test and verify GREEN**

Run: `node --test tests/nccu-course-adapter.test.mjs`

Expected: PASS.

- [ ] **Step 5: Write the failing startup repair test**

```js
test('repairs informational official rules while restoring saved courses', () => {
  const saved = {
    addedCourses: [{
      id: 'ai-010056001',
      sectionCode: '010056001',
      eligibilityRules: [{
        conditionId: 'official-restriction:010056001',
        enforcement: 'required',
        rationale: '日文系擴大輔系課程',
      }],
    }],
    deletedCourseIds: [],
  };
  assert.deepEqual(createStartupCatalog(saved, [])[0].eligibilityRules, []);
});
```

- [ ] **Step 6: Run the startup test and verify RED**

Run: `node --test --test-name-pattern="repairs informational" tests/planner-storage.test.mjs`

Expected: FAIL because restored courses still contain the stale rule.

- [ ] **Step 7: Apply sanitizer during catalog restoration and browser bundling**

```js
import { sanitizeOfficialEligibilityRules } from './nccu-course-adapter.mjs';

export function createStartupCatalog(savedState, officialCourses) {
  if (!savedState) return [];
  return buildCandidateCatalog(
    officialCourses,
    savedState.addedCourses || savedState.manualCourses,
    savedState.deletedCourseIds,
  ).map(sanitizeOfficialEligibilityRules);
}
```

Add `sanitizeOfficialEligibilityRules` to the NCCU adapter exports in `scripts/build.mjs`, and place the NCCU adapter browser wrapper before the planner storage wrapper so the dependency is initialized before use.

- [ ] **Step 8: Run storage and bundle tests and verify GREEN**

Run: `node --test tests/planner-storage.test.mjs tests/bundle-syntax.test.mjs`

Expected: PASS; serialized state shape remains version 4.

- [ ] **Step 9: Commit the saved-data repair slice**

```bash
git add src/nccu-course-adapter.mjs src/planner-storage.mjs scripts/build.mjs tests/nccu-course-adapter.test.mjs tests/planner-storage.test.mjs
git commit -m "fix: repair stale informational eligibility rules"
```

---

### Task 3: Summarize Candidate Schedule Times

**Files:**
- Modify: `tests/planner-core.test.mjs`
- Modify: `src/planner-core.mjs`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Consumes: `candidateScheduleSummary(course, labels)` where `course` may have `meetings`, `schedule`, `variants`, `attendance`, or `asyncAllowed`.
- Produces: one display string in the approved NCCU format.

- [ ] **Step 1: Write the first failing schedule-summary test**

```js
test('summarizes one or more NCCU candidate meetings', () => {
  const labels = ['', '週一', '週二', '週三', '週四', '週五', '週六', '週日'];
  assert.equal(candidateScheduleSummary({
    meetings: [
      { day: 4, start: 610, end: 720 },
      { day: 5, start: 850, end: 960 },
    ],
  }, labels), '週四 34・週五 56');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="summarizes one or more" tests/planner-core.test.mjs`

Expected: FAIL because `candidateScheduleSummary` is not exported.

- [ ] **Step 3: Implement fixed-meeting summaries**

```js
export function candidateScheduleSummary(course = {}, labels = []) {
  if (course.attendance === 'async') return '非同步／時間彈性';
  const meetings = course.meetings?.length
    ? course.meetings
    : course.schedule ? [course.schedule] : [];
  const summaries = [...new Set(meetings.map((meeting) => formatNccuSchedule(meeting, labels)))];
  if (summaries.length) return summaries.join('・');
  if (course.asyncAllowed) return '非同步／時間彈性';
  if (course.selectedVariantId) return '時間未定';
  if (course.variants?.length > 1) return '多時段可選';
  return '時間未定';
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test --test-name-pattern="summarizes one or more" tests/planner-core.test.mjs`

Expected: PASS.

- [ ] **Step 5: Add one failing edge-state test, then implement it**

```js
test('labels asynchronous and unresolved multi-option candidates', () => {
  assert.equal(candidateScheduleSummary({ attendance: 'async' }, []), '非同步／時間彈性');
  assert.equal(candidateScheduleSummary({ asyncAllowed: true }, []), '非同步／時間彈性');
  assert.equal(candidateScheduleSummary({ variants: [{ id: 'a' }, { id: 'b' }] }, []), '多時段可選');
  assert.equal(candidateScheduleSummary({}, []), '時間未定');
});
```

Run before implementation: `node --test --test-name-pattern="labels asynchronous" tests/planner-core.test.mjs`

Expected: FAIL because all no-meeting cases currently return `時間未定`.

Replace the initial implementation with the complete priority order:

```js
export function candidateScheduleSummary(course = {}, labels = []) {
  if (course.attendance === 'async') return '非同步／時間彈性';
  const meetings = course.meetings?.length
    ? course.meetings
    : course.schedule ? [course.schedule] : [];
  const summaries = [...new Set(meetings.map((meeting) => formatNccuSchedule(meeting, labels)))];
  if (summaries.length) return summaries.join('・');
  if (course.asyncAllowed) return '非同步／時間彈性';
  if (course.selectedVariantId) return '時間未定';
  if (course.variants?.length > 1) return '多時段可選';
  return '時間未定';
}
```

Run: `node --test tests/planner-core.test.mjs`

Expected: PASS.

- [ ] **Step 6: Export the helper in the browser bundle and commit**

Add `candidateScheduleSummary` to the planner-core export list in `scripts/build.mjs`.

Run: `node --test tests/bundle-syntax.test.mjs tests/planner-core.test.mjs`

```bash
git add src/planner-core.mjs scripts/build.mjs tests/planner-core.test.mjs
git commit -m "feat: summarize candidate course schedules"
```

---

### Task 4: Render Time and Safe Syllabus Actions

**Files:**
- Modify: `tests/nccu-course-adapter.test.mjs`
- Modify: `src/nccu-course-adapter.mjs`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Consumes: `candidateScheduleSummary(course, dayLabels)` and `trustedOfficialSyllabusUrl(course)`.
- Produces: compact `.catalog-time` text and `.catalog-syllabus` action states.

- [ ] **Step 1: Write the failing trusted-URL test**

```js
test('accepts only HTTPS NCCU syllabus URLs', () => {
  assert.equal(
    trustedOfficialSyllabusUrl({ sourceUrl: 'https://newdoc.nccu.edu.tw/example.html' }),
    'https://newdoc.nccu.edu.tw/example.html',
  );
  assert.equal(trustedOfficialSyllabusUrl({ sourceUrl: 'javascript:alert(1)' }), '');
  assert.equal(trustedOfficialSyllabusUrl({ sourceUrl: 'https://example.com/fake' }), '');
});
```

- [ ] **Step 2: Run the URL test and verify RED**

Run: `node --test --test-name-pattern="accepts only HTTPS" tests/nccu-course-adapter.test.mjs`

Expected: FAIL because the helper is missing.

- [ ] **Step 3: Implement trusted URL validation**

```js
export function trustedOfficialSyllabusUrl(course = {}) {
  try {
    const url = new URL(String(course.sourceUrl || ''));
    const officialHost = url.hostname === 'nccu.edu.tw' || url.hostname.endsWith('.nccu.edu.tw');
    return url.protocol === 'https:' && officialHost ? url.href : '';
  } catch {
    return '';
  }
}
```

Add `trustedOfficialSyllabusUrl` to the adapter export list in `scripts/build.mjs`.

Run: `node --test tests/nccu-course-adapter.test.mjs tests/bundle-syntax.test.mjs`

Expected: PASS.

- [ ] **Step 4: Write the failing rendered-catalog test**

```js
test('shows schedule summaries and safe syllabus actions in candidate rows', async () => {
  const html = await (await render()).text();
  assert.match(html, /class="catalog-time"/);
  assert.match(html, /candidateScheduleSummary\(selectedCourse \|\| course, dayLabels\)/);
  assert.match(html, />課綱<\/a>/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, />無課綱<\/button>/);
  assert.match(html, /course\.source !== 'manual' \|\| course\.itemType === 'course'/);
});
```

- [ ] **Step 5: Run the rendered test and verify RED**

Run: `npm run build && node --test --test-name-pattern="schedule summaries and safe syllabus" tests/rendered-html.test.mjs`

Expected: FAIL because candidate rows do not render time or syllabus controls.

- [ ] **Step 6: Implement catalog row rendering**

In `renderCatalog()` compute:

```js
const scheduleSummary = candidateScheduleSummary(selectedCourse || course, dayLabels);
const syllabusUrl = trustedOfficialSyllabusUrl(course);
const showsSyllabus = course.source !== 'manual' || course.itemType === 'course';
const syllabusAction = !showsSyllabus
  ? ''
  : syllabusUrl
    ? `<a class="catalog-syllabus" href="${escapeHtml(syllabusUrl)}" target="_blank" rel="noopener noreferrer">課綱</a>`
    : '<button class="catalog-syllabus" type="button" disabled>無課綱</button>';
```

Render `<small class="catalog-time">${escapeHtml(scheduleSummary)}</small>` below course code and teacher, and insert `${syllabusAction}` between details and lock.

- [ ] **Step 7: Add compact and mobile-safe styles**

```css
.catalog-main { min-width: 0; }
.catalog-time { color: var(--violet); font-weight: 750; }
.course-actions { flex-wrap: wrap; }
.catalog-syllabus {
  display: inline-grid;
  min-height: 44px;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--blue);
  font-weight: 800;
  text-decoration: none;
}
.catalog-syllabus:disabled { color: var(--line-strong); cursor: not-allowed; }
```

Use the existing spacing tokens and do not add animation.

- [ ] **Step 8: Run rendered and unit suites and verify GREEN**

Run: `npm run build && node --test tests/rendered-html.test.mjs tests/nccu-course-adapter.test.mjs tests/planner-core.test.mjs`

Expected: all tests PASS.

- [ ] **Step 9: Commit the catalog UI slice**

```bash
git add src/app.mjs src/styles.css src/nccu-course-adapter.mjs scripts/build.mjs tests/rendered-html.test.mjs tests/nccu-course-adapter.test.mjs
git commit -m "feat: show candidate times and syllabus links"
```

---

### Task 5: Full Verification, Chrome QA, and Public Deployment

**Files:**
- Verify: all changed source and tests
- Update only if required by verification: `README.md`

**Interfaces:**
- Consumes: completed feature branch at a clean commit.
- Produces: verified GitHub Pages and OpenAI Sites deployments.

- [ ] **Step 1: Run the complete automated verification**

Run: `npm run verify`

Expected: unit tests, build, rendered HTML tests, lint, and NCCU live contract all PASS with zero failures.

- [ ] **Step 2: Scan for secrets and inspect the final diff**

Run:

```bash
rg -n "gsk_[A-Za-z0-9]+|AIza[0-9A-Za-z_-]+|gho_[A-Za-z0-9_]+|Authorization:\\s*Bearer" . -g '!dist/**' -g '!node_modules/**' || true
git diff --check
git status --short
```

Expected: no secrets, no whitespace errors, and no unexpected files.

- [ ] **Step 3: Run desktop Chrome workflow**

Start `npm run dev`, then use Playwright CLI with Chrome to:

1. Clear test-profile local storage and open the app.
2. Search `010056001` in the official catalog.
3. Add `日語讀本（一）`.
4. Verify candidate time is `週四 34` and eligibility is not blocked.
5. Verify details still contain `日文系擴大輔系課程`.
6. Verify `課綱` has an HTTPS NCCU URL and opens a new tab.
7. Seed a stale saved rule, reload, and verify it is removed without deleting the course.
8. Confirm browser console has zero errors.

- [ ] **Step 4: Run mobile Chrome workflow**

Resize to `390 × 844`; verify the candidate row and four-action row do not overlap or create document-level horizontal overflow, and every interactive control is at least 44px high.

- [ ] **Step 5: Publish both public sites**

Push the verified HEAD to GitHub `main`, wait for CI and Pages workflows to succeed, then package and deploy the same commit through the existing `.openai/hosting.json` Sites project.

- [ ] **Step 6: Verify the public URLs**

Open both deployments and repeat the `010056001` search. Confirm HTTP GET 200, candidate time, eligible state, syllabus action, and zero console errors.

- [ ] **Step 7: Record final clean state**

Run:

```bash
git status --short
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: clean worktree and identical local/remote main SHA.
