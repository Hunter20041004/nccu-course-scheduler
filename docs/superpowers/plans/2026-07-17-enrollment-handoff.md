# Safe Enrollment Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let students turn a validated Sunbreak schedule into an ordered, local-only enrollment checklist that safely hands course codes to the official NCCU system without handling credentials or pretending enrollment is complete.

**Architecture:** A pure handoff module owns priority order and validation independently of catalog/schedule state. A separate batch-format capability is closed by default and can be enabled only by a verified 115-1 contract fixture. The first release always supports the safe fallback: copy ordered nine-character course codes, open a trusted NCCU selection URL, and show an explicit user-completed checklist.

**Tech Stack:** Node.js ESM, browser JavaScript, Node test runner, Clipboard API with accessible fallback, trusted NCCU HTTPS links, custom static bundle, Chrome browser verification.

## Global Constraints

- Use one Red → Green → Refactor vertical slice at a time.
- Never request, store, transmit, or log NCCU usernames, passwords, CAPTCHA values, cookies, or authenticated sessions.
- Never submit an enrollment request, click a final official submit button, or claim that a course was enrolled.
- Only official courses in term 115-1 with a valid nine-character course code can enter the handoff.
- Manual activities, internship blocks, clubs, undetermined sections, missing official courses, and duplicate codes are excluded with an explanation.
- The fallback remains available when the official site changes or the batch contract is unverified.
- Batch output stays disabled until a reproducible 115-1 fixture and a non-submitting real-boundary check both pass.
- Preserve priority order locally with the existing planner state; no server persistence.
- Do not modify or stage the unrelated `.impeccable/` directory.

---

### Task 1: Build a valid ordered handoff list

**Files:**
- Create: `src/enrollment-handoff.mjs`
- Create: `tests/enrollment-handoff.test.mjs`
- Modify: `scripts/build.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `buildEnrollmentHandoff({ priorityIds, selectedCourses, officialIndex, term }): EnrollmentHandoff`.
- `EnrollmentHandoff = { term, eligible, blocked, warnings }`.

- [ ] **Step 1: Write the failing happy-path test**

```js
test('preserves priority order for selected official 115-1 courses', () => {
  const result = buildEnrollmentHandoff({
    term: '115-1', priorityIds: ['b', 'a'],
    selectedCourses: [
      { id: 'a', sectionCode: '703055001', source: 'nccu-verified-import', title: '人機互動' },
      { id: 'b', sectionCode: '070424001', source: 'nccu-verified-import', title: '金融科技導論' },
    ],
    officialIndex: [
      { term: '115-1', courseCode: '703055001' },
      { term: '115-1', courseCode: '070424001' },
    ],
  });
  assert.deepEqual(result.eligible.map(({ courseCode }) => courseCode), ['070424001', '703055001']);
  assert.deepEqual(result.blocked, []);
});
```

- [ ] **Step 2: Confirm Red**

Run: `node --test tests/enrollment-handoff.test.mjs`

Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement only valid official selection and ordering**

Require selection membership, official source, `term`, and `/^[0-9A-Z]{9}$/`. Return new objects; do not mutate courses or `priorityIds`.

- [ ] **Step 4: Confirm Green and refactor code lookup maps**

Run: `node --test tests/enrollment-handoff.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/enrollment-handoff.mjs tests/enrollment-handoff.test.mjs scripts/build.mjs package.json
git commit -m "feat: build ordered official enrollment handoff"
```

### Task 2: Explain blocked handoff entries

**Files:**
- Modify: `src/enrollment-handoff.mjs`
- Modify: `tests/enrollment-handoff.test.mjs`

**Interfaces:**
- `blocked[] = { id, title, reasonCode, message }`.

- [ ] **Step 1: Write one failing manual-activity exclusion test**

Expect `reasonCode: 'not_official_course'` and `社團或個人行程不能交接到正式選課`.

- [ ] **Step 2: Confirm Red, implement, confirm Green**

Run: `node --test --test-name-pattern="manual activity" tests/enrollment-handoff.test.mjs`

- [ ] **Step 3: Repeat independent Red/Green cycles**

In order:

1. malformed/missing nine-character code → `invalid_course_code`;
2. wrong term → `wrong_term`;
3. no longer present in last successful official index → `missing_official_course`;
4. alternative section not selected → `section_not_selected`;
5. duplicate course code → `duplicate_course_code`.

- [ ] **Step 4: Add non-blocking warnings in separate cycles**

Known eligibility, signature, capacity, and recurring-conflict issues become warnings with source-backed copy. They do not imply the official system will accept the course.

- [ ] **Step 5: Run and commit**

Run: `node --test tests/enrollment-handoff.test.mjs`

```bash
git add src/enrollment-handoff.mjs tests/enrollment-handoff.test.mjs
git commit -m "feat: explain enrollment handoff blockers"
```

### Task 3: Manage priority order without losing locked courses

**Files:**
- Modify: `src/enrollment-handoff.mjs`
- Modify: `tests/enrollment-handoff.test.mjs`
- Modify: `src/planner-storage.mjs`
- Modify: `tests/planner-storage.test.mjs`

**Interfaces:**
- Adds `addPriorityCourse`, `removePriorityCourse`, and `movePriorityCourse`.
- Storage version advances from the syllabus phase's version `6` to `7` with `enrollmentPriorityIds`.

- [ ] **Step 1: Write a failing add-without-duplicate test**

Adding an existing ID leaves order unchanged; adding a new selected ID appends it.

- [ ] **Step 2: Confirm Red, implement, confirm Green**

Run: `node --test --test-name-pattern="priority course" tests/enrollment-handoff.test.mjs`

- [ ] **Step 3: Write a failing keyboard-order test**

Moving the first item up and the last item down are no-ops; moving the middle item updates one position and preserves all IDs.

- [ ] **Step 4: Implement move/remove and confirm Green**

Run: `node --test tests/enrollment-handoff.test.mjs`

- [ ] **Step 5: Write a failing storage migration test**

A version-6 state migrates to `enrollmentPriorityIds: []`; a version-7 state round-trips order while preserving selected, locked, attendance, activities, and internship settings.

- [ ] **Step 6: Implement storage version 7 and run regression**

Run: `node --test tests/planner-storage.test.mjs tests/enrollment-handoff.test.mjs`

- [ ] **Step 7: Commit**

```bash
git add src/enrollment-handoff.mjs tests/enrollment-handoff.test.mjs src/planner-storage.mjs tests/planner-storage.test.mjs
git commit -m "feat: persist enrollment priority order"
```

### Task 4: Produce the safe fallback payload

**Files:**
- Modify: `src/enrollment-handoff.mjs`
- Modify: `tests/enrollment-handoff.test.mjs`

**Interfaces:**
- Adds `createCourseCodeFallback(handoff): { text, courseCodes, count }`.

- [ ] **Step 1: Write the failing payload test**

```js
test('copies one ordered course code per line without personal data', () => {
  const payload = createCourseCodeFallback({ eligible: [
    { courseCode: '070424001', title: '金融科技導論' },
    { courseCode: '703055001', title: '人機互動' },
  ] });
  assert.equal(payload.text, '070424001\n703055001');
  assert.equal(payload.count, 2);
});
```

- [ ] **Step 2: Confirm Red, implement, confirm Green**

Run: `node --test --test-name-pattern="one ordered course code" tests/enrollment-handoff.test.mjs`

- [ ] **Step 3: Add a failing blocked-only test**

Blocked entries never appear in `text`; an empty eligible list returns empty text and count zero.

- [ ] **Step 4: Implement, refactor formatting, and commit**

```bash
git add src/enrollment-handoff.mjs tests/enrollment-handoff.test.mjs
git commit -m "feat: create safe course-code handoff"
```

### Task 5: Keep batch format closed until verified

**Files:**
- Create: `src/nccu-batch-format.mjs`
- Create: `tests/nccu-batch-format.test.mjs`
- Modify: `scripts/build.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `batchCapability(contract)` and `createVerifiedBatchPayload(handoff, contract)`.
- Default contract is `{ term: '115-1', verified: false, formatVersion: null, fixtureHash: null }`.

