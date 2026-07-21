# Task-Based Tutorial Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the first-use welcome, native eight-step tour, and permanent tutorial center so a new student can complete the current Sunbreak scheduling flow without outside help.

**Architecture:** Keep the existing static single-page architecture and native `dialog`/spotlight controllers. Update tutorial content in `src/index.html`, keep quick-tour state in the existing `quickTourSteps` array in `src/app.mjs`, and add only tutorial-specific responsive presentation rules in `src/styles.css`.

**Tech Stack:** HTML, CSS, browser-native JavaScript modules, Node.js test runner, custom build script, Playwright CLI with Chrome.

## Global Constraints

- Follow Red → Green → Refactor one vertical slice at a time.
- Do not change planner data, scheduling, eligibility, AI, storage, or export behavior.
- General course search and scheduling remain usable without an API Key.
- Gemini API Keys remain memory-only and clear on reload or tab close.
- Keep exactly eight native quick-tour steps and nine full tutorial chapters.
- Every quick-tour step keeps a visible spotlight and never mutates planner data.
- Mobile chapter navigation remains horizontally scrollable; controls remain at least 44×44px.
- Do not add dependencies.

---

### Task 1: Replace the full tutorial center with nine task-based chapters

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`

**Interfaces:**
- Consumes: existing `#tutorial-center`, `.tutorial-center-nav`, `.tutorial-center-body`, and `#restart-quick-tour` hooks.
- Produces: `guide-first-run`, `guide-import`, `guide-details`, `guide-conditions`, `guide-schedule`, `guide-attendance`, `guide-internship`, `guide-ai`, and `guide-export-faq`.

- [ ] **Step 1: Write one failing rendered-HTML test**

```js
test('teaches the complete current scheduling workflow in nine task-based chapters', async () => {
  const html = await (await render()).text();
  const sectionIds = [
    'guide-first-run', 'guide-import', 'guide-details', 'guide-conditions',
    'guide-schedule', 'guide-attendance', 'guide-internship', 'guide-ai',
    'guide-export-faq',
  ];

  for (const id of sectionIds) assert.match(html, new RegExp(`id="${id}"`));
  for (const copy of [
    '政大 115-1 課程庫', 'AI 截圖辨識', '手動新增', '課程時間',
    '完整詳細資料', '官方課綱', '條件不符合，請看詳細。',
    '清空目前課表', '清空候選課程', '實體／同步／非同步',
    '固定實習時段', '三個推薦方案', '匯出手機桌布',
  ]) assert.match(html, new RegExp(copy));
  assert.match(html, /API Key 等同使用者自己的額度，請不要傳給別人/);
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
npm run build && node --test --test-name-pattern="complete current scheduling workflow" tests/rendered-html.test.mjs
```

Expected: FAIL because `guide-details`, `guide-attendance`, and `guide-export-faq` do not exist and current workflow copy is missing.

- [ ] **Step 3: Implement the nine chapters in `src/index.html`**

Update `.tutorial-center-nav` to link to all nine IDs. Each body section contains explicit steps and results/notes. The new detailed-course section is:

```html
<section id="guide-details">
  <h3>查看課程時間、詳細資料與課綱</h3>
  <ol>
    <li>候選課程列會直接顯示課程時間與政大節次代號。</li>
    <li>按「詳細」會在該課程下方展開完整詳細資料；同時間只會展開一門。</li>
    <li>詳細資料包含課號、教師、學分、上課形式、修課資格、官方備註與班別時段。</li>
    <li>按「課綱」或「開啟官方課綱」可查看政大官方課綱。</li>
  </ol>
</section>
```

The schedule management section must include:

```html
<section id="guide-schedule">
  <h3>加入、鎖定、刪除與清空</h3>
  <ol>
    <li>點候選課程主區塊可加入或移出左側課表。</li>
    <li>按「鎖定」可保留任何課程，AI 套用方案時不會移除。</li>
    <li>按「刪除」會移除該候選課程及其課表區塊。</li>
    <li>「清空目前課表」只清除已排課程；「清空候選課程」會清除整份候選清單。</li>
  </ol>
</section>
```

The attendance section must include:

```html
<section id="guide-attendance">
  <h3>實體／同步／非同步與衝堂</h3>
  <ol>
    <li>可遠距課程可切換「實體／同步／非同步」的實際修課方式。</li>
    <li>非同步不占每週固定時段，但同步活動、考試或一次性活動仍可能衝堂。</li>
    <li>有多個官方時段的課程必須先選擇其中一種安排。</li>
    <li>出現衝堂提醒時，請更換時段、改為允許的非同步形式，或移除其中一門。</li>
  </ol>
</section>
```

The other six sections cover the exact approved spec: local storage boundaries, three import paths, eligibility conditions, internship/personal events, AI Key safety and three recommendations, wallpaper export, and troubleshooting.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Step 2 command. Expected: PASS with zero failures.

- [ ] **Step 5: Refactor copy and rerun**

Use these exact terms everywhere: `候選課程`, `課表`, `詳細`, `課綱`, `鎖定`, `刪除`, `實體／同步／非同步`, `Gemini API Key`.

Run the Step 2 command again. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/rendered-html.test.mjs src/index.html
git commit -m "docs: teach the complete scheduling workflow"
```

### Task 2: Synchronize the first-use welcome and eight-step tour

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`
- Modify: `src/app.mjs`

**Interfaces:**
- Consumes: `#first-use-dialog`, `quickTourSteps`, `renderQuickTourStep()`, and existing tour targets.
- Produces: one four-stage first-use mental model and exactly eight current-feature tour steps.

- [ ] **Step 1: Write one failing synchronization test**

