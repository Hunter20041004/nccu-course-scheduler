# Old URL Canonical Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the complete current NCCU scheduler to `https://nccu-course-planner-1151.huntertseng.chatgpt.site/` as the single canonical live site and complete the tutorial for the newest official-data and AI comparison workflows.

**Architecture:** Keep the existing static frontend and Worker bundle unchanged. Update the one deployment binding and every user-facing canonical URL together, then extend the existing task-based tutorial rather than adding another onboarding surface. Protect each copy/configuration change with rendered or portfolio tests before implementation.

**Tech Stack:** Node.js 22, native `node:test`, static HTML/CSS/ES modules, Cloudflare Worker-compatible build, OpenAI Sites hosting.

## Global Constraints

- The only canonical live URL is `https://nccu-course-planner-1151.huntertseng.chatgpt.site/`.
- The existing Sites project ID is `appgprj_6a5587c540b0819191572c9cb320c553`; do not create a new project or change its slug.
- Do not modify the planner storage schema or clear browser-local course data.
- API keys, AI profile fields, and source screenshots remain excluded from durable storage and transfer JSON.
- Every implementation slice follows one-test-at-a-time Red → Green → Refactor.

---

### Task 1: Make the old URL the single canonical live site

**Files:**
- Modify: `tests/portfolio-release.test.mjs`
- Modify: `.openai/hosting.json`
- Modify: `README.md`
- Modify: `src/index.html`
- Modify: `src/app.mjs`

**Interfaces:**
- Consumes: existing `FULL_LIVE_DEMO_URL`, README Live Demo link, Sites `project_id`.
- Produces: one canonical URL and one deployment project binding used by the build and release workflow.

- [ ] **Step 1: Change one portfolio test to require the old URL and reject the replacement URL**

```js
test('points every live-demo reference at the canonical original Sites project', () => {
  const hosting = JSON.parse(readText('.openai/hosting.json'));
  const readme = readText('README.md');
  const html = readText('src/index.html');
  const app = readText('src/app.mjs');
  const canonicalUrl = 'https://nccu-course-planner-1151.huntertseng.chatgpt.site';

  assert.equal(hosting.project_id, 'appgprj_6a5587c540b0819191572c9cb320c553');
  for (const source of [readme, html, app]) assert.match(source, new RegExp(canonicalUrl.replaceAll('.', '\\.')));
  for (const source of [readme, html, app]) assert.doesNotMatch(source, /nccu-internship-scheduler\.abuzz-teal-2691\.chatgpt\.site/);
});
```

- [ ] **Step 2: Run the focused test and confirm Red**

Run: `node --test --test-name-pattern="canonical original" tests/portfolio-release.test.mjs`

Expected: FAIL because the project ID and live-demo references still point to the replacement site.

- [ ] **Step 3: Update the deployment binding and all canonical links**

```json
{
  "project_id": "appgprj_6a5587c540b0819191572c9cb320c553",
  "d1": null,
  "r2": null
}
```

```js
const FULL_LIVE_DEMO_URL = 'https://nccu-course-planner-1151.huntertseng.chatgpt.site';
```

Replace the README Live Demo links and `src/index.html#export-and-open-full` link with the same canonical URL. Remove every `nccu-internship-scheduler.abuzz-teal-2691.chatgpt.site` reference from these product files.

- [ ] **Step 4: Run the focused test and confirm Green**

Run: `node --test --test-name-pattern="canonical original" tests/portfolio-release.test.mjs`

Expected: PASS.

- [ ] **Step 5: Refactor the existing README-required-link assertion to use the old URL and rerun the whole portfolio test file**

Run: `node --test tests/portfolio-release.test.mjs`

Expected: all portfolio tests pass.

- [ ] **Step 6: Commit the canonical-site slice**

```bash
git add .openai/hosting.json README.md src/index.html src/app.mjs tests/portfolio-release.test.mjs
git commit -m "fix: restore original canonical site"
```

### Task 2: Teach the complete AI comparison prerequisites and evidence limits

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`
- Modify: `src/app.mjs`

**Interfaces:**
- Consumes: existing `#guide-ai` tutorial chapter and AI quick-tour step.
- Produces: first-run and permanent guidance matching the actual in-page comparison picker and official-syllabus behavior.

- [ ] **Step 1: Add one rendered-page test for the missing AI comparison guidance**

```js
test('teaches AI comparison prerequisites and official syllabus evidence limits', async () => {
  const html = await (await render()).text();
  assert.match(html, /先加入候選清單/);
  assert.match(html, /搜尋課名、教師或課號/);
  assert.match(html, /勾選 2 至 5 門/);
  assert.match(html, /不會由 AI 補造課程內容/);
  assert.match(html, /重新整理.*API Key.*個人資料.*清除/s);
});
```

- [ ] **Step 2: Run the focused test and confirm Red**

Run: `node --test --test-name-pattern="comparison prerequisites" tests/rendered-html.test.mjs`

Expected: FAIL because the tutorial does not yet state all prerequisites and evidence limits.

