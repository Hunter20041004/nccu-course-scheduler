# First-Use Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a skippable first-use quick tour and a permanent detailed tutorial center for public friend testing.

**Architecture:** Keep the existing static single-page app and Cloudflare Worker build. Add tutorial markup in `src/index.html`, state and tour controller logic in `src/app.mjs`, and overlay/panel styling in `src/styles.css`; use rendered HTML tests to protect structure, copy, storage behavior, AI key gating, and responsive layout.

**Tech Stack:** Native JavaScript ESM, semantic HTML, CSS, Node.js 22 built-in test runner, existing `npm run build` and rendered HTML tests.

## Global Constraints

- TDD is mandatory: one Red -> Green -> Refactor vertical slice at a time.
- No third-party tour library; implement native overlay and panel.
- The tour may switch tabs, scroll, and focus elements, but must not modify courses, schedule, eligibility, or internship data.
- The permanent homepage/header control must be named `使用教學`.
- First-use quick tour may be skipped; after skip or completion it must not auto-open again in the same browser.
- Gemini API Key must not be embedded in the frontend and must not be stored in `localStorage`; AI actions request the key only when needed.
- Existing schedule, catalog, conditions, internship settings, import, and AI recommendation behavior must remain intact.
- Deploy by updating the existing public Sites project after tests and build pass.

## File Map

- Modify `tests/rendered-html.test.mjs`: Add one failing test per vertical slice.
- Modify `src/index.html`: Add header tutorial button, welcome dialog, tutorial center dialog, and tour overlay shell.
- Modify `src/app.mjs`: Replace first-load API dialog with tutorial welcome state, add tutorial panel controller, add tour controller, and keep AI-only key gate.
- Modify `src/styles.css`: Add tutorial center, welcome dialog, tour overlay, spotlight, and responsive bottom-sheet styles.
- No new runtime dependency.

---

### Task 1: First-use welcome opens instead of API Key setup

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `const FIRST_USE_TUTORIAL_SEEN_KEY = 'sunbreak:first-use-tutorial-seen:v1';`
- Produces: `openFirstUseWelcome()`, `closeFirstUseWelcome({ remember = true } = {})`.
- Consumes: existing `openApiKeyDialog()` and `requireApiKeyForAi(status)`.

- [ ] **Step 1: Write the failing test**

Add to `tests/rendered-html.test.mjs`:

```js
test('shows a first-use tutorial welcome instead of auto-opening API setup', async () => {
  const html = await (await render()).text();

  assert.match(html, /id="first-use-dialog"[^>]*aria-labelledby="first-use-title"/);
  assert.match(html, /id="start-quick-tour"/);
  assert.match(html, /id="skip-quick-tour"/);
  assert.match(html, /id="open-tutorial-from-welcome"/);
  assert.match(html, /FIRST_USE_TUTORIAL_SEEN_KEY/);
  assert.match(html, /openFirstUseWelcome\(\)/);
  assert.doesNotMatch(html, /if \(localStorage\.getItem\(API_ONBOARDING_SEEN_KEY\) !== 'true'\) openApiKeyDialog\(\)/);
  assert.doesNotMatch(html, /catch \{ openApiKeyDialog\(\); \}/);
});
```

- [ ] **Step 2: Run Red**

Run:

```bash
npm run build && node --test --test-name-pattern="first-use tutorial welcome" tests/rendered-html.test.mjs
```

Expected: FAIL because `first-use-dialog`, `FIRST_USE_TUTORIAL_SEEN_KEY`, and `openFirstUseWelcome()` do not exist.

- [ ] **Step 3: Implement minimal HTML and JS**

In `src/index.html`, add a dialog before `api-key-dialog`:

