# Complete Course Index and Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a versioned 115-1 official course index with complete decision-making metadata, then provide composable keyword, official-field, and personal-compatibility search without weakening the existing planner.

**Architecture:** A build-time sync script collects the capped NCCU public endpoint by recursively partitioning course-code prefixes, validates and stores a deterministic JSON snapshot, and the existing custom build embeds that snapshot for fast static-site search. A pure search module filters normalized official courses and returns deterministic explanations. The UI keeps simple search as the default, exposes advanced filters on demand, and refreshes a selected result through the live official lookup.

**Tech Stack:** Node.js ESM, Node test runner, browser JavaScript, static JSON snapshot, NCCU public course endpoint, custom static bundle, Chrome browser verification.

## Global Constraints

- Use one vertical Red → Green → Refactor cycle at a time; never batch several failing tests before implementation.
- Preserve the last successful snapshot when synchronization fails or returns an implausible result.
- Treat the NCCU endpoint's 500-row response as capped; never describe a capped response as the complete catalog.
- Every displayed official fact must come from a normalized official field or explicitly cited official note/syllabus text.
- Non-synchronous courses consume no recurring grid time, but confirmed special events still participate in conflict checks.
- Advanced filtering must be pure and deterministic; Gemini/Groq must not decide whether a course passes a filter.
- Keep new visitors' workspace empty; the official index is searchable data, not a pre-populated candidate list.
- Do not modify or stage the unrelated `.impeccable/` directory.

---

### Task 1: Preserve complete official row fields

**Files:**
- Create: `tests/fixtures/nccu-course-complete.json`
- Modify: `src/nccu-course-adapter.mjs`
- Modify: `tests/nccu-course-adapter.test.mjs`

**Interfaces:**
- Extends `normalizeNccuRows(rows, term)` with stable official metadata.
- Adds `term`, `department`, `courseKind`, `degreeLevel`, `classGroup`, `language`, `emi`, `classroom`, `locationUrl`, `remainingUrl`, `settingsUrl`, and `rawOfficialNotes`.

- [ ] **Step 1: Add one representative official fixture and one failing normalization test**

Store a sanitized 115-1 response row in `tests/fixtures/nccu-course-complete.json`. Test only the first missing slice:

```js
test('normalizes official department, kind, and level fields', async () => {
  const rows = JSON.parse(await readFile(new URL('./fixtures/nccu-course-complete.json', import.meta.url)));
  const [course] = normalizeNccuRows(rows, '115-1');
  assert.equal(course.term, '115-1');
  assert.equal(course.department, '資訊');
  assert.equal(course.courseKind, String(rows[0].subKind || ''));
  assert.equal(course.degreeLevel, String(rows[0].gdeType || ''));
});
```

- [ ] **Step 2: Confirm Red**

Run: `node --test --test-name-pattern="department, kind" tests/nccu-course-adapter.test.mjs`

Expected: FAIL because the normalized object does not contain the new fields.

- [ ] **Step 3: Implement only these normalized fields**

Add the fields in `normalizeNccuRows`. Use empty strings for absent official values. The public row does not expose a separate unit label, so preserve `subGde` as `classGroup` and derive `department` conservatively: remove grade markers `一..八` and repeated class suffixes, then return a label only when every segment has the same nonempty prefix (`資訊三資訊四` → `資訊`); otherwise return `''`. Preserve `subUnitRuleUrl` separately as `departmentRuleUrl`; never use the URL text as a department name.

- [ ] **Step 4: Confirm Green and refactor through one string helper**

Run: `node --test tests/nccu-course-adapter.test.mjs`

Expected: PASS. Extract `officialText(value)` only after Green.

- [ ] **Step 5: Repeat the vertical cycle for teaching metadata**

Add one failing test, then implement: `teachers` split on `、`, `language`, `emi`, `classroom`, `locationUrl`. Preserve `teacher` as the joined display string for backward compatibility.

Run after each field group: `node --test tests/nccu-course-adapter.test.mjs`

- [ ] **Step 6: Repeat the vertical cycle for official action URLs and notes**

Add one failing test, then implement `syllabusUrl`, `remainingUrl`, `settingsUrl`, `rawOfficialNotes`, and continue exposing `sourceUrl` as the syllabus alias until storage migration is complete. Allow only trusted NCCU HTTPS links when rendering, not during raw normalization.

