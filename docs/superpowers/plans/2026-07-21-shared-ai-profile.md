# Shared AI Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let AI 排課推薦 and AI 課綱比較 edit and consume one shared, optional student profile without persisting it across reloads.

**Architecture:** Keep exactly one set of four textarea elements and move that DOM section between an advisor mount and a comparison mount when the active AI tool changes. A small pure module computes non-empty field completion so behavior can be tested without a browser; rendered integration tests protect mounting, privacy, requests, and responsive markup.

**Tech Stack:** Vanilla HTML, CSS, JavaScript ES modules, Node.js built-in test runner, existing local build pipeline, Chrome browser QA.

## Global Constraints

- The shared fields are `ai-profile`, `ai-future`, `ai-goals`, and `ai-preferences`; do not add fields.
- Empty and whitespace-only values count as unfilled; every field remains optional.
- Personal data stays in the current page memory only and must not enter `localStorage`, URLs, server storage, or exported planner JSON.
- AI advisor, Gemini comparison, and ChatGPT prompt generation must read the same four elements.
- On comparison, the profile section is collapsed by default; on advisor, it is expanded.
- Keep current Gemini model, API key flow, visual language, and request payload names unchanged.
- Implement each task using Red → Green → Refactor before starting the next task.

---

### Task 1: Profile completion model

**Files:**
- Create: `src/shared-ai-profile.mjs`
- Create: `tests/shared-ai-profile.test.mjs`
- Modify: `package.json`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Consumes: an object containing `profileText`, `futureDirection`, `semesterGoals`, and `preferences` strings.
- Produces: `countCompletedAiProfileFields(profile): number` and `aiProfileCompletionLabel(profile): string`.

- [ ] **Step 1: Write the failing whitespace test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { countCompletedAiProfileFields } from '../src/shared-ai-profile.mjs';