```html
  <dialog id="first-use-dialog" class="first-use-dialog" aria-labelledby="first-use-title">
    <section class="first-use-card">
      <p class="eyebrow">FIRST RUN · GUIDE</p>
      <h2 id="first-use-title">第一次使用 Sunbreak</h2>
      <p>先用 1 到 2 分鐘看快速導覽，或直接開始排課；AI 功能需要你自己的 Gemini API Key。</p>
      <div class="first-use-actions">
        <button id="start-quick-tour" class="button button-primary" type="button">開始快速導覽</button>
        <button id="skip-quick-tour" class="button button-quiet" type="button">直接開始使用</button>
        <button id="open-tutorial-from-welcome" class="button button-secondary" type="button">打開完整教學</button>
      </div>
    </section>
  </dialog>
```

In `src/app.mjs`, replace the auto API dialog block:

```js
const FIRST_USE_TUTORIAL_SEEN_KEY = 'sunbreak:first-use-tutorial-seen:v1';
const API_ONBOARDING_SEEN_KEY = 'sunbreak:api-onboarding-seen:v1';
```

```js
function openFirstUseWelcome() {
  const dialog = byId('first-use-dialog');
  if (!dialog.open) dialog.showModal();
  byId('start-quick-tour').focus();
}

function closeFirstUseWelcome({ remember = true } = {}) {
  if (remember) {
    try { localStorage.setItem(FIRST_USE_TUTORIAL_SEEN_KEY, 'true'); } catch {}
  }
  const dialog = byId('first-use-dialog');
  if (dialog.open) dialog.close();
}

try {
  if (localStorage.getItem(FIRST_USE_TUTORIAL_SEEN_KEY) !== 'true') openFirstUseWelcome();
} catch {
  openFirstUseWelcome();
}
```

Keep `openApiKeyDialog()` only on `api-key-status-button` and `requireApiKeyForAi(status)`.

In `src/styles.css`, add minimal dialog styles:

```css
.first-use-dialog { width: min(560px, calc(100% - 24px)); border: 0; border-radius: 14px; padding: 0; background: transparent; }
.first-use-dialog::backdrop { background: rgba(33,31,38,.42); }
.first-use-card { display: grid; gap: 14px; border: 1px solid var(--line-strong); border-radius: 14px; background: var(--surface); padding: 24px; box-shadow: 0 22px 70px rgba(33,31,38,.22); }
.first-use-card h2 { margin: 0; font: 700 1.55rem/1.1 Georgia, "Noto Serif TC", serif; }
.first-use-card p { margin: 0; color: var(--muted); line-height: 1.55; }
.first-use-actions { display: flex; flex-wrap: wrap; gap: 8px; }
```

- [ ] **Step 4: Run Green**

Run:

```bash
npm run build && node --test --test-name-pattern="first-use tutorial welcome" tests/rendered-html.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Refactor and commit**

Run:

```bash
npm run build && node --test tests/rendered-html.test.mjs
git add tests/rendered-html.test.mjs src/index.html src/app.mjs src/styles.css
git commit -m "feat: add first-use tutorial welcome"
```

---

### Task 2: Permanent tutorial center opens from header and welcome

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `openTutorialCenter()`, `closeTutorialCenter()`.
- Produces: buttons `#open-tutorial-center`, `#tutorial-center-close`, `#restart-quick-tour`.
- Consumes: existing `.header-actions`.

- [ ] **Step 1: Write the failing test**

```js
test('keeps a permanent tutorial center with detailed first-run help', async () => {
  const html = await (await render()).text();

  assert.match(html, /id="open-tutorial-center"[^>]*>使用教學<\/button>/);
  assert.match(html, /id="tutorial-center"[^>]*aria-labelledby="tutorial-center-title"/);
  assert.match(html, /id="tutorial-center-close"/);
  assert.match(html, /id="restart-quick-tour"/);
  for (const label of ['第一次使用', '取得 Gemini API Key', '匯入候選課程', '管理選課條件', '排課操作', '實習與個人行程', 'AI 推薦方案', '常見問題']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /API Key 等同使用者自己的額度，請不要傳給別人/);
  assert.match(html, /function openTutorialCenter\(\)/);
  assert.match(html, /byId\('open-tutorial-center'\)\.addEventListener\('click', openTutorialCenter\)/);
});
```

