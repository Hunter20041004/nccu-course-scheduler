# AI Course Import and Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有私人政大排課網站加入一致的課程操作、截圖辨識匯入，以及能保留鎖定課程的三套 AI 推薦課表。

**Architecture:** 保留目前單頁、零前端框架與 `localStorage` 架構；把可測的課程狀態、AI 契約、Groq client、政大官方查詢 adapter 與 Worker 路由拆成小型 ESM 模組。Groq 只在 Sites Worker 伺服器端呼叫，AI 輸出必須通過 schema、官方資料及本機排課規則，前端不能直接信任模型產生的課號或可行性。

**Tech Stack:** Node.js 22 ESM、原生 Web API、Node test runner、HTML/CSS/vanilla JavaScript、OpenAI-compatible Groq Chat Completions、OpenAI Sites Worker、Chrome E2E。

## Global Constraints

- 嚴格採用垂直切片 TDD：一次只寫一個失敗測試，確認 RED 後才做最小 GREEN，再重構並確認全綠。
- 模型固定為 `qwen/qwen3.6-27b`，Groq 端點固定為 `https://api.groq.com/openai/v1/chat/completions`。
- `GROQ_API_KEY` 只可存在 Sites 加密伺服器環境變數；不得寫入 repo、`.env`、bundle、console、測試輸出或 HTTP 回應。
- 單次匯入只接受一張 PNG、JPEG 或 WebP；base64 data URL 上限 4 MB，辨識結果上限 50 門。
- AI 只可引用請求候選清單內、已確認開課且資格非 blocked/unavailable 的課程 ID。
- 官方核對使用 `https://es.nccu.edu.tw/course/zh-TW/` 公開課程服務；失敗、查無唯一結果或未開課時降級到「待確認」。
- 截圖與個人敘述只在請求期間處理，不在伺服器長期保存。
- 套用 AI 方案時，使用 `union(plan.courseIds, lockedCourseIds)`，不改變鎖定集合。
- 延續雨後日光／輕夢核的米白、暖黃、霧藍與淡紫，不加入薄荷綠或亮天藍。
- 正式部署後必須用 Chrome 驗證全部既有與新增的主要流程。

---

## File Structure

### New files

- `src/ai-contracts.mjs`：驗證匯入／推薦請求、解析 Groq JSON、限制欄位與課程 ID。
- `src/groq-client.mjs`：建立 Groq text/vision 請求、45 秒 timeout、上游錯誤映射。
- `src/nccu-course-adapter.mjs`：建立政大公開課程查詢 URL、解析官方 response、唯一結果核對。
- `src/ai-service.mjs`：協調 Groq、內建課程、官方核對，產生匯入結果與三方案。
- `src/worker.mjs`：`GET /`、兩個 `POST /api/ai/*` 路由與 JSON 錯誤回應。
- `src/ai-planner.mjs`：瀏覽器可測的圖片驗證、匯入合併、套用方案與方案可行性計算。
- `tests/ai-contracts.test.mjs`：純 schema／白名單測試。
- `tests/groq-client.test.mjs`：注入 fake fetch 的 request/timeout/error 測試。
- `tests/nccu-course-adapter.test.mjs`：官方 response fixture 解析及降級測試。
- `tests/nccu-live-contract.test.mjs`：以已知 115-1 關鍵字驗證公開服務真實欄位。
- `tests/ai-service.test.mjs`：匯入比對、待確認與三方案清理測試。
- `tests/worker.test.mjs`：API 路由、content type、status 與環境變數邊界。
- `tests/groq-live-contract.test.mjs`：以環境變數條件啟用的真實文字與單張微型圖片契約測試。
- `tests/ai-planner.test.mjs`：前端純狀態流程與鎖定課程聯集測試。

### Modified files

- `src/planner-core.mjs`：鎖定未選課程、允許刪除任意候選課程並清理鎖定集合。
- `src/planner-storage.mjs`：狀態升級到 v3，保存 AI 匯入課程與待確認項目。
- `src/app.mjs`：三操作按鈕、AI 截圖匯入、AI 顧問表單、三方案卡與狀態訊息。
- `src/index.html`：AI 顧問與匯入區的語意容器。
- `src/styles.css`：精簡三操作、匯入結果、表單及三方案響應式樣式。
- `scripts/build.mjs`：同時 bundle 瀏覽器 helper 與 Worker 伺服器模組。
- `scripts/dev.mjs`：把本機 HTTP method、headers、body 與 env 傳給 Worker。
- `package.json`：把新增單元、整合與 contract 測試納入 scripts，並擴充 lint。
- `tests/planner-core.test.mjs`、`tests/planner-storage.test.mjs`、`tests/rendered-html.test.mjs`、`tests/bundle-syntax.test.mjs`：既有行為回歸與新增操作流程。
- `README.md`：本機啟動、AI secret、live contract 與隱私說明。

---

### Task 1: 任意課程鎖定與刪除狀態

**Files:**
- Modify: `src/planner-core.mjs`
- Modify: `tests/planner-core.test.mjs`

**Interfaces:**
- Produces: `lockCandidateCourse(selected, lockedCourseIds, course, profile) -> { selected, lockedCourseIds }`
- Produces: `deleteCandidateCourse(courseStore, selected, lockedCourseIds, courseId) -> { courseStore, selected, lockedCourseIds, deleted }`

- [ ] **Step 1: RED — 未選課程按鎖定會先加入再鎖定**

```js
test('adds and locks an unselected eligible candidate in one action', () => {
  const hci = { id: 'hci', title: '人機互動', available: true };
  assert.deepEqual(core.lockCandidateCourse([], [], hci, profile), {
    selected: [{ ...hci, attendance: 'physical' }],
    lockedCourseIds: ['hci'],
  });
});
```

- [ ] **Step 2: Run RED**

Run: `node --test --test-name-pattern="adds and locks" tests/planner-core.test.mjs`  
Expected: FAIL，`core.lockCandidateCourse is not a function`。

- [ ] **Step 3: GREEN — 加入最小鎖定 helper**