- [ ] **Step 7: Commit**

```bash
git add tests/fixtures/nccu-course-complete.json src/nccu-course-adapter.mjs tests/nccu-course-adapter.test.mjs
git commit -m "feat: preserve complete official course metadata"
```

### Task 2: Classify registration and category metadata

**Files:**
- Create: `src/nccu-course-metadata.mjs`
- Create: `tests/nccu-course-metadata.test.mjs`
- Modify: `src/nccu-course-adapter.mjs`
- Modify: `scripts/build.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `classifyCourseMetadata(normalizedCourse): CourseMetadata`.
- `CourseMetadata` contains `requirement`, `generalEducationDomains`, `programTags`, `signature`, `capacity`, `restriction`, and `delivery` with `status`, `sourceText`, and `confirmed` where relevant.

- [ ] **Step 1: Write the failing required/elective classification test**

```js
test('classifies explicit official required and elective labels', () => {
  assert.equal(classifyCourseMetadata({ courseKind: '必修' }).requirement, 'required');
  assert.equal(classifyCourseMetadata({ courseKind: '選修' }).requirement, 'elective');
  assert.equal(classifyCourseMetadata({ courseKind: '群修' }).requirement, 'group_elective');
});
```

- [ ] **Step 2: Confirm Red, implement the smallest mapping, confirm Green**

Run Red: `node --test tests/nccu-course-metadata.test.mjs`

Expected: `ERR_MODULE_NOT_FOUND`.

Implement the explicit mapping; unknown values return `unknown`.

Run Green: `node --test tests/nccu-course-metadata.test.mjs`

- [ ] **Step 3: Repeat one Red/Green cycle for general-education domains and program tags**

Use only the official category/note fields. Informational labels such as `日文系擴大輔系課程` become tags, never eligibility restrictions.

- [ ] **Step 4: Repeat one Red/Green cycle for add-sign and capacity metadata**

Expected shape:

```js
{
  signature: { required: true, sourceText: '需取得授課教師同意', confirmed: true },
  capacity: { limited: true, limit: 60, remainingUrl: 'https://es.nccu.edu.tw/...' },
}
```

Do not infer a numeric limit when the official row provides only a remaining-seat link.

- [ ] **Step 5: Repeat one Red/Green cycle for delivery**

Map explicit official text to `physical`, `synchronous`, `asynchronous`, `hybrid`, or `unverified`. A missing field is `unverified`, not `physical`.

- [ ] **Step 6: Integrate metadata into `nccuCourseToCandidate` and run regression**

Run: `node --test tests/nccu-course-metadata.test.mjs tests/nccu-course-adapter.test.mjs tests/nccu-course-notes.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/nccu-course-metadata.mjs tests/nccu-course-metadata.test.mjs src/nccu-course-adapter.mjs scripts/build.mjs package.json
git commit -m "feat: classify official course registration metadata"
```

### Task 3: Represent multiple teachers, meetings, and arrangements

**Files:**
- Modify: `src/nccu-course-adapter.mjs`
- Modify: `tests/nccu-course-adapter.test.mjs`
- Modify: `src/planner-core.mjs`
- Modify: `tests/planner-core.test.mjs`

**Interfaces:**
- `meetingsFromNccuText` continues returning all fixed meetings.
- Adds `arrangementsFromOfficialCourse(course)` for explicitly alternative arrangements.

- [ ] **Step 1: Write a failing multi-teacher/multi-meeting adapter test**

```js
test('keeps every official teacher and fixed meeting', () => {
  const candidate = nccuCourseToCandidate({
    courseCode: 'TEST001', title: '測試課', credits: 3,
    teacher: '甲老師、乙老師、丙老師', scheduleText: '二34C 四D56',
  });
  assert.deepEqual(candidate.teachers, ['甲老師', '乙老師', '丙老師']);
  assert.deepEqual(candidate.meetings.map(({ label }) => label), ['二34C', '四D56']);
});
```

- [ ] **Step 2: Confirm Red, implement, confirm Green**

Run: `node --test --test-name-pattern="every official teacher" tests/nccu-course-adapter.test.mjs`

Expected: FAIL on `teachers`. Implement the array without changing `teacher` display text.

- [ ] **Step 3: Write a failing alternative-arrangement test**

Use the known `人工智慧實務專題` note fixture with `每週二34C或另約討論時間(中午時段也可以)`. Expect one fixed arrangement and one `time_undetermined` arrangement, each preserving source text.

- [ ] **Step 4: Implement arrangements and verify planner selection**

Only the selected arrangement contributes recurring meetings. Do not merge alternatives into simultaneous meetings.

Run: `node --test tests/nccu-course-adapter.test.mjs tests/planner-core.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/nccu-course-adapter.mjs tests/nccu-course-adapter.test.mjs src/planner-core.mjs tests/planner-core.test.mjs
git commit -m "feat: support official multi-teacher arrangements"
```

### Task 4: Parse confirmed special dates conservatively

**Files:**
- Create: `src/nccu-special-events.mjs`
- Create: `tests/nccu-special-events.test.mjs`
- Modify: `src/nccu-course-notes.mjs`
- Modify: `scripts/build.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `parseConfirmedSpecialEvents({ text, sourceType }): SpecialEvent[]`.
- `SpecialEvent = { date: 'MM/DD', label: string, sourceType: 'official-row'|'official-syllabus', sourceText: string, status: 'confirmed' }`.