```js
test('aligns the first-use message and eight-step tour with the current workflow', async () => {
  const html = await (await render()).text();

  for (const copy of ['搜尋或匯入課程', '加入候選清單', '檢查時間與修課條件', '加入課表並處理衝堂']) {
    assert.match(html, new RegExp(copy));
  }
  const stepBlock = html.match(/const quickTourSteps = \[([\s\S]*?)\n\];/)?.[1] ?? '';
  assert.equal((stepBlock.match(/target:/g) ?? []).length, 8);
  for (const copy of [
    '課名、教師、課號、學分、時間與資格狀態',
    '完整詳細資料', '實體／同步／非同步', '最低學分',
    '手動新增課程', '匯出手機桌布',
  ]) assert.match(stepBlock, new RegExp(copy));
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm run build && node --test --test-name-pattern="aligns the first-use message" tests/rendered-html.test.mjs
```

Expected: FAIL because the welcome lacks the four-stage model and current steps omit attendance and wallpaper guidance.

- [ ] **Step 3: Update welcome and `quickTourSteps`**

Use this welcome copy:

```html
<p>第一次排課可以照四步完成：搜尋或匯入課程、加入候選清單、檢查時間與修課條件、加入課表並處理衝堂。一般排課不需要 API Key；只有 AI 截圖辨識與推薦需要你自己的 Gemini API Key。</p>
```

Keep exactly eight objects and existing target/tab/compact-view contracts. The final object is:

```js
{
  target: 'schedule-grid',
  compactView: 'schedule',
  title: '最後檢查與匯出',
  body: '確認學分、資格、實體／同步／非同步、衝堂與排課提醒，再按「匯出手機桌布」保存課表。',
}
```

- [ ] **Step 4: Run and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Run existing tour safety tests**

```bash
npm run build && node --test --test-name-pattern="quick tour|spotlight" tests/rendered-html.test.mjs
```

Expected: all matching tests PASS; no step mutates `selected` or `courseStore`.

- [ ] **Step 6: Commit**

```bash
git add tests/rendered-html.test.mjs src/index.html src/app.mjs
git commit -m "docs: align onboarding with current workflow"
```

### Task 3: Add readable task cards and preserve mobile usability

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `.tutorial-center-body` and nine tutorial sections.
- Produces: `.guide-steps`, `.guide-note`, and responsive tutorial styles.

- [ ] **Step 1: Write one failing presentation test**

```js
test('presents tutorial tasks as readable cards on desktop and one column on mobile', async () => {
  const html = await (await render()).text();

  assert.match(html, /class="guide-steps"/);
  assert.match(html, /class="guide-note"/);
  assert.match(html, /\.guide-steps\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.guide-steps\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(html, /\.tutorial-center-nav a\s*\{[^}]*min-height:\s*44px/s);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm run build && node --test --test-name-pattern="tutorial tasks as readable cards" tests/rendered-html.test.mjs
```

Expected: FAIL because classes and grid styles do not exist.

- [ ] **Step 3: Add minimal semantic classes and styles**

Wrap step groups in `<div class="guide-steps">` and use `<p class="guide-note"><strong>注意：</strong>…</p>` for safety, destructive actions, and storage boundaries.

```css
.guide-steps { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.guide-steps > * { margin: 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }
.guide-note { padding: 10px 12px; border-left: 3px solid var(--orange); background: var(--orange-soft); color: var(--ink); }
.tutorial-center-nav a { min-height: 44px; display: inline-flex; align-items: center; }
```

Under `@media (max-width: 640px)`:

```css
.guide-steps { grid-template-columns: 1fr; }
```

- [ ] **Step 4: Run and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Run compact tutorial tests**

```bash
npm run build && node --test --test-name-pattern="tutorial UI usable on compact screens|tutorial tasks as readable cards" tests/rendered-html.test.mjs
```

Expected: both matching tests PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/rendered-html.test.mjs src/index.html src/styles.css
git commit -m "style: improve tutorial task readability"
```

### Task 4: Verify, test Chrome, and publish both public sites

**Files:**
- Verify: all source and test files
- Publish: existing GitHub Pages and Sites project from `.openai/hosting.json`

**Interfaces:**
- Consumes: exact committed branch head and existing deployment configuration.
- Produces: verified public GitHub Pages and full Sites deployments.

- [ ] **Step 1: Run complete automated verification**

```bash
npm run verify
```

Expected: all unit, rendered HTML, build, syntax, and live NCCU contract tests PASS.

- [ ] **Step 2: Check repository**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and a clean worktree.

- [ ] **Step 3: Test desktop Chrome**

Start `npm run dev`, open the printed URL using Playwright CLI with `--browser=chrome`, and verify: four-stage first-use copy; steps 1–8 each have spotlight/title; nine chapters open and navigate; body scrolls independently; console has zero errors.

- [ ] **Step 4: Test 390×844 Chrome**

Evaluate:

```js
({
  overflow: document.documentElement.scrollWidth - innerWidth,
  links: [...document.querySelectorAll('.tutorial-center-nav a')].map((el) => el.getBoundingClientRect().height),
  columns: getComputedStyle(document.querySelector('.guide-steps')).gridTemplateColumns,
})
```

Expected: `overflow === 0`, every link is at least 44px, and `columns` has one track.

- [ ] **Step 5: Publish exact verified head**

Push the branch head to `main`, package the unchanged source, save one Sites version, deploy to the already-approved public project, and poll until `succeeded`.

- [ ] **Step 6: Verify both public URLs**

Confirm HTTP 200 and deployed HTML contains `guide-details`, `guide-attendance`, `guide-export-faq`, and updated tour copy:

- `https://hunter20041004.github.io/nccu-course-scheduler/`
- `https://nccu-internship-scheduler.abuzz-teal-2691.chatgpt.site/`

Expected: both serve the exact updated tutorial.