```js
export function lockCandidateCourse(selected, lockedCourseIds, course, profile) {
  if (lockedCourseIds.includes(course.id)) {
    return {
      selected,
      lockedCourseIds: lockedCourseIds.filter((id) => id !== course.id),
    };
  }
  const nextSelected = selected.some((item) => item.id === course.id)
    ? selected
    : toggleSelectableCourse(selected, course, profile);
  if (!nextSelected.some((item) => item.id === course.id)) {
    return { selected, lockedCourseIds };
  }
  return { selected: nextSelected, lockedCourseIds: [...lockedCourseIds, course.id] };
}
```

- [ ] **Step 4: Run GREEN and regression**

Run: `node --test --test-name-pattern="adds and locks|toggles a selected course lock" tests/planner-core.test.mjs`  
Expected: 2 PASS。

- [ ] **Step 5: RED — 刪除核心課也同步清理選取與鎖定**

把原本「refuses to delete」測試改成：

```js
test('deletes any candidate and removes its selection and lock', () => {
  const required = { id: 'required', required: true };
  assert.deepEqual(
    core.deleteCandidateCourse([required], [required], ['required'], required.id),
    { courseStore: [], selected: [], lockedCourseIds: [], deleted: required },
  );
});
```

- [ ] **Step 6: Run RED**

Run: `node --test --test-name-pattern="deletes any candidate" tests/planner-core.test.mjs`  
Expected: FAIL，既有實作回傳 `deleted: null`。

- [ ] **Step 7: GREEN — 刪除函式接受並清理 locks**

```js
export function deleteCandidateCourse(courseStore, selected, lockedCourseIds, courseId) {
  const deleted = courseStore.find((course) => course.id === courseId);
  if (!deleted) return { courseStore, selected, lockedCourseIds, deleted: null };
  return {
    courseStore: courseStore.filter((course) => course.id !== courseId),
    selected: selected.filter((course) => course.id !== courseId),
    lockedCourseIds: lockedCourseIds.filter((id) => id !== courseId),
    deleted,
  };
}
```

更新既有 optional delete 測試呼叫，傳入 `[]`，並斷言 `lockedCourseIds: []`。

- [ ] **Step 8: Refactor and verify**

Run: `node --test tests/planner-core.test.mjs`  
Expected: 全部 PASS。

- [ ] **Step 9: Commit**

```bash
git add src/planner-core.mjs tests/planner-core.test.mjs
git commit -m "Add universal course locking and deletion"
```

---