- [ ] **Step 1: Write a failing explicit-date test**

```js
test('parses an explicit official exam date with evidence', () => {
  assert.deepEqual(parseConfirmedSpecialEvents({
    text: '期末考於 12/26 共同考試', sourceType: 'official-row',
  }), [{
    date: '12/26', label: '期末考／共同考試', sourceType: 'official-row',
    sourceText: '期末考於 12/26 共同考試', status: 'confirmed',
  }]);
});
```

- [ ] **Step 2: Confirm Red, implement explicit dates only, confirm Green**

Run: `node --test tests/nccu-special-events.test.mjs`

Expected: `ERR_MODULE_NOT_FOUND`, then PASS after implementation.

- [ ] **Step 3: Write a failing anti-fabrication test**

Text such as `期末將安排共同考試` without a date must return `[]`. A date without an adjacent event keyword also returns `[]`.

- [ ] **Step 4: Implement the conservative guard and integrate notes**

Run: `node --test tests/nccu-special-events.test.mjs tests/nccu-course-notes.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/nccu-special-events.mjs tests/nccu-special-events.test.mjs src/nccu-course-notes.mjs scripts/build.mjs package.json
git commit -m "feat: preserve confirmed official course events"
```

### Task 5: Collect a complete capped official semester

**Files:**
- Create: `scripts/sync-nccu-catalog.mjs`
- Create: `src/nccu-catalog-sync.mjs`
- Create: `tests/nccu-catalog-sync.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `collectNccuSemester({ term, search, prefixes, cap, now }): Snapshot`.
- `Snapshot = { schemaVersion: 1, term, generatedAt, lastSuccessfulSyncAt, courseCount, courses }`.

- [ ] **Step 1: Write the failing recursive-cap test**

Use a fake search boundary that returns exactly `cap` rows for prefix `70`, and fewer rows for `700` and `701`. Expect the collector to subdivide with `0-9A-Z`, filter `courseCode.startsWith(prefix)`, and deduplicate by `term + courseCode`.

- [ ] **Step 2: Confirm Red**

Run: `node --test tests/nccu-catalog-sync.test.mjs`

Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the smallest recursive collector**

Rules:

```text
seed prefixes: 00..99 and A..Z
raw count < 500: accept only rows whose courseCode begins with the requested prefix
raw count = 500: query prefix + each of 0..9A..Z
maximum prefix length: 6; reaching the cap at length 6 throws IncompleteCatalogError
dedupe key: `${term}:${courseCode}`
concurrency: 2
retry: 2 with 250 ms then 750 ms delay
```

- [ ] **Step 4: Confirm Green, then add one failing last-known-good test**

When any prefix is incomplete, the CLI must not overwrite the existing snapshot. Implement by writing a temporary file, validating it, then renaming atomically.

- [ ] **Step 5: Add deterministic CLI output**

`npm run catalog:sync` writes `data/nccu-1151-catalog.json` only after validation. It prints term, count, generated time, and the number of subdivided prefixes; it never prints course notes or user data.

- [ ] **Step 6: Run unit tests and one manual dry run**

Run: `node --test tests/nccu-catalog-sync.test.mjs`

Run: `npm run catalog:sync -- --dry-run`

Expected: complete snapshot metadata is printed and no tracked file changes.

- [ ] **Step 7: Commit the collector before committing generated data**

```bash
git add scripts/sync-nccu-catalog.mjs src/nccu-catalog-sync.mjs tests/nccu-catalog-sync.test.mjs package.json
git commit -m "feat: collect complete capped NCCU catalog"
```

### Task 6: Validate and embed the versioned snapshot

**Files:**
- Create: `data/nccu-1151-catalog.json`
- Create: `src/course-index.mjs`
- Create: `tests/course-index.test.mjs`
- Modify: `scripts/build.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `validateCourseSnapshot(snapshot)` and `loadEmbeddedCourseIndex()`.