test('counts only non-empty shared AI profile fields', () => {
  assert.equal(countCompletedAiProfileFields({
    profileText: '政大學生',
    futureDirection: '  ',
    semesterGoals: '',
    preferences: '週二週四集中',
  }), 2);
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --test tests/shared-ai-profile.test.mjs`

Expected: FAIL because `src/shared-ai-profile.mjs` does not exist.

- [ ] **Step 3: Implement the minimum counter**

```js
export const AI_PROFILE_KEYS = [
  'profileText',
  'futureDirection',
  'semesterGoals',
  'preferences',
];

export function countCompletedAiProfileFields(profile = {}) {
  return AI_PROFILE_KEYS.filter((key) => String(profile[key] || '').trim()).length;
}
```

- [ ] **Step 4: Run the test and confirm GREEN**

Run: `node --test tests/shared-ai-profile.test.mjs`

Expected: 1 passing test.

- [ ] **Step 5: Write the failing completion-label test**

```js
import { aiProfileCompletionLabel } from '../src/shared-ai-profile.mjs';

test('describes empty and partial shared AI profiles', () => {
  assert.equal(aiProfileCompletionLabel({}), '尚未填寫');
  assert.equal(aiProfileCompletionLabel({ profileText: '會計系', preferences: '少考試' }), '已填 2／4 項');
});
```

- [ ] **Step 6: Run the test and confirm RED**

Run: `node --test tests/shared-ai-profile.test.mjs`

Expected: FAIL because `aiProfileCompletionLabel` is not exported.

- [ ] **Step 7: Implement the minimum label and wire tests/build**

```js
export function aiProfileCompletionLabel(profile = {}) {
  const count = countCompletedAiProfileFields(profile);
  return count ? `已填 ${count}／${AI_PROFILE_KEYS.length} 項` : '尚未填寫';
}
```

Add `tests/shared-ai-profile.test.mjs` to `test:unit`, add `node --check src/shared-ai-profile.mjs` to `lint`, and add `shared-ai-profile.mjs` to the client module list in `scripts/build.mjs`.

- [ ] **Step 8: Run Task 1 checks and refactor with tests green**

Run: `node --test tests/shared-ai-profile.test.mjs && npm run lint`

Expected: both profile tests pass and lint exits 0.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/shared-ai-profile.mjs tests/shared-ai-profile.test.mjs package.json scripts/build.mjs
git commit -m "feat: model shared AI profile completion"
```

---

### Task 2: One movable profile form for both AI tools

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: Task 1 `aiProfileCompletionLabel(profile)`.
- Produces: `readSharedAiProfile(): object`, `updateSharedAiProfileCompletion(): void`, and `mountSharedAiProfile(toolName): void`.

- [ ] **Step 1: Write the failing single-form structure test**

```js
test('renders one shared AI profile with a mount in each tool', async () => {
  const html = await (await render()).text();
  for (const id of ['ai-profile', 'ai-future', 'ai-goals', 'ai-preferences']) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1);
  }
  assert.match(html, /id="ai-advisor-profile-mount"/);
  assert.match(html, /id="ai-comparison-profile-mount"/);
  assert.match(html, /id="shared-ai-profile"/);
  assert.doesNotMatch(html, /id="open-comparison-profile"/);
});
```

- [ ] **Step 2: Run the rendered test and confirm RED**

Run: `npm run build && node --test --test-name-pattern="renders one shared AI profile" tests/rendered-html.test.mjs`

Expected: FAIL because the comparison mount and shared section are missing.

- [ ] **Step 3: Add the minimum shared markup**

Move the four existing labels into one section:

```html
<div id="ai-advisor-profile-mount" class="shared-ai-profile-mount">
  <details id="shared-ai-profile" class="shared-ai-profile" open>
    <summary>
      <span><strong>個人資料（選填）</strong><small>填寫後，AI 會加入更貼近你的取捨建議。</small></span>
      <b id="shared-ai-profile-completion">尚未填寫</b>
    </summary>
    <div class="shared-ai-profile-fields">
      <label>自我介紹<textarea id="ai-profile" maxlength="2000" rows="3" placeholder="例如：政大大三，具程式與產品設計基礎"></textarea></label>
      <label>未來方向<textarea id="ai-future" maxlength="2000" rows="3" placeholder="例如：AI 產品、金融科技或創業"></textarea></label>
      <label>這學期想達成什麼<textarea id="ai-goals" maxlength="2000" rows="3" placeholder="例如：每週實習三天、完成 AI 作品並補足研究方法"></textarea></label>
      <label>排課偏好<textarea id="ai-preferences" maxlength="2000" rows="3" placeholder="例如：課集中週二、週四，偏好可非同步課"></textarea></label>
    </div>
  </details>
</div>
```

Add `<div id="ai-comparison-profile-mount" class="shared-ai-profile-mount"></div>` above the comparison course picker and remove the old `comparison-profile-hint` button.

- [ ] **Step 4: Run the structure test and confirm GREEN**

Run: `npm run build && node --test --test-name-pattern="renders one shared AI profile" tests/rendered-html.test.mjs`

Expected: the new structure test passes.

- [ ] **Step 5: Write the failing shared-state movement test**

```js
test('moves the same AI profile between tools and updates completion', async () => {
  const html = await (await render()).text();
  assert.match(html, /function readSharedAiProfile\(\)/);
  assert.match(html, /function mountSharedAiProfile\(toolName\)/);
  assert.match(html, /target\.append\(profileSection\)/);
  assert.match(html, /profileSection\.open = toolName === 'advisor'/);
  assert.match(html, /byId\('shared-ai-profile'\)\.addEventListener\('input', updateSharedAiProfileCompletion\)/);
});
```

- [ ] **Step 6: Run the movement test and confirm RED**

Run: `npm run build && node --test --test-name-pattern="moves the same AI profile" tests/rendered-html.test.mjs`

Expected: FAIL because the helper functions do not exist.

- [ ] **Step 7: Implement minimal movement and completion logic**

```js
function readSharedAiProfile() {
  return {
    profileText: byId('ai-profile').value,
    futureDirection: byId('ai-future').value,
    semesterGoals: byId('ai-goals').value,
    preferences: byId('ai-preferences').value,
  };
}

function updateSharedAiProfileCompletion() {
  byId('shared-ai-profile-completion').textContent = aiProfileCompletionLabel(readSharedAiProfile());
}

function mountSharedAiProfile(toolName) {
  if (!['advisor', 'comparison'].includes(toolName)) return;
  const target = byId(toolName === 'advisor' ? 'ai-advisor-profile-mount' : 'ai-comparison-profile-mount');
  const profileSection = byId('shared-ai-profile');
  target.append(profileSection);
  profileSection.open = toolName === 'advisor';
  updateSharedAiProfileCompletion();
}
```

Import `aiProfileCompletionLabel`, call `mountSharedAiProfile(name)` inside `setAiTool`, and listen for input on the one shared section. Replace both AI payload builders with `...readSharedAiProfile()` so all requests consume the same object.

- [ ] **Step 8: Run Task 2 tests and refactor with tests green**

Run: `npm run build && node --test --test-name-pattern="shared AI profile|AI planning|syllabus comparison" tests/rendered-html.test.mjs`

Expected: all matched tests pass, including unchanged payload assertions.

- [ ] **Step 9: Commit Task 2**

```bash
git add src/index.html src/app.mjs tests/rendered-html.test.mjs
git commit -m "feat: share profile across AI tools"
```

---

### Task 3: Responsive styling, guidance, and end-to-end verification

**Files:**
- Modify: `src/styles.css`
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/browser/sunbreak-critical-flows.md`

**Interfaces:**
- Consumes: Task 2 shared profile DOM and completion state.
- Produces: keyboard-accessible, mobile-safe profile disclosure and updated user guidance.

- [ ] **Step 1: Write the failing responsive and privacy regression test**

```js
test('styles and teaches the private shared AI profile', async () => {
  const html = await (await render()).text();
  assert.match(html, /\.shared-ai-profile\s*\{[^}]*border:/s);
  assert.match(html, /\.shared-ai-profile summary\s*\{[^}]*min-height:\s*44px/s);
  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.shared-ai-profile-fields\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(html, /兩項 AI 功能共用同一份個人資料/);
  assert.doesNotMatch(html, /localStorage\.setItem\([^)]*(ai-profile|profileText|futureDirection|semesterGoals|preferences)/);
});
```

- [ ] **Step 2: Run the responsive test and confirm RED**

Run: `npm run build && node --test --test-name-pattern="styles and teaches the private shared AI profile" tests/rendered-html.test.mjs`

Expected: FAIL because the new component styles and guidance do not exist.

- [ ] **Step 3: Add minimum polished styles and guidance**

```css
.shared-ai-profile { overflow: hidden; border: 1px solid #c8bce0; border-radius: var(--radius-control); background: linear-gradient(145deg, var(--surface), var(--violet-soft)); }
.shared-ai-profile summary { display: flex; min-height: 44px; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 12px; cursor: pointer; }
.shared-ai-profile-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px solid var(--line); padding: 12px; }
.shared-ai-profile summary:focus-visible { outline: 3px solid rgb(42 72 226 / 28%); outline-offset: -3px; }

@media (max-width: 640px) {
  .shared-ai-profile-fields { grid-template-columns: 1fr; }
}
```

Update the AI quick-tour body to:

```js
body: '先選擇「AI 排課推薦」或「AI 課綱比較」。兩項 AI 功能共用同一份選填個人資料，在任一頁修改都會立即同步；重新整理後清除。推薦會產生三個無衝堂方案，比較頁可搜尋並勾選 2 至 5 門課。'
```

Add this tutorial sentence under the AI comparison guide:

```html
<li><strong>共用個人資料：</strong>兩項 AI 功能共用同一份個人資料；可在推薦或比較頁直接填寫，修改會立即同步。資料不會長期保存，重新整理或關閉分頁即清除。</li>
```

- [ ] **Step 4: Run the responsive test and confirm GREEN**

Run: `npm run build && node --test --test-name-pattern="styles and teaches the private shared AI profile" tests/rendered-html.test.mjs`

Expected: the new test passes.

- [ ] **Step 5: Run all automated and real-boundary checks**

Run: `npm test && npm run lint && npm run test:contract:nccu && git diff --check`

Expected: every command exits 0; live NCCU contract fields remain valid.

- [ ] **Step 6: Verify desktop and mobile flows in Chrome**

Run the local dev server and verify:

1. Fill two fields in AI 排課推薦; comparison shows `已填 2／4 項` and the same values.
2. Edit another field in comparison; advisor shows the update.
3. Comparison profile is collapsed on entry; advisor profile is expanded on entry.
4. Two-course comparison actions stay enabled as before and request payloads include current shared values.
5. At 375×812, no clipping, overlap, or horizontal page overflow occurs.
6. Reload clears the four fields; planner courses remain intact.
7. Browser console has no errors.

Record the result in `tests/browser/sunbreak-critical-flows.md`.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/styles.css src/index.html src/app.mjs tests/rendered-html.test.mjs tests/browser/sunbreak-critical-flows.md
git commit -m "feat: polish shared AI profile workflow"
```

- [ ] **Step 8: Publish the verified commit**

Push `main`, save a new Sites version for the exact commit SHA, deploy it to the existing public project `appgprj_6a556549efe081918038e175841e62e5`, and poll deployment status until `succeeded`.