### Task 2: 每門候選課固定顯示三個操作

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `scripts/build.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `lockCandidateCourse(...)`、新版 `deleteCandidateCourse(...)`
- Produces: 每門 `.catalog-course` 內的 `.course-details`、`[data-lock-course]`、`[data-delete-course]`

- [ ] **Step 1: RED — rendered bundle 必須對所有課程輸出三操作模板**

```js
test('renders detail lock and delete controls for every candidate type', async () => {
  const html = await (await render()).text();
  assert.match(html, /class="course-actions"/);
  assert.match(html, /data-lock-course=/);
  assert.match(html, /data-delete-course=/);
  assert.doesNotMatch(html, /course\.required\s*\?\s*`<button class="catalog-lock/);
});
```

- [ ] **Step 2: Run RED**

Run: `npm run build && node --test --test-name-pattern="renders detail lock" tests/rendered-html.test.mjs`  
Expected: FAIL，沒有 `course-actions`，且模板仍以 `course.required` 二選一。

- [ ] **Step 3: GREEN — 統一三操作 markup**

在 `renderCatalog()` 中把 detail 與按鈕組合為：

```js
const actions = `<div class="course-actions">
  ${details || `<details class="course-details"><summary>詳細</summary><div class="course-details-card"><p>目前沒有額外限制。</p></div></details>`}
  <button class="catalog-lock ${locked ? 'is-active' : ''}" type="button"
    data-lock-course="${escapeHtml(course.id)}" aria-pressed="${locked}">
    ${locked ? '解鎖' : '鎖定'}
  </button>
  <button class="catalog-delete" type="button" data-delete-course="${escapeHtml(course.id)}">刪除</button>
</div>`;
```

在卡片中固定插入 `${actions}`，移除 required/optional 二選一。

- [ ] **Step 4: Run GREEN**

Run: `npm run build && node --test --test-name-pattern="renders detail lock" tests/rendered-html.test.mjs`  
Expected: PASS。

- [ ] **Step 5: RED — handler 使用新狀態函式且核心課有額外確認文字**

```js
test('locks unselected courses and confirms deletion of core candidates', async () => {
  const html = await (await render()).text();
  assert.match(html, /lockCandidateCourse\(selected, lockedCourseIds, course, profile\)/);
  assert.match(html, /這是你標記為一定要修的課程/);
  assert.match(html, /deleteCandidateCourse\(courseStore, selected, lockedCourseIds, course\.id\)/);
});
```

- [ ] **Step 6: Run RED**

Run: `npm run build && node --test --test-name-pattern="locks unselected" tests/rendered-html.test.mjs`  
Expected: FAIL。

- [ ] **Step 7: GREEN — 更新 click handler**

```js
if (lockButton) {
  const course = courseStore.find((item) => item.id === lockButton.dataset.lockCourse);
  const result = lockCandidateCourse(selected, lockedCourseIds, course, profile);
  selected = result.selected;
  lockedCourseIds = result.lockedCourseIds;
  persistState();
  renderAll();
  return;
}
```

刪除確認文字使用：

```js
const warning = course.required
  ? `這是你標記為一定要修的課程。仍要刪除「${course.title}」嗎？`
  : `要從候選課程刪除「${course.title}」嗎？`;
if (!window.confirm(warning)) return;
const result = deleteCandidateCourse(courseStore, selected, lockedCourseIds, course.id);
courseStore = result.courseStore;
selected = result.selected;
lockedCourseIds = result.lockedCourseIds;
```

把 `lockCandidateCourse` 加入 `scripts/build.mjs` 的 `plannerCore` export list。

- [ ] **Step 8: Refactor CSS and verify**

新增精簡操作列，不增加 48px 候選列的常態高度：

```css
.course-actions { display: grid; grid-template-columns: minmax(72px, 1fr) auto auto; gap: 6px; align-items: start; }
.course-actions > button, .course-details summary { min-height: 44px; padding: 8px 10px; }
.catalog-lock.is-active { color: #fff; background: #6879C9; }
.catalog-delete { color: #8f3737; }
```

Run: `npm test && npm run lint`  
Expected: 全部 PASS、exit 0。

- [ ] **Step 9: Commit**

```bash
git add src/app.mjs src/styles.css scripts/build.mjs tests/rendered-html.test.mjs
git commit -m "Show complete controls on every course"
```

---

### Task 3: AI 請求與回覆契約

**Files:**
- Create: `src/ai-contracts.mjs`
- Create: `tests/ai-contracts.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateImportRequest(input) -> { imageDataUrl, term }`
- Produces: `parseRecognizedCourses(content) -> { recognizedCourses }`
- Produces: `validateRecommendationRequest(input) -> normalized request`
- Produces: `parseRecommendedPlans(content, allowedCourseIds) -> { summary, plans }`

- [ ] **Step 1: RED — 拒絕非圖片 data URL**

```js
test('rejects non-image import data URLs', () => {
  assert.throws(
    () => validateImportRequest({ imageDataUrl: 'data:text/plain;base64,QQ==', term: '115-1' }),
    { name: 'ContractError', message: '只接受 PNG、JPEG 或 WebP 截圖。' },
  );
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/ai-contracts.test.mjs`  
Expected: FAIL，module 不存在。

- [ ] **Step 3: GREEN — 建立 ContractError 與圖片驗證**

```js
export class ContractError extends Error {
  constructor(message, status = 400, code = 'INVALID_REQUEST') {
    super(message);
    this.name = 'ContractError';
    this.status = status;
    this.code = code;
  }
}

const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/;
export function validateImportRequest(input) {
  const match = typeof input?.imageDataUrl === 'string' && input.imageDataUrl.match(IMAGE_PATTERN);
  if (!match) throw new ContractError('只接受 PNG、JPEG 或 WebP 截圖。');
  if (input.imageDataUrl.length > 4_000_000) {
    throw new ContractError('截圖超過 4 MB，請裁切或壓縮後重試。', 413, 'IMAGE_TOO_LARGE');
  }
  if (input.term !== '115-1') throw new ContractError('目前只支援 115-1。');
  return { imageDataUrl: input.imageDataUrl, term: input.term };
}
```

- [ ] **Step 4: Run GREEN**

Run: `node --test --test-name-pattern="rejects non-image" tests/ai-contracts.test.mjs`  
Expected: PASS。

- [ ] **Step 5: RED — 辨識 JSON 最多 50 筆且正規化欄位**

```js
test('parses recognized courses into a bounded normalized shape', () => {
  const result = parseRecognizedCourses(JSON.stringify({ recognizedCourses: [{
    courseCode: ' 703055001 ', title: ' 人機互動 ', teacher: '廖文宏', credits: 3,
    scheduleText: '四234', confidence: 0.97,
  }] }));
  assert.deepEqual(result.recognizedCourses[0], {
    courseCode: '703055001', title: '人機互動', teacher: '廖文宏',
    credits: 3, scheduleText: '四234', confidence: 0.97,
  });
});
```

- [ ] **Step 6: Run RED, implement, run GREEN**

實作 `parseRecognizedCourses(content)`：`JSON.parse` 後確認 `recognizedCourses` 是 array、長度 `<= 50`、`title` 或 `courseCode` 至少一項存在、confidence clamp 到 `0..1`；不合法時拋 `ContractError('AI 回覆格式不正確。', 502, 'INVALID_AI_RESPONSE')`。

Run: `node --test --test-name-pattern="parses recognized" tests/ai-contracts.test.mjs`  
Expected: PASS。

- [ ] **Step 7: RED — 推薦方案只能引用白名單且恰好三組**

```js
test('rejects recommendation plans with hallucinated course ids', () => {
  const content = JSON.stringify({ summary: '摘要', plans: [
    { id: 'a', title: 'A', reason: 'A', courseIds: ['known'], attendance: '', tradeoffs: [] },
    { id: 'b', title: 'B', reason: 'B', courseIds: ['invented'], attendance: '', tradeoffs: [] },
    { id: 'c', title: 'C', reason: 'C', courseIds: ['known'], attendance: '', tradeoffs: [] },
  ] });
  assert.throws(() => parseRecommendedPlans(content, new Set(['known'])), /未知課程/);
});
```

- [ ] **Step 8: Run RED, implement, run GREEN**

`validateRecommendationRequest` 限制五段文字各 2,000 字、courses 最多 100 筆，並只保留 `id/title/credits/teacher/schedule/meetings/asyncAllowed/conditions/eligibility`。`parseRecommendedPlans` 驗證恰好三組、plan ID 唯一、courseIds 非空且全在 allowed set。

Run: `node --test tests/ai-contracts.test.mjs`  
Expected: 全部 PASS。

- [ ] **Step 9: Add scripts and commit**

把 `tests/ai-contracts.test.mjs` 加入 `test:unit`；把 `node --check src/ai-contracts.mjs` 加入 `lint`。

```bash
git add src/ai-contracts.mjs tests/ai-contracts.test.mjs package.json
git commit -m "Define strict AI API contracts"
```

---

### Task 4: Groq 伺服器 client 與錯誤映射

**Files:**
- Create: `src/groq-client.mjs`
- Create: `tests/groq-client.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `requestGroqJson({ apiKey, messages, fetchImpl, timeoutMs }) -> parsed assistant content string`
- Produces: `GroqError { status, code }`

- [ ] **Step 1: RED — vision request 使用固定模型與 JSON mode**

```js
test('posts a structured request to the fixed Groq model', async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return Response.json({ choices: [{ message: { content: '{"recognizedCourses":[]}' } }] });
  };
  const content = await requestGroqJson({
    apiKey: 'test-only', fetchImpl, timeoutMs: 100,
    messages: [{ role: 'user', content: [{ type: 'text', text: 'extract' }] }],
  });
  assert.equal(captured.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(captured.body.model, 'qwen/qwen3.6-27b');
  assert.deepEqual(captured.body.response_format, { type: 'json_object' });
  assert.equal(captured.init.headers.authorization, 'Bearer test-only');
  assert.equal(content, '{"recognizedCourses":[]}');
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/groq-client.test.mjs`  
Expected: FAIL，module 不存在。

- [ ] **Step 3: GREEN — 最小 client**

```js
export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODEL = 'qwen/qwen3.6-27b';

export async function requestGroqJson({ apiKey, messages, fetchImpl = fetch, timeoutMs = 45_000 }) {
  if (!apiKey) throw new GroqError('AI 服務尚未設定。', 503, 'AI_NOT_CONFIGURED');
  const response = await fetchImpl(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages, response_format: { type: 'json_object' } }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw mapGroqStatus(response.status);
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new GroqError('AI 回覆格式不正確。', 502, 'INVALID_AI_RESPONSE');
  return content;
}
```

- [ ] **Step 4: Run GREEN**

Run: `node --test --test-name-pattern="posts a structured" tests/groq-client.test.mjs`  
Expected: PASS。

- [ ] **Step 5: RED — 429 與 timeout 不洩漏上游內容**

逐一新增並通過兩個垂直切片：

```js
test('maps Groq rate limits to a safe retryable error', async () => {
  const fetchImpl = async () => new Response('secret upstream body', { status: 429 });
  await assert.rejects(
    requestGroqJson({ apiKey: 'test-only', fetchImpl, messages: [] }),
    { status: 429, code: 'AI_RATE_LIMITED', message: 'AI 目前請求較多，請稍後再試。' },
  );
});
```

```js
test('maps aborted Groq requests to a timeout', async () => {
  const fetchImpl = async (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  await assert.rejects(
    requestGroqJson({ apiKey: 'test-only', fetchImpl, timeoutMs: 1, messages: [] }),
    { status: 504, code: 'AI_TIMEOUT' },
  );
});
```

在 `requestGroqJson` catch AbortError/TimeoutError 並轉成安全 `GroqError`；401/403→503、429→429、其他非 2xx→502。

- [ ] **Step 6: Verify and commit**

Run: `node --test tests/groq-client.test.mjs && npm run lint`  
Expected: 全部 PASS。

```bash
git add src/groq-client.mjs tests/groq-client.test.mjs package.json
git commit -m "Add secure Groq JSON client"
```

---

### Task 5: 政大官方課程 adapter 與真實契約

**Files:**
- Create: `src/nccu-course-adapter.mjs`
- Create: `tests/nccu-course-adapter.test.mjs`
- Create: `tests/nccu-live-contract.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildNccuCourseUrl({ term, keyword }) -> URL`
- Produces: `searchNccuCourses({ term, keyword, fetchImpl }) -> normalized courses[]`
- Normalized official course: `{ courseCode, title, teacher, credits, scheduleText, available, sourceUrl }`

- [ ] **Step 1: RED — 建立官方公開查詢 URL**

```js
test('builds the NCCU 115-1 keyword endpoint', () => {
  const url = buildNccuCourseUrl({ term: '115-1', keyword: '人機互動' });
  assert.equal(
    decodeURIComponent(url.pathname),
    '/course/zh-TW/:sem=1151 :curn=人機互動 /',
  );
});
```

- [ ] **Step 2: Run RED, implement, run GREEN**

```js
export function buildNccuCourseUrl({ term, keyword }) {
  const semester = term.replace('-', '');
  const query = `:sem=${semester} :curn=${keyword.trim()} `;
  return new URL(`/course/zh-TW/${encodeURIComponent(query)}/`, 'https://es.nccu.edu.tw');
}
```

Run: `node --test --test-name-pattern="builds the NCCU" tests/nccu-course-adapter.test.mjs`  
Expected: PASS。

- [ ] **Step 3: RED — 解析政大欄位**

```js
test('normalizes the public NCCU course response', async () => {
  const fetchImpl = async () => Response.json([{ y: '115', s: '1', subNum: '703055001',
    subNam: '人機互動', teaNam: '廖文宏', subPoint: '3.0', subTime: '四234',
    teaSchmUrl: 'https://newdoc.nccu.edu.tw/example.html' }]);
  assert.deepEqual(await searchNccuCourses({ term: '115-1', keyword: '703055001', fetchImpl }), [{
    courseCode: '703055001', title: '人機互動', teacher: '廖文宏', credits: 3,
    scheduleText: '四234', available: true,
    sourceUrl: 'https://newdoc.nccu.edu.tw/example.html',
  }]);
});
```

- [ ] **Step 4: Run RED, implement, run GREEN**

`searchNccuCourses` 要求 response 為 array，只保留 `y === '115' && s === '1'`，HTTP/JSON/shape 失敗時拋 `NccuLookupError`，由上層降級而非假造資料。

Run: `node --test tests/nccu-course-adapter.test.mjs`  
Expected: 全部 PASS。

- [ ] **Step 5: REAL BOUNDARY — 115-1 官方服務契約**

```js
test('live NCCU endpoint exposes the fields used by the adapter', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '人機互動' });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => /^\w{9}$/.test(row.courseCode)));
  assert.ok(rows.every((row) => row.title && Number.isFinite(row.credits)));
});
```

Run: `node --test tests/nccu-live-contract.test.mjs`  
Expected: 1 PASS；若官方服務暫時不可用，保留測試失敗證據並確認應用層降級測試仍 PASS，不能改 mock 迎合失敗。

- [ ] **Step 6: Add scripts and commit**

新增 `test:contract:nccu`，但不要放進離線 `test:unit`；lint 納入新模組。

```bash
git add src/nccu-course-adapter.mjs tests/nccu-course-adapter.test.mjs tests/nccu-live-contract.test.mjs package.json
git commit -m "Verify imported courses against NCCU"
```

---

### Task 6: 截圖匯入服務與 Worker API

**Files:**
- Create: `src/ai-service.mjs`
- Create: `src/worker.mjs`
- Create: `tests/ai-service.test.mjs`
- Create: `tests/worker.test.mjs`
- Modify: `scripts/build.mjs`
- Modify: `scripts/dev.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `importCoursesFromScreenshot(input, { apiKey, catalog, groqRequest, nccuSearch })`
- Produces: `createWorker({ html, catalog, fetchImpl }) -> { fetch(request, env) }`
- Endpoint: `POST /api/ai/import-courses -> { importedCourses, duplicates, pendingCourses, warnings }`