- [ ] **Step 1: Write the failing snapshot schema test**

Require `schemaVersion === 1`, `term === '115-1'`, valid ISO timestamps, unique nine-character course codes, `courseCount === courses.length`, and every course to include its required stable fields.

- [ ] **Step 2: Confirm Red, implement the validator, confirm Green**

Run: `node --test tests/course-index.test.mjs`

- [ ] **Step 3: Generate and inspect the real snapshot**

Run: `npm run catalog:sync`

Expected: `data/nccu-1151-catalog.json` is written with a nonzero complete course count and passes `node --test tests/course-index.test.mjs`.

- [ ] **Step 4: Embed the snapshot at build time**

Read the JSON in `scripts/build.mjs`, validate it, and insert only the normalized data and freshness metadata into the client bundle. The build must fail instead of silently embedding demo courses when the snapshot is invalid.

- [ ] **Step 5: Verify an empty first-use candidate list**

Add one rendered test proving the official index is available to the search panel while `createStartupCatalog` still returns no candidates for a new visitor.

- [ ] **Step 6: Commit**

```bash
git add data/nccu-1151-catalog.json src/course-index.mjs tests/course-index.test.mjs scripts/build.mjs package.json tests/rendered-html.test.mjs
git commit -m "feat: embed versioned NCCU 115-1 course index"
```

### Task 7: Implement normalized keyword search

**Files:**
- Create: `src/course-search.mjs`
- Create: `tests/course-search.test.mjs`
- Modify: `scripts/build.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `normalizeSearchText(value)` and `searchOfficialCourses(courses, query)`.

- [ ] **Step 1: Write a failing normalization and ranking test**

Expect full-width Latin/digits, repeated spaces, and English case to normalize. An exact course-code match ranks before a title/teacher substring.

- [ ] **Step 2: Confirm Red, implement, confirm Green**

Run: `node --test tests/course-search.test.mjs`

Expected: `ERR_MODULE_NOT_FOUND`, then PASS.

- [ ] **Step 3: Add one failing department/tag search test**

Implement matching across title, all teachers, course code, department, general-education domains, and program tags. Return `{ course, score, reasons }` with stable reason strings.

- [ ] **Step 4: Refactor scoring constants and commit**

```bash
git add src/course-search.mjs tests/course-search.test.mjs scripts/build.mjs package.json
git commit -m "feat: add ranked official course search"
```

### Task 8: Add composable official-field filters

**Files:**
- Modify: `src/course-search.mjs`
- Modify: `tests/course-search.test.mjs`

**Interfaces:**
- Adds `filterOfficialCourses(results, filters)`.

- [ ] **Step 1: Write one failing day/period filter test, implement, and confirm Green**

Days use `1..7`; periods use NCCU codes `A B 1 2 3 4 C D 5 6 7 8 E F G H`. Alternative arrangements match if at least one selectable arrangement satisfies the filter.

- [ ] **Step 2: Repeat separate Red/Green cycles for each filter family**

In this exact order, one failing test and one minimal implementation per cycle:

1. department multi-select;
2. required/elective/group/general-education;
3. general-education domain and program tag;
4. credit minimum/maximum;
5. delivery and time-undetermined;
6. language and EMI;
7. syllabus status;
8. signature/capacity/eligibility restriction;
9. exclude early, late, or chosen weekdays.

- [ ] **Step 3: Add clear-all behavior**

`emptyOfficialFilters()` must pass every result and must not mutate the caller's object.

- [ ] **Step 4: Run the focused suite and commit**

Run: `node --test tests/course-search.test.mjs`

```bash
git add src/course-search.mjs tests/course-search.test.mjs
git commit -m "feat: compose official course filters"
```

### Task 9: Add deterministic personal compatibility filters

**Files:**
- Modify: `src/course-search.mjs`
- Modify: `tests/course-search.test.mjs`
- Modify: `src/internship-planner.mjs`
- Modify: `tests/internship-planner.test.mjs`

**Interfaces:**
- Adds `evaluateCourseCompatibility(course, context)` and compatibility filters.

- [ ] **Step 1: Write a failing recurring-conflict test**

Expect a physical course overlapping a selected course to fail with both course names and periods. Expect a confirmed asynchronous course with no recurring meeting to pass.

- [ ] **Step 2: Confirm Red, implement through existing conflict primitives, confirm Green**

Do not duplicate interval logic; adapt the candidate to `findConflicts` or extract a shared pure helper under test.

- [ ] **Step 3: Repeat separate Red/Green cycles**

Add, in order:

1. manual activity conflict;
2. confirmed special-event conflict;
3. eligibility using current condition selections;
4. internship target after tentative addition;
5. target-credit contribution.

Each returns `{ passes, reasons, blockers }`; the UI never recomputes these decisions from prose.

- [ ] **Step 4: Run regression and commit**

Run: `node --test tests/course-search.test.mjs tests/planner-core.test.mjs tests/internship-planner.test.mjs`

```bash
git add src/course-search.mjs tests/course-search.test.mjs src/internship-planner.mjs tests/internship-planner.test.mjs
git commit -m "feat: filter courses by planner compatibility"
```

### Task 10: Build the advanced-search interface

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/browser/sunbreak-critical-flows.md`