- [ ] **Step 2: Run Red**

Run:

```bash
npm run build && node --test --test-name-pattern="permanent tutorial center" tests/rendered-html.test.mjs
```

Expected: FAIL because the tutorial center does not exist.

- [ ] **Step 3: Implement minimal tutorial center**

In `src/index.html`, add the header button inside `.header-actions`:

```html
      <button id="open-tutorial-center" class="button button-quiet" type="button">使用教學</button>
```

Add the center dialog before `api-key-dialog`:

```html
  <dialog id="tutorial-center" class="tutorial-center" aria-labelledby="tutorial-center-title">
    <section class="tutorial-center-panel">
      <header class="tutorial-center-header">
        <p class="eyebrow">GUIDE · FRIEND TEST</p>
        <h2 id="tutorial-center-title">使用教學</h2>
        <button id="tutorial-center-close" class="dialog-close" type="button" aria-label="關閉使用教學">×</button>
      </header>
      <nav class="tutorial-center-nav" aria-label="教學章節">
        <a href="#guide-first-run">第一次使用</a>
        <a href="#guide-api-key">取得 Gemini API Key</a>
        <a href="#guide-import">匯入候選課程</a>
        <a href="#guide-conditions">管理選課條件</a>
        <a href="#guide-schedule">排課操作</a>
        <a href="#guide-internship">實習與個人行程</a>
        <a href="#guide-ai">AI 推薦方案</a>
        <a href="#guide-faq">常見問題</a>
      </nav>
      <div class="tutorial-center-body">
        <section id="guide-first-run"><h3>第一次使用</h3><p>你可以先手動排課，不設定 API Key 也能使用候選課程、課表、條件與實習設定。</p><button id="restart-quick-tour" class="button button-secondary" type="button">重新開始快速導覽</button></section>
        <section id="guide-api-key"><h3>取得 Gemini API Key</h3><ol><li>前往 Google AI Studio。</li><li>登入 Google 帳號。</li><li>建立 API Key。</li><li>複製 Key 後回到網站貼上。</li></ol><p>API Key 等同使用者自己的額度，請不要傳給別人。Key 不會存到伺服器、資料庫或網址。</p></section>
        <section id="guide-import"><h3>匯入候選課程</h3><p>可以用政大課程追蹤清單截圖辨識匯入，也可以手動新增。沒有開的課不會匯入；待確認課程需要自己檢查。</p></section>
        <section id="guide-conditions"><h3>管理選課條件</h3><p>有系所、雙主修、學程、年級或身分限制的課會出現在選課條件。條件不符合時請看詳細。</p></section>
        <section id="guide-schedule"><h3>排課操作</h3><p>點候選課程可加入課表；詳細、鎖定、刪除可管理每門課。鎖定課會在 AI 方案中保留。</p></section>
        <section id="guide-internship"><h3>實習與個人行程</h3><p>可設定實習天數、固定時段、彈性時段，也可新增社團、課外組織、打工或自修來檢查衝堂。</p></section>
        <section id="guide-ai"><h3>AI 推薦方案</h3><p>寫清楚最低學分、想留幾天實習、主題偏好、語文課偏好和不想考試等條件。有衝堂的方案不應顯示；非同步課可以補學分但仍需符合資格。</p></section>
        <section id="guide-faq"><h3>常見問題</h3><p>如果 AI 說 API Key 沒設定，代表目前分頁還沒貼 Key。若截圖匯入後有待確認，請自行核對政大課程資料。</p></section>
      </div>
    </section>
  </dialog>
```

In `src/app.mjs`:

```js
function openTutorialCenter() {
  const dialog = byId('tutorial-center');
  if (!dialog.open) dialog.showModal();
  byId('tutorial-center-close').focus();
}

function closeTutorialCenter() {
  const dialog = byId('tutorial-center');
  if (dialog.open) dialog.close();
}

byId('open-tutorial-center').addEventListener('click', openTutorialCenter);
byId('open-tutorial-from-welcome').addEventListener('click', () => {
  closeFirstUseWelcome();
  openTutorialCenter();
});
byId('tutorial-center-close').addEventListener('click', closeTutorialCenter);
```