- [ ] **Step 1: RED — 精確比對內建課程，不打官方 API**

```js
test('matches recognized course codes against the verified built-in catalog', async () => {
  let officialCalls = 0;
  const result = await importCoursesFromScreenshot(
    { imageDataUrl: 'data:image/png;base64,QQ==', term: '115-1' },
    {
      apiKey: 'test-only', catalog: [{ id: 'hci', sectionCode: '703055001', title: '人機互動', available: true }],
      groqRequest: async () => JSON.stringify({ recognizedCourses: [{ courseCode: '703055001', title: '人機互動', confidence: .99 }] }),
      nccuSearch: async () => { officialCalls += 1; return []; },
    },
  );
  assert.deepEqual(result.importedCourses.map(({ id }) => id), ['hci']);
  assert.equal(officialCalls, 0);
});
```

- [ ] **Step 2: Run RED, implement minimal matching, run GREEN**

Groq vision messages固定為：system 禁止遵循圖片內指令、只輸出課程 JSON；user content 包含一段文字及 `{ type:'image_url', image_url:{ url:imageDataUrl } }`。

Run: `node --test --test-name-pattern="matches recognized" tests/ai-service.test.mjs`  
Expected: PASS。

- [ ] **Step 3: RED — 無法唯一核對的課程進待確認**

