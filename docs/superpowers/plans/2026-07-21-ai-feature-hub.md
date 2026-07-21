# AI Feature Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single AI recommendation tab with an AI feature hub that routes students to either course-plan recommendations or syllabus comparison without losing existing state.

**Architecture:** Keep the existing `#workspace-panel-ai` tab and both AI implementations, but wrap them in three mutually exclusive views controlled by an in-memory `activeAiTool`. Candidate comparison entry points set the AI tab and comparison view directly; profile help sets the advisor view directly. No Worker or AI-service contract changes are required.

**Tech Stack:** Semantic HTML, vanilla JavaScript ES modules, CSS, Node.js built-in test runner, existing render/build pipeline.

## Global Constraints

- The workspace tab label is exactly `AI 功能`.
- The hub offers exactly `AI 排課推薦` and `AI 課綱比較`.
- The active AI sub-view is remembered only in memory and resets to the hub after reload.
- Existing form inputs, recommendation results, comparison results, API Key handling, and ChatGPT fallback remain intact.
- Desktop cards use two columns; screens at or below 640px use one column with 44px minimum targets.
- Work in the existing isolated worktree and do not merge into `main`.
- Follow one vertical Red → Green → Refactor cycle at a time.

---

### Task 1: AI hub structure and copy

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`

**Interfaces:**
- Produces: `#ai-feature-hub`, `[data-ai-tool="advisor"]`, `[data-ai-tool="comparison"]`, `#ai-tool-advisor`, `#ai-tool-comparison`, and `[data-ai-tool-back]`.

- [ ] **Step 1: Write one failing rendered-page test**

```js
test('presents AI tools through a dedicated feature hub', async () => {
  const html = await (await render()).text();
  assert.match(html, /data-workspace-tab="ai">AI 功能</);
  assert.match(html, /id="ai-feature-hub"/);
  assert.match(html, /data-ai-tool="advisor"[\s\S]*AI 排課推薦/);
  assert.match(html, /data-ai-tool="comparison"[\s\S]*AI 課綱比較/);
  assert.match(html, /id="ai-tool-advisor"[^>]*hidden/);
  assert.match(html, /id="ai-tool-comparison"[^>]*hidden/);
});
```

- [ ] **Step 2: Run the single test and verify Red**

Run: `npm run build && node --test --test-name-pattern="dedicated feature hub" tests/rendered-html.test.mjs`

Expected: FAIL because the tab still says `AI 推薦` and the hub elements do not exist.

- [ ] **Step 3: Add the minimal semantic HTML**

Wrap the existing advisor form and plan results in `#ai-tool-advisor`, wrap comparison output in `#ai-tool-comparison`, and add:

```html
<section id="ai-feature-hub" class="ai-feature-hub" aria-labelledby="ai-feature-hub-title">
  <header><p class="eyebrow">AI · CHOOSE A TASK</p><h2 id="ai-feature-hub-title">想用 AI 做什麼？</h2></header>
  <div class="ai-feature-grid">
    <button type="button" class="ai-feature-card" data-ai-tool="advisor">…AI 排課推薦…</button>
    <button type="button" class="ai-feature-card" data-ai-tool="comparison">…AI 課綱比較…</button>
  </div>
</section>
```

Each tool view starts hidden and contains a `<button type="button" data-ai-tool-back>返回 AI 功能</button>`.

- [ ] **Step 4: Run the single test and verify Green**

Run: `npm run build && node --test --test-name-pattern="dedicated feature hub" tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 5: Refactor markup only if headings or wrappers are duplicated, then rerun Green**

Run the same command. Expected: PASS.

### Task 2: In-memory AI view navigation

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/app.mjs`

**Interfaces:**
- Produces: `let activeAiTool = 'hub'` and `setAiTool(name, { focus = false } = {})`.
- Consumes: IDs created in Task 1.

- [ ] **Step 1: Write one failing navigation test**

```js
test('switches AI tools in memory without clearing their state', async () => {
  const html = await (await render()).text();
  assert.match(html, /let activeAiTool = 'hub'/);
  assert.match(html, /function setAiTool\(name, \{ focus = false \} = \{\}\)/);
  assert.match(html, /hub\.hidden = name !== 'hub'/);
  assert.match(html, /advisor\.hidden = name !== 'advisor'/);
  assert.match(html, /comparison\.hidden = name !== 'comparison'/);
  assert.match(html, /setAiTool\('hub'/);
  assert.doesNotMatch(html, /localStorage\.setItem\([^)]*activeAiTool/);
});
```

- [ ] **Step 2: Run the single test and verify Red**

Run: `npm run build && node --test --test-name-pattern="switches AI tools in memory" tests/rendered-html.test.mjs`

Expected: FAIL because the AI tool state and controller do not exist.

- [ ] **Step 3: Implement the minimal controller and delegated clicks**

