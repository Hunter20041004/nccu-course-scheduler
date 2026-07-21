# Official Refresh Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach first-time users how to refresh official NCCU course data, interpret syllabus states, and recover safely from refresh failures.

**Architecture:** Keep the existing native eight-step tour in `src/app.mjs` and nine-chapter tutorial dialog in `src/index.html`. Add only copy-level assertions to the rendered HTML test because the requested behavior is the instructional content itself.

**Tech Stack:** HTML, browser-native JavaScript modules, Node.js test runner, custom build renderer.

## Global Constraints

- Follow Red → Green → Refactor one vertical slice at a time.
- Do not alter scheduling, persistence, official-data reconciliation, or syllabus-state behavior.
- Keep exactly eight quick-tour steps and nine tutorial chapters.
- Use the existing interface terms exactly: `更新官方資料`, `可以查看課綱`, `老師尚未上傳課綱`, `課綱狀態暫時無法確認`.
- Add no dependencies and no new dialogs.

---

### Task 1: Teach official refresh in the quick tour

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/app.mjs`

**Interfaces:**
- Consumes: `quickTourSteps[2]` and the existing `catalog-list` spotlight target.
- Produces: quick-tour copy that names the refresh action and preserved decisions.

- [ ] Add `更新官方資料` and `保留選課、鎖定、上課方式與班別安排` assertions to the scoped `stepBlock` test.
- [ ] Run `npm run build && node --test --test-name-pattern="aligns the first-use message" tests/rendered-html.test.mjs`; expect failure because step three lacks both phrases.
- [ ] Replace step three body with: `按「詳細」查看完整資料；已在候選的課可用「更新官方資料」補齊最新官方欄位，並保留選課、鎖定、上課方式與班別安排。課綱與其他管理操作在「•••」。`
- [ ] Rerun the focused test; expect pass.
- [ ] Refactor only for readability while retaining the two asserted phrases; rerun the focused test.

### Task 2: Teach refresh preservation in the full tutorial

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`

**Interfaces:**
- Consumes: `#tutorial-center` and `#guide-import`.
- Produces: a searchable explanation of adding new courses versus updating existing ones.

- [ ] Add one test scoped to the tutorial dialog for `更新官方資料` and `保留你目前的選課、鎖定、上課方式與班別安排`.
- [ ] Run that test; expect failure because the tutorial currently only teaches `加入候選`.
- [ ] Update the first `#guide-import` step to explain `加入候選` for new results and `更新官方資料` for existing results, including the exact preservation sentence.
- [ ] Rerun the focused test; expect pass.

### Task 3: Teach the three syllabus states

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`

**Interfaces:**
- Consumes: `#guide-details`.
- Produces: definitions for the three user-visible syllabus states and their next actions.

- [ ] Add one tutorial-scoped test for `可以查看課綱`, `老師尚未上傳課綱`, `課綱狀態暫時無法確認`, and `重新查詢官方資料`.
- [ ] Run that test; expect failure because the tutorial only mentions whether a safe link exists.
- [ ] Replace the final syllabus instruction with concise definitions: available opens the official syllabus; not uploaded means the official lookup succeeded but the teacher has not supplied a link; temporarily unverifiable means the lookup could not be completed and can be retried.
- [ ] Rerun the focused test; expect pass.

### Task 4: Teach failure recovery and durable success

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`

**Interfaces:**
- Consumes: `#guide-export-faq`.
- Produces: a recovery answer that matches the already implemented reconciler behavior.

- [ ] Add one tutorial-scoped test for `重新查詢失敗時，原有候選課程與排課資料會保留` and `更新成功後，重新整理網頁仍會保留新的官方資料`.
- [ ] Run that test; expect failure because the FAQ has no official-refresh recovery entry.
- [ ] Add one FAQ item with those exact sentences and tell the user to retry later.
- [ ] Rerun the focused test; expect pass.
- [ ] Run `npm run verify`; expect all unit, build, rendered HTML, syntax, and live NCCU contract tests to pass.