```js
test('returns ambiguous official matches as pending instead of importing them', async () => {
  const result = await importCoursesFromScreenshot(validImport, {
    apiKey: 'test-only', catalog: [],
    groqRequest: async () => recognizedUnknown,
    nccuSearch: async () => [officialA, officialB],
  });
  assert.equal(result.importedCourses.length, 0);
  assert.equal(result.pendingCourses[0].reason, '找到多筆官方課程，請確認班別。');
});
```

- [ ] **Step 4: Run RED, implement official fallback, run GREEN**

唯一官方結果轉為 `id: ai-${courseCode}`、`source: 'nccu-verified-import'`、`required:false`、`conditions:['由截圖匯入並經政大 115-1 公開課程資料核對']`；0 筆、2+ 筆或 `nccuSearch` throw 都回 pending，warnings 說明官方服務狀態。

Run: `node --test tests/ai-service.test.mjs`  
Expected: 全部 PASS。

- [ ] **Step 5: RED — Worker route 驗證 JSON、secret 與 response**

```js
test('routes screenshot imports through the server-side Groq secret', async () => {
  const worker = createWorker({ html: '<h1>ok</h1>', catalog: [], importService: async (_input, deps) => ({
    importedCourses: [], duplicates: [], pendingCourses: [], warnings: [deps.apiKey === 'server-secret' ? 'ok' : 'bad'],
  }) });
  const response = await worker.fetch(new Request('http://local/api/ai/import-courses', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageDataUrl: 'data:image/png;base64,QQ==', term: '115-1' }),
  }), { GROQ_API_KEY: 'server-secret' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { importedCourses: [], duplicates: [], pendingCourses: [], warnings: ['ok'] });
});
```

- [ ] **Step 6: Run RED, implement route/error envelope, run GREEN**

錯誤 envelope 固定 `{ error: { code, message } }`；route 只接受 `application/json` POST。`GET /` 保留 private/no-store HTML；未知 route 回 404 JSON。

Run: `node --test tests/worker.test.mjs`  
Expected: 全部 PASS。

- [ ] **Step 7: Bundle server modules and forward local request bodies**

`scripts/build.mjs` 讀取並 strip/import-wrap `ai-contracts`、`groq-client`、`nccu-course-adapter`、`ai-service`、`worker`，產生 `export default createWorker({ html, catalog: courses })`。`scripts/dev.mjs` 改成：

```js
const chunks = [];
for await (const chunk of request) chunks.push(chunk);
const result = await worker.fetch(new Request(`http://localhost:${port}${request.url || '/'}`, {
  method: request.method,
  headers: request.headers,
  body: ['GET', 'HEAD'].includes(request.method || 'GET') ? undefined : Buffer.concat(chunks),
}), process.env);
```

- [ ] **Step 8: Verify and commit**

Run: `npm test && npm run lint`  
Expected: 全部 PASS。

```bash
git add src/ai-service.mjs src/worker.mjs tests/ai-service.test.mjs tests/worker.test.mjs scripts/build.mjs scripts/dev.mjs package.json
git commit -m "Add secure screenshot import API"
```

---

### Task 7: 匯入課程的瀏覽器狀態、儲存與 UI

**Files:**
- Create: `src/ai-planner.mjs`
- Create: `tests/ai-planner.test.mjs`
- Modify: `src/planner-storage.mjs`
- Modify: `tests/planner-storage.test.mjs`
- Modify: `src/app.mjs`
- Modify: `src/index.html`
- Modify: `src/styles.css`
- Modify: `scripts/build.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: `validateScreenshotFile(file) -> null | { message }`
- Produces: `mergeImportedCourses(courseStore, importedCourses) -> { courseStore, duplicateIds }`
- Storage v3: `{ addedCourses, pendingCourses }`

- [ ] **Step 1: RED — 匯入課程不重複合併**

```js
test('merges verified imports without duplicating existing course ids', () => {
  const hci = { id: 'hci', title: '人機互動' };
  const ai = { id: 'ai-123', title: '新課' };
  assert.deepEqual(mergeImportedCourses([hci], [hci, ai]), {
    courseStore: [hci, ai], duplicateIds: ['hci'],
  });
});
```

- [ ] **Step 2: Run RED, implement, run GREEN**

Run: `node --test tests/ai-planner.test.mjs`  
Expected: PASS。

- [ ] **Step 3: RED — storage v3 保存新增及待確認課程**

```js
test('round-trips imported and pending courses in storage version three', () => {
  const state = { addedCourses: [{ id: 'ai-123' }], pendingCourses: [{ title: '待確認課' }] };
  assert.deepEqual(parsePlannerState(serializePlannerState(state), null), { version: 3, ...state });
});
```

- [ ] **Step 4: Run RED, bump storage, run GREEN**

`STORAGE_KEY = 'nccu-course-planner:v3'`，`serializePlannerState` 固定 version 3；`restoreState` 以 `buildCandidateCatalog(courses, saved.addedCourses, deletedCourseIds)` 重建，`persistState` 保存所有 `source !== 'nccu'` 的新增課程與 `pendingCourses`。