In `src/styles.css`, add:

```css
.tutorial-center { width: min(920px, calc(100% - 20px)); max-height: min(860px, calc(100dvh - 20px)); border: 0; padding: 0; background: transparent; }
.tutorial-center::backdrop { background: rgba(33,31,38,.36); }
.tutorial-center-panel { position: relative; display: grid; grid-template-rows: auto auto minmax(0, 1fr); max-height: calc(100dvh - 20px); border: 1px solid var(--line-strong); border-radius: 14px; background: var(--surface); overflow: hidden; }
.tutorial-center-header { position: relative; padding: 18px 56px 14px 18px; border-bottom: 1px solid var(--line); }
.tutorial-center-header h2 { margin: 0; font: 700 1.55rem/1.1 Georgia, "Noto Serif TC", serif; }
.tutorial-center-nav { display: flex; gap: 6px; overflow-x: auto; padding: 8px; border-bottom: 1px solid var(--line); }
.tutorial-center-nav a { flex: 0 0 auto; border: 1px solid var(--line); border-radius: 6px; color: var(--ink); padding: 8px 10px; font-size: .74rem; font-weight: 800; text-decoration: none; }
.tutorial-center-body { display: grid; gap: 14px; overflow: auto; padding: 16px 18px 22px; }
.tutorial-center-body section { display: grid; gap: 8px; padding-bottom: 14px; border-bottom: 1px solid var(--line); }
.tutorial-center-body h3, .tutorial-center-body p, .tutorial-center-body ol { margin: 0; }
.tutorial-center-body p, .tutorial-center-body li { color: var(--muted); line-height: 1.55; }
```

- [ ] **Step 4: Run Green**

Run:

```bash
npm run build && node --test --test-name-pattern="permanent tutorial center" tests/rendered-html.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Refactor and commit**

Run:

```bash
npm run build && node --test tests/rendered-html.test.mjs
git add tests/rendered-html.test.mjs src/index.html src/app.mjs src/styles.css
git commit -m "feat: add tutorial center"
```

---

### Task 3: Skip, complete, and restart quick tour state

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/app.mjs`

**Interfaces:**
- Produces: `markFirstUseTutorialSeen()`.
- Produces: `startQuickTour()`, `endQuickTour({ completed = false } = {})`.
- Consumes: buttons `#start-quick-tour`, `#skip-quick-tour`, `#restart-quick-tour`.

- [ ] **Step 1: Write the failing test**

```js
test('marks quick tour skipped or completed without changing planner data', async () => {
  const html = await (await render()).text();

  assert.match(html, /function markFirstUseTutorialSeen\(\)/);
  assert.match(html, /localStorage\.setItem\(FIRST_USE_TUTORIAL_SEEN_KEY, 'true'\)/);
  assert.match(html, /byId\('skip-quick-tour'\)\.addEventListener\('click'/);
  assert.match(html, /byId\('start-quick-tour'\)\.addEventListener\('click', startQuickTour\)/);
  assert.match(html, /byId\('restart-quick-tour'\)\.addEventListener\('click', startQuickTour\)/);
  assert.match(html, /function endQuickTour\(\{ completed = false \} = \{\}\)/);
  assert.doesNotMatch(html, /startQuickTour[\s\S]{0,1200}selected =/);
  assert.doesNotMatch(html, /startQuickTour[\s\S]{0,1200}courseStore =/);
});
```

- [ ] **Step 2: Run Red**

Run:

```bash
npm run build && node --test --test-name-pattern="marks quick tour" tests/rendered-html.test.mjs
```

Expected: FAIL because the tour lifecycle functions are missing.

- [ ] **Step 3: Implement state handlers**