- [ ] **Step 3: Add the minimum tutorial and quick-tour copy**

Update `#guide-ai` with explicit sentences equivalent to:

```html
<li><strong>開始比較前：</strong>欲比較的課程必須先加入候選清單；進入課綱比較後，可搜尋課名、教師或課號並勾選 2 至 5 門。</li>
<li><strong>課綱資料限制：</strong>老師尚未上傳課綱或官方資料暫時讀不到時，系統會標示資料限制，不會由 AI 補造課程內容。</li>
<li><strong>分頁隱私：</strong>API Key 與共用個人資料會在重新整理或關閉分頁後清除。</li>
```

Update the AI quick-tour step to mention that comparison courses must already be in the candidate bank.

- [ ] **Step 4: Run the focused test and confirm Green**

Run: `node --test --test-name-pattern="comparison prerequisites" tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 5: Refactor adjacent AI tutorial bullets so each fact appears once, then rerun rendered tests**

Run: `node --test tests/rendered-html.test.mjs`

Expected: all rendered-page tests pass.

- [ ] **Step 6: Commit the AI tutorial slice**

```bash
git add src/index.html src/app.mjs tests/rendered-html.test.mjs
git commit -m "docs: complete AI comparison tutorial"
```

### Task 3: Teach safe cross-device and cross-URL migration

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`

**Interfaces:**
- Consumes: existing `#guide-first-run` storage note and `#guide-export-faq` troubleshooting chapter.
- Produces: an explicit, accurate migration procedure without changing planner persistence.

- [ ] **Step 1: Add one rendered-page test for the migration lesson**

```js
test('teaches how to move planner data back to the canonical URL', async () => {
  const html = await (await render()).text();
  assert.match(html, /另一個部署網址.*不會自動搬移/s);
  assert.match(html, /匯出排課 JSON.*舊網址.*從檔案匯入/s);
  assert.match(html, /不含.*API Key.*AI 個人資料.*原始截圖/s);
});
```

- [ ] **Step 2: Run the focused test and confirm Red**

Run: `node --test --test-name-pattern="canonical URL" tests/rendered-html.test.mjs`

Expected: FAIL because the tutorial describes generic device transfer but not moving back from another deployment URL.

- [ ] **Step 3: Add the minimum migration guidance**

Update the storage note and FAQ with copy equivalent to:

```html
<li><strong>從其他部署網址搬回正式站：</strong>不同網址的瀏覽器資料不會自動搬移。先在原網址從「更多操作」匯出排課 JSON，再到舊正式網址選擇「從檔案匯入」並確認預覽。檔案不含 API Key、AI 個人資料或原始截圖。</li>
```

- [ ] **Step 4: Run the focused test and confirm Green**

Run: `node --test --test-name-pattern="canonical URL" tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 5: Run all rendered tests and commit**

Run: `node --test tests/rendered-html.test.mjs`

Expected: all rendered-page tests pass.

```bash
git add src/index.html tests/rendered-html.test.mjs
git commit -m "docs: explain canonical-site data migration"
```

### Task 4: Validate, publish, and verify the old public URL

**Files:**
- Modify: `tests/browser/sunbreak-critical-flows.md`

**Interfaces:**
- Consumes: validated `HEAD`, existing build scripts, old Sites project, Chrome session.
- Produces: GitHub `main`, a deployed Sites version on the old URL, and browser QA evidence.

- [ ] **Step 1: Run the complete automated and real-boundary suite**

Run: `npm test && npm run lint && npm run test:contract:nccu && git diff --check`

Expected: 0 failures and exit code 0.

- [ ] **Step 2: Run Chrome QA against the local build**

Verify desktop and 375×812 mobile flows:

1. Open the permanent tutorial and confirm all nine chapters.
2. Confirm the AI chapter states candidate prerequisites, 2–5 selection, official-syllabus limits, shared profile privacy, and migration.
3. Start the quick tour and confirm the AI step points to the AI feature hub and describes candidate prerequisites.
4. Open AI recommendation and comparison; confirm the shared profile and course picker still work.
5. Confirm there is no horizontal overflow and the console has zero errors.

- [ ] **Step 3: Record browser evidence and rerun `git diff --check`**

Append the verified flows and current test counts to `tests/browser/sunbreak-critical-flows.md`.

- [ ] **Step 4: Commit QA evidence and push GitHub main**

```bash
git add tests/browser/sunbreak-critical-flows.md
git commit -m "test: verify canonical release tutorial"
git push origin main
```

- [ ] **Step 5: Package and publish the exact validated commit**

Use `.openai/hosting.json` project `appgprj_6a5587c540b0819191572c9cb320c553`, push the exact `HEAD` to its Sites source repository, package the validated build, save one version, deploy that version publicly, and poll until `succeeded`.

- [ ] **Step 6: Verify the deployed URL**

Open `https://nccu-course-planner-1151.huntertseng.chatgpt.site/`, confirm the new tutorial text and AI feature hub are live, and confirm the production console has zero errors.