Run: `node --test tests/planner-storage.test.mjs tests/ai-planner.test.mjs`  
Expected: 全部 PASS。

- [ ] **Step 5: RED — UI 取代 Codex handoff，提供隱私同意與匯入結果**

```js
test('uploads a screenshot to the private import API and renders review groups', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="import-screenshot"/);
  assert.match(html, /fetch\('\/api\/ai\/import-courses'/);
  assert.match(html, /截圖會傳送給 Groq/);
  assert.match(html, /id="imported-courses"/);
  assert.match(html, /id="pending-courses"/);
  assert.doesNotMatch(html, /copy-codex-prompt/);
});
```

- [ ] **Step 6: Run RED, implement upload flow, run GREEN**

新增 `readFileAsDataUrl(file)`；點擊 `#import-screenshot` 前跑 MIME/3 MB raw size 驗證、disable button、設定 `aria-busy=true`，POST `{ imageDataUrl, term:'115-1' }`。成功後 `mergeImportedCourses`、更新 `pendingCourses`、persist/render；錯誤只顯示 server 安全 message。

Run: `npm run build && node --test --test-name-pattern="uploads a screenshot" tests/rendered-html.test.mjs`  
Expected: PASS。

- [ ] **Step 7: RED — 待確認可刪除且不進候選清單**

```js
test('keeps pending imports outside the candidate catalog until confirmed', () => {
  const merged = mergeImportedCourses([{ id: 'known' }], []);
  assert.deepEqual(merged.courseStore.map(({ id }) => id), ['known']);
});
```

UI 每筆 pending 顯示原因及 `data-delete-pending`；刪除只更新 pending array。確認動作只有在項目包含唯一官方 normalized course 時才顯示，點擊後標記 `source:'user-confirmed-import'` 並加入候選。

- [ ] **Step 8: Refactor styles and verify**

```css
.ai-import-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, .8fr); gap: 16px; }
.import-result-list { display: grid; gap: 8px; max-height: 320px; overflow: auto; }
.import-result { border: 1px solid rgba(104,121,201,.24); background: rgba(245,243,239,.82); }
@media (max-width: 760px) { .ai-import-layout { grid-template-columns: 1fr; } }
```

Run: `npm test && npm run lint`  
Expected: 全部 PASS。

- [ ] **Step 9: Commit**

```bash
git add src/ai-planner.mjs tests/ai-planner.test.mjs src/planner-storage.mjs tests/planner-storage.test.mjs src/app.mjs src/index.html src/styles.css scripts/build.mjs tests/rendered-html.test.mjs
git commit -m "Add screenshot import review flow"
```

---

### Task 8: AI 三方案服務與確定性清理

**Files:**
- Modify: `src/ai-service.mjs`
- Modify: `src/worker.mjs`
- Modify: `src/ai-contracts.mjs`
- Modify: `src/ai-planner.mjs`
- Modify: `tests/ai-service.test.mjs`
- Modify: `tests/worker.test.mjs`
- Modify: `tests/ai-planner.test.mjs`

**Interfaces:**
- Produces: `recommendCoursePlans(input, { apiKey, groqRequest }) -> { summary, plans }`
- Produces: `applyRecommendedPlan(plan, courseStore, selected, lockedCourseIds, profile) -> selected[]`
- Endpoint: `POST /api/ai/recommend-plans`

- [ ] **Step 1: RED — 只把合格且已開課候選課送給 Groq**

```js
test('excludes blocked and unavailable courses from recommendation prompts', async () => {
  let prompt;
  await recommendCoursePlans({ ...validRecommendation,
    courses: [eligibleCourse, { ...blockedCourse, eligibility: 'blocked' }],
  }, { apiKey: 'test-only', groqRequest: async ({ messages }) => {
    prompt = JSON.stringify(messages); return validThreePlans;
  } });
  assert.match(prompt, new RegExp(eligibleCourse.id));
  assert.doesNotMatch(prompt, new RegExp(blockedCourse.id));
});
```

- [ ] **Step 2: Run RED, implement prompt filtering, run GREEN**

system prompt 要求三個差異明確方案：「集中實習」「平衡探索」「目標優先」，保留 locked IDs，輸出規格 JSON，不宣稱最終無衝堂。

Run: `node --test --test-name-pattern="excludes blocked" tests/ai-service.test.mjs`  
Expected: PASS。

- [ ] **Step 3: RED — API route 回傳三方案且未知 ID 失敗**

在 `tests/worker.test.mjs` 加合法 POST 200；在 `tests/ai-contracts.test.mjs` 已有未知 ID 契約，route 需轉為 502 安全 envelope。

Run: `node --test --test-name-pattern="recommend" tests/worker.test.mjs`  
Expected: RED 後加入 `/api/ai/recommend-plans` branch，再 PASS。

- [ ] **Step 4: RED — 套用方案保留鎖定課，不自動新增 lock**

```js
test('applies a recommendation while preserving every locked selected course', () => {
  const catalog = [{ id: 'locked', available: true }, { id: 'recommended', available: true }];
  const result = applyRecommendedPlan(
    { courseIds: ['recommended'] }, catalog,
    [{ ...catalog[0], attendance: 'physical' }], ['locked'], profile,
  );
  assert.deepEqual(result.map(({ id }) => id), ['recommended', 'locked']);
});
```

- [ ] **Step 5: Run RED, implement deterministic union, run GREEN**

`applyRecommendedPlan` 先依 plan order 取課，再 append 未出現的 locked selected；每門使用 `resolveCourseOption` 及既有 attendance，blocked/unavailable 不加入，但原本 locked 例外保留並由 warnings 顯示資格。

Run: `node --test tests/ai-planner.test.mjs`  
Expected: 全部 PASS。

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run lint`  
Expected: 全部 PASS。

```bash
git add src/ai-service.mjs src/worker.mjs src/ai-contracts.mjs src/ai-planner.mjs tests/ai-service.test.mjs tests/worker.test.mjs tests/ai-planner.test.mjs
git commit -m "Generate and safely apply AI schedules"
```

---

### Task 9: AI 顧問表單與三張可比較方案卡

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `src/styles.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `/api/ai/recommend-plans`、`applyRecommendedPlan(...)`
- Produces: `#ai-advisor-form`、`#ai-plan-results`、`[data-apply-ai-plan]`