- [ ] **Step 1: Write the failing closed-capability test**

```js
test('keeps batch output disabled without a verified contract', () => {
  assert.deepEqual(batchCapability(), {
    enabled: false,
    reason: '115-1 批量格式尚未完成真實驗證，請使用九碼課號交接。',
  });
  assert.throws(() => createVerifiedBatchPayload({ eligible: [] }), /尚未完成真實驗證/);
});
```

- [ ] **Step 2: Confirm Red, implement the closed default, confirm Green**

Run: `node --test tests/nccu-batch-format.test.mjs`

- [ ] **Step 3: Add a failing fake-verification rejection test**

`verified: true` without `formatVersion`, `fixtureHash`, and an exact `term: '115-1'` still remains disabled. Do not add a fabricated positive fixture.

- [ ] **Step 4: Implement rejection and commit**

```bash
git add src/nccu-batch-format.mjs tests/nccu-batch-format.test.mjs scripts/build.mjs package.json
git commit -m "feat: gate unverified NCCU batch format"
```

### Task 6: Open only a trusted official selection entry

**Files:**
- Modify: `src/enrollment-handoff.mjs`
- Modify: `tests/enrollment-handoff.test.mjs`

**Interfaces:**
- Adds `trustedNccuSelectionUrl(value)` and `DEFAULT_NCCU_SELECTION_URL`.

- [ ] **Step 1: Write the failing trusted-host test**

Allow only `https:` on `nccu.edu.tw` or a subdomain. Reject `javascript:`, `http:`, lookalike domains, embedded credentials, and URLs containing course codes or personal query parameters.

- [ ] **Step 2: Confirm Red, implement, confirm Green**

Run: `node --test --test-name-pattern="trusted official selection" tests/enrollment-handoff.test.mjs`

- [ ] **Step 3: Add a real-boundary reachability test without login or submission**

Extend `tests/nccu-live-contract.test.mjs` to request the public official selection landing page using `GET` with redirects disabled. Accept the documented public success/redirect status and verify every redirect remains on a trusted NCCU HTTPS host. Do not follow into authentication and do not send course data.