**Interfaces:**
- Adds simple/advanced modes, selected-filter chips, result sort, clear-all, exclusion explanation, and official data freshness.

- [ ] **Step 1: Write one failing interaction-contract test**

Assert stable controls: `data-course-search-mode`, `data-course-filter`, `data-clear-course-filters`, `data-course-sort`, and `data-course-freshness`.

- [ ] **Step 2: Confirm Red, add accessible structure, confirm Green**

Run: `node --test --test-name-pattern="advanced course filters" tests/rendered-html.test.mjs`

Use native buttons, labels, fieldsets, and checkboxes. Advanced filters are collapsed initially; simple search remains immediately usable.

- [ ] **Step 3: Write a failing result-explanation test**

Every result must render its schedule, delivery, eligibility, syllabus state, and one deterministic compatibility explanation. When no result remains, list active blockers and provide one button per filter to remove it.

- [ ] **Step 4: Implement result rendering and compact responsive CSS**

At 390 px the result card must not horizontally scroll, action targets remain at least 44 px, and the filter drawer traps no focus. Apply `frontend-design`, `emil-design-eng`, and `ui-ux-pro-max` during this task.

- [ ] **Step 5: Verify automated and Chrome flows**

Run: `npm run verify`

In Chrome at 1440×900 and 390×844 verify keyword ranking, three combined official filters, each personal filter, clear-all, no-result relaxation, add candidate, refresh existing course, no horizontal overflow, and no console errors.

- [ ] **Step 6: Record and commit**

```bash
git add src/index.html src/app.mjs src/styles.css tests/rendered-html.test.mjs tests/browser/sunbreak-critical-flows.md
git commit -m "feat: add explainable advanced course search"
```

### Task 11: Verify the real NCCU index boundary

**Files:**
- Modify: `tests/nccu-live-contract.test.mjs`
- Modify: `tests/browser/sunbreak-critical-flows.md`

**Interfaces:**
- Verifies fields the product actually renders and filters.

- [ ] **Step 1: Add a live contract for required response fields**

Query one known 115-1 course and assert course code, title, credits, all teacher text, all meeting text, official note fields, and trusted source URLs match the adapter contract.

- [ ] **Step 2: Run contract and keep external failures explicit**

Run: `npm run test:contract:nccu`

Expected: PASS. If NCCU is unavailable, report the boundary failure and retain the last successful snapshot; do not rewrite mocks or lower assertions.

- [ ] **Step 3: Run the full release gate**

Run: `npm run verify && git diff --check`

Expected: PASS and no whitespace errors.

- [ ] **Step 4: Commit and push this phase**

```bash
git add tests/nccu-live-contract.test.mjs tests/browser/sunbreak-critical-flows.md
git commit -m "test: verify complete NCCU catalog boundary"
git push origin feature/sunbreak-redesign
```