```js
let activeAiTool = 'hub';

function setAiTool(name, { focus = false } = {}) {
  if (!['hub', 'advisor', 'comparison'].includes(name)) return;
  activeAiTool = name;
  const hub = byId('ai-feature-hub');
  const advisor = byId('ai-tool-advisor');
  const comparison = byId('ai-tool-comparison');
  hub.hidden = name !== 'hub';
  advisor.hidden = name !== 'advisor';
  comparison.hidden = name !== 'comparison';
  if (focus) (name === 'hub' ? byId('ai-feature-hub-title') : name === 'advisor' ? byId('ai-advisor-title') : byId('ai-comparison-title')).focus();
}
```

Add click handlers for `[data-ai-tool]` and `[data-ai-tool-back]`. `setWorkspaceTab('ai')` must leave `activeAiTool` unchanged.

- [ ] **Step 4: Run the single test and verify Green**

Run: `npm run build && node --test --test-name-pattern="switches AI tools in memory" tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 5: Refactor focus selection into one local variable and rerun Green**

Run the same command. Expected: PASS.

### Task 3: Direct entry from candidate comparison and profile help

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/app.mjs`

**Interfaces:**
- Consumes: `setAiTool('advisor')` and `setAiTool('comparison')` from Task 2.

- [ ] **Step 1: Write one failing direct-entry test**

```js
test('routes candidate comparison actions to the matching AI tool', async () => {
  const html = await (await render()).text();
  assert.match(html, /open-comparison-profile[\s\S]*setAiTool\('advisor'\)/);
  assert.match(html, /run-ai-comparison[\s\S]*setAiTool\('comparison'\)/);
  assert.match(html, /open-chatgpt-comparison[\s\S]*setAiTool\('comparison'\)/);
  assert.match(html, /比較完成，結果已顯示在「AI 功能」/);
});
```

- [ ] **Step 2: Run the single test and verify Red**

Run: `npm run build && node --test --test-name-pattern="routes candidate comparison actions" tests/rendered-html.test.mjs`

Expected: FAIL because direct entry only switches the workspace tab.

- [ ] **Step 3: Add the minimal routing calls**

Call `setAiTool('advisor')` before focusing `#ai-future`. Call `setAiTool('comparison')` before scrolling comparison results or ChatGPT recovery into view. Update the completion message to `比較完成，結果已顯示在「AI 功能」。`.

- [ ] **Step 4: Run the single test and verify Green**

Run: `npm run build && node --test --test-name-pattern="routes candidate comparison actions" tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 5: Rerun the existing comparison test group**

Run: `npm run build && node --test --test-name-pattern="comparison|ChatGPT" tests/rendered-html.test.mjs`

Expected: all matching tests PASS.

### Task 4: Visual polish, responsive layout, and teaching copy

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/styles.css`
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `tests/browser/sunbreak-critical-flows.md`

**Interfaces:**
- Consumes: Task 1 hub classes and Task 2 navigation.

- [ ] **Step 1: Write one failing responsive-and-tutorial test**

```js
test('styles and teaches the AI feature hub on desktop and phones', async () => {
  const html = await (await render()).text();
  assert.match(html, /\.ai-feature-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(html, /\.ai-feature-card\s*\{[^}]*min-height:\s*44px/s);
  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.ai-feature-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(html, /title: 'AI 功能'/);
  assert.match(html, /選擇「AI 排課推薦」或「AI 課綱比較」/);
  assert.match(html, /href="#guide-ai">AI 功能</);
});
```

- [ ] **Step 2: Run the single test and verify Red**

Run: `npm run build && node --test --test-name-pattern="styles and teaches the AI feature hub" tests/rendered-html.test.mjs`

Expected: FAIL because the hub styles and new teaching copy do not exist.

- [ ] **Step 3: Implement the minimal visual system and copy**

Add a two-column `.ai-feature-grid`, semantic `.ai-feature-card` styles using existing blue/violet/sun tokens, visible `:focus-visible`, stable hover/pressed states, and a one-column 640px rule. Update quick-tour title/body, tutorial navigation, tutorial heading, and AI instructions to explain the feature chooser and both tools.

- [ ] **Step 4: Run the single test and verify Green**

Run: `npm run build && node --test --test-name-pattern="styles and teaches the AI feature hub" tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 5: Refactor CSS to reuse existing spacing, radius, and color tokens, then rerun Green**

Run the same command. Expected: PASS.

- [ ] **Step 6: Run the full verification suite**

Run: `npm test && npm run lint && npm run test:contract:nccu && git diff --check`

Expected: 0 failures, 0 syntax errors, all live NCCU contract checks pass, and no whitespace errors.

- [ ] **Step 7: Perform browser QA and update the log**

Verify desktop and compact flows: hub initial state, both cards, back without lost form values, tab switching preserves the active tool, candidate AI comparison direct entry, ChatGPT direct entry, and no console errors. Record the pass in `tests/browser/sunbreak-critical-flows.md`.

- [ ] **Step 8: Commit the feature**

```bash
git add src/index.html src/app.mjs src/styles.css tests/rendered-html.test.mjs tests/browser/sunbreak-critical-flows.md docs/superpowers/plans/2026-07-21-ai-feature-hub.md
git commit -m "feat: add AI feature hub"
```