- [ ] **Step 4: Commit**

```bash
git add src/enrollment-handoff.mjs tests/enrollment-handoff.test.mjs tests/nccu-live-contract.test.mjs
git commit -m "test: verify trusted NCCU selection entry"
```

### Task 7: Add the priority and handoff interface

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Adds an `正式選課交接` panel with priority list, move controls, blockers/warnings, copy action, and official-link action.

- [ ] **Step 1: Write the failing rendered interaction test**

Require stable hooks:

```text
data-enrollment-handoff
data-add-enrollment-priority
data-move-enrollment-priority="up|down"
data-remove-enrollment-priority
data-copy-course-codes
data-open-nccu-selection
```

- [ ] **Step 2: Confirm Red, implement accessible static structure, confirm Green**

Run: `node --test --test-name-pattern="enrollment handoff controls" tests/rendered-html.test.mjs`

Use ordered-list semantics, native buttons, and explicit accessible names. Dragging may be added as progressive enhancement; up/down buttons are the guaranteed keyboard/mobile control.

- [ ] **Step 3: Write a failing state-flow test**

Verify only selected official candidates can be added, changes persist, locked courses remain locked, and removing from priority does not remove from the schedule.

- [ ] **Step 4: Implement state handlers and render blockers/warnings**

The panel headline says `準備交接至政大正式選課`; never say `已匯入` or `已完成選課`.

- [ ] **Step 5: Style responsive priority rows**

At 390 px controls wrap without overlap, buttons remain at least 44 px, and long course names truncate visually while remaining fully available to assistive technology. Apply `frontend-design`, `emil-design-eng`, and `ui-ux-pro-max` during this task.

- [ ] **Step 6: Commit**

```bash
git add src/index.html src/app.mjs src/styles.css tests/rendered-html.test.mjs
git commit -m "feat: add enrollment handoff interface"
```

### Task 8: Copy safely with a visible fallback

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Uses `navigator.clipboard.writeText` only from a user gesture.
- Falls back to a selected read-only `<textarea>` when clipboard permission or API access fails.

- [ ] **Step 1: Write a failing clipboard-failure test contract**

The rendered bundle must catch clipboard rejection, reveal the fallback text area, select it, and announce `無法自動複製，請長按或按 Command/Ctrl+C 複製。` through an `aria-live` region.

- [ ] **Step 2: Confirm Red, implement, confirm Green**

Run: `node --test --test-name-pattern="clipboard fallback" tests/rendered-html.test.mjs`

- [ ] **Step 3: Add the success state**

After a successful copy, announce `已複製 N 門課的九碼課號；下一步請到政大官方系統逐筆確認。` Do not include codes in logs or analytics.

- [ ] **Step 4: Commit**

```bash
git add src/app.mjs src/styles.css tests/rendered-html.test.mjs
git commit -m "feat: add resilient local-only code copy"
```

### Task 9: Add the user-completed official checklist

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Shows the sequence: copy → open official page → sign in there → enter codes → review official warnings → submit there → confirm `作業完成` there.

- [ ] **Step 1: Write the failing safety-copy test**

Assert the checklist includes `Sunbreak 不會替你登入或送出選課` and `請在政大頁面看到「作業完成」後再離開`.

- [ ] **Step 2: Confirm Red, implement, confirm Green**

Run: `node --test --test-name-pattern="作業完成" tests/rendered-html.test.mjs`

- [ ] **Step 3: Add the official-link behavior**

Open the trusted official URL in a new tab with `noopener,noreferrer`. If popup opening fails, expose a normal anchor using the same trusted URL.

- [ ] **Step 4: Commit**

```bash
git add src/index.html src/app.mjs src/styles.css tests/rendered-html.test.mjs
git commit -m "feat: explain official enrollment completion"
```

### Task 10: Verify the complete handoff without submitting enrollment

**Files:**
- Modify: `tests/browser/sunbreak-critical-flows.md`
- Modify: `README.md`

**Interfaces:**
- Verifies local-only state, official-link trust, responsive behavior, and portfolio documentation.

- [ ] **Step 1: Run the full automated gate**

Run: `npm run verify && git diff --check`

Expected: PASS.

- [ ] **Step 2: Verify desktop Chrome flow**

At 1440×900:

```text
add three selected official courses to priority
move the third to first with buttons
remove the middle priority without removing it from the schedule
confirm blocked manual activity explanation
copy codes and verify order
open official entry and verify trusted NCCU host
do not log in and do not submit anything
confirm no console errors
```

- [ ] **Step 3: Verify mobile Chrome flow**

At 390×844 verify priority controls, clipboard fallback, official-link fallback, no horizontal overflow, no covered controls, and readable warning/checklist copy.

- [ ] **Step 4: Update documentation**

Document the boundary: Sunbreak prepares and copies a checklist; the user completes selection on NCCU. Document that batch output is intentionally disabled pending a verified 115-1 contract.

- [ ] **Step 5: Record, commit, and push**

```bash
git add tests/browser/sunbreak-critical-flows.md README.md
git commit -m "docs: verify safe NCCU enrollment handoff"
git push origin feature/sunbreak-redesign
```