- [ ] **Step 1: RED — 表單具有五個需求欄位、隱私提示與 aria-live**

```js
test('collects the student profile and goals for AI planning', async () => {
  const html = await (await render()).text();
  for (const id of ['ai-profile', 'ai-activities', 'ai-future', 'ai-goals', 'ai-preferences']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /個人敘述會傳送給 Groq/);
  assert.match(html, /id="ai-advisor-status"[^>]*aria-live="polite"/);
});
```

- [ ] **Step 2: Run RED, add semantic form, run GREEN**

表單置於快速方案後的 `<details class="ai-advisor">`，textarea `maxlength="2000"`，送出按鈕文字「產生三個推薦方案」。

Run: `npm run build && node --test --test-name-pattern="collects the student" tests/rendered-html.test.mjs`  
Expected: PASS。

- [ ] **Step 3: RED — 送出精簡候選資料與現有實習設定**

```js
test('sends current courses locks and internship settings to the advisor API', async () => {
  const html = await (await render()).text();
  assert.match(html, /fetch\('\/api\/ai\/recommend-plans'/);
  assert.match(html, /internshipSettings,/);
  assert.match(html, /lockedCourseIds,/);
  assert.match(html, /eligibility:\s*evaluateEligibility\(course, profile\)\.status/);
});
```

- [ ] **Step 4: Run RED, implement submit/loading/error, run GREEN**

送出時 disable、`aria-busy`；response 存在 session 變數 `recommendedPlans`，不持久化個人敘述。失敗時保留原課表及表單內容。

- [ ] **Step 5: RED — 三方案卡顯示取捨並能套用**

```js
test('renders exactly three actionable recommendation cards', async () => {
  const html = await (await render()).text();
  assert.match(html, /class="ai-plan-grid"/);
  assert.match(html, /data-apply-ai-plan/);
  assert.match(html, /套用此方案/);
  assert.match(html, /applyRecommendedPlan\(/);
});
```

- [ ] **Step 6: Run RED, implement rendering/apply flow, run GREEN**

方案卡以 `calculateInternshipPlan`、`findConflicts`、`evaluateEligibility` 即時計算學分、實習可用天數、衝堂與資格 warning；有 warning 仍可展開查看，但套用前二次確認。套用後 `persistState(); renderAll();`，不改 `lockedCourseIds`。

- [ ] **Step 7: Refactor visual hierarchy and accessibility**

```css
.ai-plan-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.ai-plan-card { border: 1px solid rgba(145,128,181,.32); background: linear-gradient(145deg, rgba(255,255,255,.82), rgba(239,234,248,.78)); }
.ai-plan-card:focus-within { box-shadow: 0 0 0 3px rgba(104,121,201,.24); }
@media (max-width: 900px) { .ai-plan-grid { grid-template-columns: 1fr; } }
```

Run: `npm test && npm run lint`  
Expected: 全部 PASS。

- [ ] **Step 8: Commit**

```bash
git add src/index.html src/app.mjs src/styles.css tests/rendered-html.test.mjs
git commit -m "Add AI planning advisor interface"
```

---

### Task 10: 真實 Groq 契約、整體安全與回歸

**Files:**
- Create: `tests/fixtures/one-pixel.png`
- Create: `tests/groq-live-contract.test.mjs`
- Modify: `tests/bundle-syntax.test.mjs`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: `npm run test:contract:groq`
- Produces: `npm run verify`

- [ ] **Step 1: RED — bundle 不含 secret 或 Node-only API**

```js
test('keeps server secrets and node-only AI code out of browser HTML', async () => {
  const html = await readFile(new URL('../dist/server/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /gsk_[A-Za-z0-9]+/);
  const response = await render();
  const browserHtml = await response.text();
  assert.doesNotMatch(browserHtml, /GROQ_API_KEY|Authorization:\s*Bearer/);
});
```

- [ ] **Step 2: Run RED/GREEN by correcting build boundary**

Run: `npm run build && node --test --test-name-pattern="keeps server secrets" tests/bundle-syntax.test.mjs`  
Expected: PASS；若 FAIL，移除瀏覽器 wrap 中的 `groq-client/worker/ai-service`，只保留 `ai-planner`。

- [ ] **Step 3: REAL BOUNDARY — Groq 文字 JSON contract**

```js
test('live Groq model returns JSON object content', { skip: !process.env.GROQ_API_KEY, timeout: 60_000 }, async () => {
  const content = await requestGroqJson({
    apiKey: process.env.GROQ_API_KEY,
    messages: [
      { role: 'system', content: 'Return JSON only.' },
      { role: 'user', content: 'Return {"ok":true}.' },
    ],
  });
  assert.equal(JSON.parse(content).ok, true);
});
```

- [ ] **Step 4: REAL BOUNDARY — Groq 單張 base64 vision contract**

```js
test('live Groq model accepts one base64 image', { skip: !process.env.GROQ_API_KEY, timeout: 60_000 }, async () => {
  const imageDataUrl = `data:image/png;base64,${await readFile(fixture, 'base64')}`;
  const content = await requestGroqJson({ apiKey: process.env.GROQ_API_KEY, messages: [
    { role: 'system', content: 'Return JSON only.' },
    { role: 'user', content: [
      { type: 'text', text: 'Return {"seen":true}.' },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ] },
  ] });
  assert.equal(JSON.parse(content).seen, true);
});
```

fixture 必須是無個資的 1×1 PNG；測試只能顯示 PASS/FAIL，不印 request headers。

- [ ] **Step 5: Add verification scripts**

```json
{
  "scripts": {
    "test:contract:groq": "node --test tests/groq-live-contract.test.mjs",
    "test:contract:nccu": "node --test tests/nccu-live-contract.test.mjs",
    "verify": "npm test && npm run lint && npm run test:contract:nccu"
  }
}
```

Groq live test 不放進一般 `verify`，避免沒有 secret 的環境誤打 API；正式部署前明確執行一次。

- [ ] **Step 6: Document operation and privacy**

README 寫明：