In `src/app.mjs`:

```js
function markFirstUseTutorialSeen() {
  try { localStorage.setItem(FIRST_USE_TUTORIAL_SEEN_KEY, 'true'); } catch {}
}

function startQuickTour() {
  closeFirstUseWelcome();
  closeTutorialCenter();
  markFirstUseTutorialSeen();
}

function endQuickTour({ completed = false } = {}) {
  if (completed) markFirstUseTutorialSeen();
}

byId('skip-quick-tour').addEventListener('click', () => closeFirstUseWelcome());
byId('start-quick-tour').addEventListener('click', startQuickTour);
byId('restart-quick-tour').addEventListener('click', startQuickTour);
```

Refactor `closeFirstUseWelcome()` to call `markFirstUseTutorialSeen()` when `remember` is true.

- [ ] **Step 4: Run Green**

Run:

```bash
npm run build && node --test --test-name-pattern="marks quick tour" tests/rendered-html.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Refactor and commit**

Run:

```bash
npm run build && node --test tests/rendered-html.test.mjs
git add tests/rendered-html.test.mjs src/app.mjs
git commit -m "feat: persist quick tour state"
```

---

### Task 4: Native tour overlay and eight route steps

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `const quickTourSteps = [...]`.
- Produces: `renderQuickTourStep()`, `goQuickTourStep(offset)`.
- Produces: overlay elements `#quick-tour-overlay`, `#quick-tour-card`, `#quick-tour-title`, `#quick-tour-body`.
- Consumes: existing `setWorkspaceTab(name)` and `setCompactView(name)`.

- [ ] **Step 1: Write the failing test**

```js
test('defines a native eight-step quick tour that can switch tabs without mutating data', async () => {
  const html = await (await render()).text();

  assert.match(html, /id="quick-tour-overlay"/);
  assert.match(html, /id="quick-tour-prev"/);
  assert.match(html, /id="quick-tour-next"/);
  assert.match(html, /id="quick-tour-end"/);
  assert.match(html, /const quickTourSteps = \[/);
  for (const target of ['schedule-panel', 'workspace-panel-catalog', 'course-actions', 'workspace-panel-conditions', 'workspace-panel-internship', 'workspace-panel-ai', 'workspace-panel-add', 'schedule-grid']) {
    assert.match(html, new RegExp(`target: '${target}'`));
  }
  assert.match(html, /setWorkspaceTab\(step\.tab\)/);
  assert.match(html, /setCompactView\(step\.compactView\)/);
  assert.match(html, /targetElement\.scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/);
  assert.doesNotMatch(html, /renderQuickTourStep[\s\S]{0,1600}persistState\(\)/);
});
```

- [ ] **Step 2: Run Red**

Run:

```bash
npm run build && node --test --test-name-pattern="native eight-step quick tour" tests/rendered-html.test.mjs
```

Expected: FAIL because overlay and steps do not exist.

- [ ] **Step 3: Implement overlay shell and controller**

In `src/index.html`, add before the script:

```html
  <div id="quick-tour-overlay" class="quick-tour-overlay" hidden>
    <div id="quick-tour-spotlight" class="quick-tour-spotlight" aria-hidden="true"></div>
    <section id="quick-tour-card" class="quick-tour-card" role="dialog" aria-labelledby="quick-tour-title" aria-modal="false">
      <p id="quick-tour-count" class="eyebrow"></p>
      <h2 id="quick-tour-title"></h2>
      <p id="quick-tour-body"></p>
      <div class="quick-tour-actions">
        <button id="quick-tour-prev" class="button button-quiet" type="button">上一步</button>
        <button id="quick-tour-next" class="button button-primary" type="button">下一步</button>
        <button id="quick-tour-end" class="button button-quiet" type="button">結束導覽</button>
      </div>
    </section>
  </div>
```

In `src/app.mjs`, add:

```js
const quickTourSteps = [
  { target: 'schedule-panel', compactView: 'schedule', title: '課表', body: '左側是政大官方節次課表，會顯示週一到週日、實習保留與衝堂。' },
  { target: 'workspace-panel-catalog', tab: 'catalog', compactView: 'tools', title: '候選課程', body: '點候選課程可加入左側課表，列表可搜尋、篩選與檢查資格。' },
  { target: 'course-actions', tab: 'catalog', compactView: 'tools', title: '詳細、鎖定、刪除', body: '每門課都可以看詳細、鎖定或刪除；鎖定不限於必修課。' },
  { target: 'workspace-panel-conditions', tab: 'conditions', compactView: 'tools', title: '選課條件', body: '有條件的課會在這裡生成可勾選條件，並說明為什麼需要。' },
  { target: 'workspace-panel-internship', tab: 'internship', compactView: 'tools', title: '實習設定', body: '可以設定目標天數、固定時段或自動找可用時段。' },
  { target: 'workspace-panel-ai', tab: 'ai', compactView: 'tools', title: 'AI 推薦', body: '輸入背景、目標與偏好後產生三個方案；只有按 AI 功能時才需要 API Key。' },
  { target: 'workspace-panel-add', tab: 'add', compactView: 'tools', title: '匯入與新增', body: '可以上傳課程備選清單截圖、手動新增課程，或加入社團與個人行程。' },
  { target: 'schedule-grid', compactView: 'schedule', title: '最後檢查', body: '套用方案前確認學分、衝堂、非同步課與條件是否符合。' },
];

let quickTourIndex = 0;

function renderQuickTourStep() {
  const step = quickTourSteps[quickTourIndex];
  if (step.tab) setWorkspaceTab(step.tab);
  if (step.compactView) setCompactView(step.compactView);
  const overlay = byId('quick-tour-overlay');
  const targetElement = document.getElementById(step.target) || document.querySelector(`.${step.target}`);
  byId('quick-tour-count').textContent = `步驟 ${quickTourIndex + 1} / ${quickTourSteps.length}`;
  byId('quick-tour-title').textContent = step.title;
  byId('quick-tour-body').textContent = step.body;
  byId('quick-tour-prev').disabled = quickTourIndex === 0;
  byId('quick-tour-next').textContent = quickTourIndex === quickTourSteps.length - 1 ? '完成導覽' : '下一步';
  overlay.hidden = false;
  if (targetElement) {
    targetElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    targetElement.classList.add('is-tour-target');
  }
}

function clearQuickTourTarget() {
  document.querySelectorAll('.is-tour-target').forEach((item) => item.classList.remove('is-tour-target'));
}

function goQuickTourStep(offset) {
  clearQuickTourTarget();
  quickTourIndex += offset;
  if (quickTourIndex >= quickTourSteps.length) {
    endQuickTour({ completed: true });
    return;
  }
  quickTourIndex = Math.max(0, quickTourIndex);
  renderQuickTourStep();
}
```

Update `startQuickTour()`:

```js
function startQuickTour() {
  closeFirstUseWelcome();
  closeTutorialCenter();
  markFirstUseTutorialSeen();
  clearQuickTourTarget();
  quickTourIndex = 0;
  renderQuickTourStep();
}
```

Update `endQuickTour()`:

```js
function endQuickTour({ completed = false } = {}) {
  if (completed) markFirstUseTutorialSeen();
  clearQuickTourTarget();
  byId('quick-tour-overlay').hidden = true;
}
```

Wire controls:

```js
byId('quick-tour-prev').addEventListener('click', () => goQuickTourStep(-1));
byId('quick-tour-next').addEventListener('click', () => goQuickTourStep(1));
byId('quick-tour-end').addEventListener('click', () => endQuickTour());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !byId('quick-tour-overlay').hidden) endQuickTour();
});
```

In `src/styles.css`, add:

```css
.quick-tour-overlay { position: fixed; inset: 0; z-index: 30; pointer-events: none; background: rgba(33,31,38,.28); }
.quick-tour-card { position: fixed; right: 24px; bottom: 24px; display: grid; gap: 10px; width: min(380px, calc(100% - 32px)); border: 1px solid var(--line-strong); border-radius: 12px; background: var(--surface); padding: 16px; box-shadow: 0 18px 60px rgba(33,31,38,.22); pointer-events: auto; }
.quick-tour-card h2, .quick-tour-card p { margin: 0; }
.quick-tour-card h2 { font: 700 1.15rem/1.15 Georgia, "Noto Serif TC", serif; }
.quick-tour-card p { color: var(--muted); line-height: 1.5; }
.quick-tour-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
.is-tour-target { position: relative; z-index: 31; outline: 3px solid var(--sun); outline-offset: 3px; }
```

- [ ] **Step 4: Run Green**

Run:

```bash
npm run build && node --test --test-name-pattern="native eight-step quick tour" tests/rendered-html.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Refactor and commit**

Run:

```bash
npm run build && node --test tests/rendered-html.test.mjs
git add tests/rendered-html.test.mjs src/index.html src/app.mjs src/styles.css
git commit -m "feat: add native quick tour"
```

---

### Task 5: AI Key dialog only opens from explicit AI actions or header

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/app.mjs`
- Modify: `src/index.html`

**Interfaces:**
- Consumes: `requireApiKeyForAi(status)`.
- Consumes: `#api-key-status-button`, `#ai-advisor-form`, `#import-screenshot`.

- [ ] **Step 1: Write the failing test**

Replace the existing onboarding rendered HTML test with:

```js
test('renders secure Gemini API key setup without first-load auto prompt', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="api-key-status-button"/);
  assert.match(html, /<dialog id="api-key-dialog"[^>]*aria-labelledby="api-key-title"/);
  assert.match(html, /id="api-key-input"[^>]*type="password"[^>]*autocomplete="off"/);
  assert.match(html, /aistudio\.google\.com\/app\/apikey/);
  assert.match(html, /Google Assistant／Gemini App 不等於 Gemini API/);
  assert.match(html, /createApiKeySession\(\)/);
  assert.match(html, /validateAndStoreApiKey/);
  assert.match(html, /function requireApiKeyForAi\(status\)/);
  assert.match(html, /byId\('api-key-status-button'\)\.addEventListener\('click', openApiKeyDialog\)/);
  assert.match(html, /const apiKey = requireApiKeyForAi\(status\)/);
  assert.doesNotMatch(html, /openApiKeyDialog\(\);[\s\S]{0,240}renderApiKeyState\(\)/);
  assert.doesNotMatch(html, /sessionStorage/);
});
```

- [ ] **Step 2: Run Red**

Run:

```bash
npm run build && node --test --test-name-pattern="secure Gemini API key setup" tests/rendered-html.test.mjs
```

Expected: FAIL until the old auto API prompt regex is removed and the first-load code is gone.

- [ ] **Step 3: Implement the minimal adjustment**

Ensure `src/app.mjs` has no first-load call to `openApiKeyDialog()` and that only these paths open it:

```js
byId('api-key-status-button').addEventListener('click', openApiKeyDialog);

function requireApiKeyForAi(status) {
  const apiKey = apiKeySession.getKey();
  if (apiKey) return apiKey;
  status.textContent = '請先貼上自己的 Gemini API Key，再使用 AI 功能。';
  openApiKeyDialog();
  return null;
}
```

Keep `apiKey` in the AI request bodies for the existing BYOK worker path.

- [ ] **Step 4: Run Green**

Run:

```bash
npm run build && node --test --test-name-pattern="secure Gemini API key setup" tests/rendered-html.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Refactor and commit**

Run:

```bash
npm run build && node --test tests/rendered-html.test.mjs
git add tests/rendered-html.test.mjs src/app.mjs src/index.html
git commit -m "fix: gate api key setup behind ai actions"
```

---

### Task 6: Responsive tutorial layout and non-overlap guard

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: responsive CSS under `@media (max-width: 640px)` for `.quick-tour-card`, `.tutorial-center`, `.first-use-actions`, and `.header-actions`.

- [ ] **Step 1: Write the failing test**

```js
test('keeps tutorial UI usable on compact screens', async () => {
  const html = await (await render()).text();

  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.quick-tour-card\s*\{[\s\S]*right:\s*10px[\s\S]*bottom:\s*10px/s);
  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.quick-tour-actions\s*\{[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.tutorial-center\s*\{[\s\S]*width:\s*calc\(100% - 12px\)/s);
  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.first-use-actions\s*\{[\s\S]*display:\s*grid/s);
  assert.match(html, /max-height:\s*calc\(100dvh - 20px\)/);
});
```

- [ ] **Step 2: Run Red**

Run:

```bash
npm run build && node --test --test-name-pattern="tutorial UI usable on compact screens" tests/rendered-html.test.mjs
```

Expected: FAIL until compact CSS exists.

- [ ] **Step 3: Implement responsive CSS**

In the existing `@media (max-width: 640px)` block, add:

```css
  .first-use-actions { display: grid; }
  .first-use-actions .button { width: 100%; }
  .tutorial-center { width: calc(100% - 12px); max-height: calc(100dvh - 12px); }
  .tutorial-center-panel { max-height: calc(100dvh - 12px); }
  .tutorial-center-nav { padding: 6px; }
  .tutorial-center-body { padding: 12px; }
  .quick-tour-card { right: 10px; bottom: 10px; width: calc(100% - 20px); }
  .quick-tour-actions { grid-template-columns: 1fr; }
```

- [ ] **Step 4: Run Green**

Run:

```bash
npm run build && node --test --test-name-pattern="tutorial UI usable on compact screens" tests/rendered-html.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Refactor and commit**

Run:

```bash
npm run build && node --test tests/rendered-html.test.mjs
git add tests/rendered-html.test.mjs src/styles.css
git commit -m "style: make tutorial responsive"
```

---

### Task 7: Final verification and public deployment

**Files:**
- Read: `.openai/hosting.json`
- Modify only if build output requires it: `dist/`
- Use existing Sites project.

**Interfaces:**
- Consumes: existing Sites project id in `.openai/hosting.json`.
- Produces: deployed public URL for friend testing.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run verify
```

Expected: PASS for unit tests, build, rendered HTML tests, lint, and NCCU live contract.

- [ ] **Step 2: Commit any final verification-only fixes**

If `npm run verify` fails, add one new failing test that captures the bug, implement the smallest fix, rerun the targeted test, then rerun `npm run verify`. Commit the fix with a focused message.

- [ ] **Step 3: Build production artifact**

Run:

```bash
npm run build
```

Expected: build succeeds and updates `dist/server/index.js`.

- [ ] **Step 4: Push exact source commit to Sites source repository**

Read `.openai/hosting.json`, reuse the existing `project_id`, create or reuse the Sites source repository, and push the exact current commit.

- [ ] **Step 5: Save and deploy a new public Sites version**

Package the site source with the Sites packaging script, save a Sites version using the pushed commit SHA, deploy that saved version to the existing public project, and poll deployment status until it succeeds.

- [ ] **Step 6: Report outcome**

Report:

```text
公開試用網址：https://nccu-course-planner-1151.huntertseng.chatgpt.site
驗證：npm run verify 通過
```

Do not claim deployment success until Sites reports a terminal succeeded status.

---

## Self-Review

- Spec coverage: Tasks cover first-use welcome, permanent tutorial center, skip/complete state, native eight-step tour, AI-only API key setup, responsive UI, verification, and existing public deployment.
- Placeholder scan: No deferred implementation placeholders.
- Type consistency: `FIRST_USE_TUTORIAL_SEEN_KEY`, `openTutorialCenter()`, `startQuickTour()`, `endQuickTour()`, `quickTourSteps`, and DOM ids are introduced before later tasks reference them.