```md
## AI 功能

AI API 金鑰只設定於 Sites 的加密環境變數 `GROQ_API_KEY`。不要建立含金鑰的 `.env` 或提交金鑰。截圖與顧問表單會傳送到 Groq，伺服器不保存請求內容。

本機測試：`npm test`
政大真實契約：`npm run test:contract:nccu`
Groq 真實契約：在安全環境提供 `GROQ_API_KEY` 後執行 `npm run test:contract:groq`
```

- [ ] **Step 7: Verify and commit**

Run: `npm run verify`  
Expected: unit、build、rendered、lint、NCCU contract 全 PASS。

Run securely: `npm run test:contract:groq` with `GROQ_API_KEY` injected without shell history  
Expected: 2 PASS，輸出不含金鑰。

```bash
git add tests/fixtures/one-pixel.png tests/groq-live-contract.test.mjs tests/bundle-syntax.test.mjs tests/rendered-html.test.mjs package.json README.md
git commit -m "Verify AI boundaries and privacy"
```

---

### Task 11: Sites secret、正式部署與 Chrome 完整驗收

**Files:**
- Modify (generated): `dist/server/index.js`
- Modify (generated): `dist/.openai/hosting.json`
- No secret-bearing files created

**Interfaces:**
- Deployment target: `appgprj_6a5587c540b0819191572c9cb320c553`
- Private URL: `https://nccu-course-planner-1151.huntertseng.chatgpt.site`

- [ ] **Step 1: Pre-deployment verification**

Run: `git status --short && npm run verify`  
Expected: 只有預期 source/test/doc 變更；所有驗證 PASS。

- [ ] **Step 2: Secret scan**

Run: `! rg -n "gsk_[A-Za-z0-9]+|Authorization: Bearer" --glob '!node_modules/**' --glob '!.git/**' .`  
Expected: exit 0、沒有輸出。

- [ ] **Step 3: Configure encrypted Sites environment variable**

依 `sites-hosting` 的 environment variable capability，把對話中使用者提供的值直接設定為既有 Sites 專案的 encrypted secret `GROQ_API_KEY`；工具輸入及結果不得轉貼到 commentary、Git 或檔案。

- [ ] **Step 4: Build and publish existing private project**

Run: `npm run build`  
Expected: `dist/server/index.js` 與 `dist/.openai/hosting.json` 產生成功。

使用 `sites-hosting` 發布 `dist/` 到 project `appgprj_6a5587c540b0819191572c9cb320c553`，維持 private access 與既有網址。

- [ ] **Step 5: API smoke tests without exposing payload secrets**

對正式站執行：

```bash
curl -i -X POST 'https://nccu-course-planner-1151.huntertseng.chatgpt.site/api/ai/import-courses' \
  -H 'content-type: application/json' \
  --data '{"imageDataUrl":"bad","term":"115-1"}'
```

Expected: `400` 與 `{ "error": { "code": "INVALID_REQUEST", ... } }`，沒有 upstream body 或 secret。

- [ ] **Step 6: Chrome E2E — 課程操作與持久化**

使用 `chrome:control-chrome` 開啟正式私人網址並逐項驗證：

1. 候選清單首屏可見至少 10 門，任一門都有「詳細／鎖定／刪除」。
2. 鎖定未選的非核心課會加入左側課表並顯示鎖定；點課表不能移除，解鎖後可移除。
3. 刪除一般課與核心課都會確認；核心課文案有額外警告；刪除後課表與鎖定同步清理。
4. 重新整理後選課、刪除、新增行程、實習設定與 AI 匯入課程仍在。

- [ ] **Step 7: Chrome E2E — 截圖匯入**

1. 不選圖片直接送出，看到格式提示且 focus 回到 input。
2. 上傳不含課程的安全測試圖，得到空結果或待確認，不 crash。
3. 上傳使用者的政大追蹤清單截圖，確認已存在課不重複、可核對課加入候選、模糊課進待確認。
4. 刪除一筆待確認，重新整理後維持刪除狀態。

- [ ] **Step 8: Chrome E2E — AI 三方案**

1. 填入非敏感測試自介、未來方向與本學期目標，送出期間按鈕 disabled 且有狀態。
2. 收到三張不同方案卡，每張顯示課程、原因、取捨、學分與實習可用時間。
3. 先鎖定兩門課，再套用任一方案；兩門鎖定課仍在且 lock set 不變。
4. 人工製造衝堂或未選指導老師，方案卡及套用後都顯示本機規則警告。

- [ ] **Step 9: Chrome E2E — 既有功能回歸與可用性**

驗證快速方案、一鍵清空、三門核心課不預設鎖定、人工智慧實務專題班別／老師、非同步出席、固定與彈性實習、社團／組織／個人行程、週日、搜尋／篩選、鍵盤 focus、縮小視窗與 reduced-motion。

- [ ] **Step 10: Final verification and commit generated deployment state**

Run: `npm run verify && git status --short`  
Expected: 全部 PASS；無未預期檔案，無 secret。

```bash
git add dist/server/index.js dist/.openai/hosting.json
git commit -m "Deploy AI course planner"
```

完成後建議使用者在 Groq 控制台輪替曾貼入聊天的測試金鑰，再以 Sites encrypted secret 更新新值。

---

## Self-Review Result

- Spec coverage：課程三操作、任意鎖定／刪除、截圖辨識、官方核對、待確認、五段 AI 顧問輸入、三方案、鎖定聯集、本機規則、隱私、安全、錯誤映射、Sites secret、正式部署及 Chrome E2E 均有對應 task。
- TDD order：每個行為先 RED、再最小 GREEN、再回歸／重構；沒有先批量寫完測試再批量實作。
- Boundary coverage：Groq 與政大公開課程服務都有真實 contract test，fake fetch 只負責單元隔離。
- Type consistency：`lockedCourseIds` 全程是 string array；import response、recommend response 與 storage v3 欄位在 service、Worker、browser helper、UI 中名稱一致。
- Secret handling：計畫沒有包含金鑰值；live test、部署及 secret scan 都禁止輸出金鑰。
- Placeholder scan：沒有 `TBD`、`TODO`、「之後補上」或未定的 API 路由；政大公開端點、Groq 端點、模型、檔案及命令均已具體化。
