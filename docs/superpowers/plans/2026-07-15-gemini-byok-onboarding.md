# Gemini BYOK Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓第一次使用 Sunbreak 的學生學會申請 Gemini API Key，將 Key 僅保存在目前分頁記憶體，並用自己的免費 Gemini 額度完成截圖匯入與 AI 推薦。

**Architecture:** 保留目前單頁、零外部依賴與 Cloudflare Worker 架構。新增瀏覽器記憶體 Key session 與 Gemini client；前端每次 AI 操作把 Key 放在 HTTPS POST body，Worker 立即取出並從 service input 移除，再代理至 Gemini。課程資格、官方資料核對、衝堂、非同步、最低學分與實習規則仍由現有確定性程式負責。

**Tech Stack:** Native JavaScript ESM、Node.js 22 built-in test runner、semantic HTML、CSS、Cloudflare Worker-compatible Fetch API、Google Gemini REST API、Playwright CLI。

## Global Constraints

- 嚴格採一次一個 Red → Green → Refactor，不可批量先寫完測試。
- Key 不得寫入 `localStorage`、`sessionStorage`、IndexedDB、Cookie、URL、HTML、bundle、日誌或 API response。
- Key 僅存在目前分頁記憶體；重新整理或關閉分頁後消失。
- 一般排課資料繼續使用既有 `localStorage`；無 Key 時所有非 AI 功能必須可用。
- 截圖固定使用免費額度模型 `gemini-3.1-flash-lite`；推薦固定使用 `gemini-3.5-flash`。
- 公開 AI 流程不得讀取或依賴 `GROQ_API_KEY`。
- Gemini output 不能略過官方課程核對、資格、衝堂、最低學分、非同步與實習規則。
- 所有 AI response 使用 `Cache-Control: private, no-store`，錯誤不得包含 Key 或 Google 原始 body／headers。
- UI 實作套用 `frontend-design`、`emil-design-eng`；以 `ui-ux-pro-max` 檢查 dialog、表單、鍵盤與行動版。
- 不合併 Main；修改留在 `feature/sunbreak-redesign`。

## File Map

- Create `src/api-key-session.mjs`: 分頁記憶體 Key store 與驗證後保存 helper。
- Create `src/gemini-client.mjs`: Gemini payload、模型、metadata 驗證與安全錯誤。
- Modify `src/ai-service.mjs`: provider-neutral `aiRequest` 與模型選擇。
- Modify `src/worker.mjs`: BYOK 路由、敏感欄位移除與 no-store response。
- Modify `src/index.html`, `src/app.mjs`, `src/styles.css`: onboarding、狀態、設定與 AI gate。
- Modify `scripts/build.mjs`: browser session、server Gemini client 與 CSP hash。
- Modify `package.json`, `README.md`: scripts 與 BYOK 說明。
- Create `tests/api-key-session.test.mjs`, `tests/gemini-client.test.mjs`, `tests/gemini-live-contract.test.mjs`.
- Modify `tests/ai-service.test.mjs`, `tests/worker.test.mjs`, `tests/bundle-syntax.test.mjs`, `tests/rendered-html.test.mjs`.
- Create `tests/browser/gemini-byok-critical-flows.md`: Chrome／Playwright 實測紀錄。

---

### Task 1: In-memory API Key session

**Files:**
- Create: `src/api-key-session.mjs`
- Create: `tests/api-key-session.test.mjs`
- Modify: `package.json:10-16`

**Interfaces:**
- Produces: `createApiKeySession() -> { setKey, getKey, hasKey, clearKey }`.
- Produces: `validateAndStoreApiKey({ apiKey, session, fetchImpl }) -> Promise<{ valid: true }>`.

- [ ] **Step 1: Write one failing lifecycle test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiKeySession } from '../src/api-key-session.mjs';

test('keeps the Gemini key only in memory and clears it', () => {
  const session = createApiKeySession();
  assert.equal(session.hasKey(), false);
  session.setKey('  test-key  ');
  assert.equal(session.getKey(), 'test-key');
  session.clearKey();
  assert.equal(session.getKey(), null);
});
```

- [ ] **Step 2: Verify Red**

Run: `node --test tests/api-key-session.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the minimal store**

```js
export function createApiKeySession() {
  let key = null;
  return {
    setKey(value) {
      const normalized = String(value ?? '').trim();
      if (!normalized) throw new TypeError('請輸入 Gemini API Key。');
      key = normalized;
    },
    getKey: () => key,
    hasKey: () => Boolean(key),
    clearKey: () => { key = null; },
  };
}
```

- [ ] **Step 4: Verify Green**

Run: `node --test tests/api-key-session.test.mjs`

Expected: PASS, 1 test.

- [ ] **Step 5: Add one failing validate-before-store test**

```js
import { createApiKeySession, validateAndStoreApiKey } from '../src/api-key-session.mjs';

test('stores a key only after server validation succeeds', async () => {
  const session = createApiKeySession();
  let request;
  await validateAndStoreApiKey({
    apiKey: 'user-key', session,
    fetchImpl: async (url, init) => {
      request = { url, body: JSON.parse(init.body) };
      return Response.json({ valid: true });
    },
  });
  assert.deepEqual(request, {
    url: '/api/ai/validate-key', body: { apiKey: 'user-key' },
  });
  assert.equal(session.getKey(), 'user-key');
});
```

- [ ] **Step 6: Verify Red, implement, then verify Green**

Implement:

```js
export async function validateAndStoreApiKey({ apiKey, session, fetchImpl = fetch }) {
  const normalized = String(apiKey ?? '').trim();
  if (!normalized) throw new TypeError('請輸入 Gemini API Key。');
  const response = await fetchImpl('/api/ai/validate-key', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey: normalized }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || '無法驗證 API Key。');
  session.setKey(normalized);
  return payload;
}
```

Add a third test proving failed validation leaves `hasKey()` false.

Run: `node --test tests/api-key-session.test.mjs`

Expected: PASS, 3 tests.

- [ ] **Step 7: Register and commit**

Add the test file to `test:unit`.

```bash
git add src/api-key-session.mjs tests/api-key-session.test.mjs package.json
git commit -m "feat: add in-memory Gemini key session"
```

---

### Task 2: Gemini text and image client

**Files:**
- Create: `src/gemini-client.mjs`
- Create: `tests/gemini-client.test.mjs`
- Modify: `package.json:10-16`

**Interfaces:**
- Consumes: existing internal OpenAI-style `messages` arrays.
- Produces: `GEMINI_SCREENSHOT_MODEL`, `GEMINI_RECOMMENDATION_MODEL`, `requestGeminiJson(...) -> Promise<string>`.

- [ ] **Step 1: Write one failing text request test**

```js
test('posts JSON generation to the selected Gemini model', async () => {
  let captured;
  const text = await requestGeminiJson({
    apiKey: 'test-key', model: GEMINI_RECOMMENDATION_MODEL,
    messages: [
      { role: 'system', content: 'Return JSON only.' },
      { role: 'user', content: 'Return {"ok":true}.' },
    ],
    maxCompletionTokens: 2200,
    fetchImpl: async (url, init) => {
      captured = { url, init, body: JSON.parse(init.body) };
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
    },
  });
  assert.match(captured.url, /models\/gemini-3\.5-flash:generateContent$/);
  assert.equal(captured.init.headers['x-goog-api-key'], 'test-key');
  assert.equal(captured.body.systemInstruction.parts[0].text, 'Return JSON only.');
  assert.equal(captured.body.generationConfig.responseMimeType, 'application/json');
  assert.equal(text, '{"ok":true}');
});
```

- [ ] **Step 2: Verify Red**

Run: `node --test tests/gemini-client.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement constants and text conversion**

```js
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const GEMINI_SCREENSHOT_MODEL = 'gemini-3.1-flash-lite';
export const GEMINI_RECOMMENDATION_MODEL = 'gemini-3.5-flash';

function convertMessages(messages) {
  const systemText = messages.filter(({ role }) => role === 'system')
    .map(({ content }) => String(content ?? '')).join('\n\n');
  const contents = messages.filter(({ role }) => role !== 'system').map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: typeof message.content === 'string' ? [{ text: message.content }] : [],
  }));
  return { systemText, contents };
}
```

Implement `requestGeminiJson` with `x-goog-api-key`, `responseMimeType: 'application/json'`, `maxOutputTokens`, `AbortSignal.timeout`, and return joined `candidates[0].content.parts[].text`.

- [ ] **Step 4: Verify Green**

Run: `node --test --test-name-pattern="selected Gemini model" tests/gemini-client.test.mjs`

Expected: PASS.

- [ ] **Step 5: Add one failing data URL conversion test**

```js
test('converts screenshot data URLs into inlineData', async () => {
  let body;
  await requestGeminiJson({
    apiKey: 'test-key', model: GEMINI_SCREENSHOT_MODEL,
    messages: [{ role: 'user', content: [
      { type: 'text', text: '辨識圖片' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,U01BTEw=' } },
    ] }],
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return Response.json({ candidates: [{ content: { parts: [{ text: '{}' }] } }] });
    },
  });
  assert.deepEqual(body.contents[0].parts, [
    { text: '辨識圖片' },
    { inlineData: { mimeType: 'image/png', data: 'U01BTEw=' } },
  ]);
});
```

- [ ] **Step 6: Verify Red, add `convertPart`, verify Green**

```js
function convertPart(part) {
  if (part?.type === 'text') return { text: String(part.text ?? '') };
  if (part?.type === 'image_url') {
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(part.image_url?.url || '');
    if (!match) throw new GeminiError('圖片格式不受支援。', 400, 'INVALID_IMAGE');
    return { inlineData: { mimeType: match[1], data: match[2] } };
  }
  throw new GeminiError('AI 請求包含不支援的內容。', 400, 'INVALID_AI_CONTENT');
}
```

Run: `node --test tests/gemini-client.test.mjs`

Expected: PASS, 2 tests.

- [ ] **Step 7: Commit**

```bash
git add src/gemini-client.mjs tests/gemini-client.test.mjs package.json
git commit -m "feat: add Gemini text and image client"
```

---

### Task 3: Safe errors and Key metadata validation

**Files:**
- Modify: `src/gemini-client.mjs`
- Modify: `tests/gemini-client.test.mjs`

**Interfaces:**
- Produces: `GeminiError { status, code }` and `validateGeminiKey({ apiKey, fetchImpl, timeoutMs })`.

- [ ] **Step 1: Write one failing 429 test**

```js
test('maps free-tier exhaustion without upstream contents', async () => {
  await assert.rejects(requestGeminiJson({
    apiKey: 'test-key', model: GEMINI_RECOMMENDATION_MODEL, messages: [],
    fetchImpl: async () => new Response('secret upstream body', { status: 429 }),
  }), {
    status: 429,
    code: 'GEMINI_FREE_QUOTA_EXHAUSTED',
    message: '今天的免費額度已用完，請稍後或明天再試。',
  });
});
```

- [ ] **Step 2: Verify Red and add safe mapping**

```js
export class GeminiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.code = code;
  }
}

function mapGeminiStatus(status) {
  if (status === 400 || status === 401) return new GeminiError(
    '這組 API Key 無法使用，請回到 Google AI Studio 確認。', 401, 'GEMINI_KEY_INVALID');
  if (status === 403) return new GeminiError(
    '此 Google 帳號可能受到學校或公司政策限制，建議改用個人帳號。', 403, 'GEMINI_ACCOUNT_RESTRICTED');
  if (status === 429) return new GeminiError(
    '今天的免費額度已用完，請稍後或明天再試。', 429, 'GEMINI_FREE_QUOTA_EXHAUSTED');
  return new GeminiError('Gemini 暫時無法回應，請稍後再試。', 502, 'AI_UPSTREAM_ERROR');
}
```

Never parse or include the non-OK response body.

Run: `node --test --test-name-pattern="free-tier exhaustion" tests/gemini-client.test.mjs`

Expected: PASS.

- [ ] **Step 3: Add one failing metadata validation test**

```js
test('validates a key with model metadata', async () => {
  let captured;
  const result = await validateGeminiKey({
    apiKey: 'test-key',
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return Response.json({ name: 'models/gemini-3.1-flash-lite' });
    },
  });
  assert.match(captured.url, /models\/gemini-3\.1-flash-lite$/);
  assert.equal(captured.init.headers['x-goog-api-key'], 'test-key');
  assert.deepEqual(result, { valid: true });
});
```

- [ ] **Step 4: Verify Red and implement metadata validation**

`validateGeminiKey` must GET `${GEMINI_API_BASE}/${GEMINI_SCREENSHOT_MODEL}`, reuse `mapGeminiStatus`, map aborts to `504 AI_TIMEOUT`, and return `{ valid: true }` only on `response.ok`.

Run: `node --test --test-name-pattern="model metadata" tests/gemini-client.test.mjs`

Expected: PASS.

- [ ] **Step 5: Add 401, 403, timeout and missing-candidate tests one at a time**

Add only the 401 case first, run its name pattern Red → Green; then repeat separately for 403, timeout and missing candidate text. Use these exact assertions:

```js
await assert.rejects(callWithStatus(401), { status: 401, code: 'GEMINI_KEY_INVALID' });
await assert.rejects(callWithStatus(403), { status: 403, code: 'GEMINI_ACCOUNT_RESTRICTED' });
await assert.rejects(callThatAborts(), { status: 504, code: 'AI_TIMEOUT' });
await assert.rejects(callWithPayload({ candidates: [] }), {
  status: 502, code: 'INVALID_AI_RESPONSE', message: 'Gemini 回覆格式不正確。',
});
```

Define `callWithStatus`, `callThatAborts` and `callWithPayload` in the test file as thin wrappers around `requestGeminiJson` with injected `fetchImpl`; no helper may read an error response body. Final command:

Run: `node --test tests/gemini-client.test.mjs`

Expected: PASS, at least 7 tests; no error contains `secret upstream body`.

- [ ] **Step 6: Refactor and commit**

```bash
git add src/gemini-client.mjs tests/gemini-client.test.mjs
git commit -m "feat: validate Gemini keys with safe errors"
```

---

### Task 4: Backend BYOK cutover

**Files:**
- Modify: `src/ai-service.mjs:1-25,458-472,530-545`
- Modify: `src/worker.mjs:1-70`
- Modify: `scripts/build.mjs:1-79`
- Modify: `tests/ai-service.test.mjs`
- Modify: `tests/worker.test.mjs`
- Modify: `tests/bundle-syntax.test.mjs:43-93`

**Interfaces:**
- Produces: provider-neutral `aiRequest`; Worker accepts `{ apiKey, ...serviceInput }` and never uses `env.GROQ_API_KEY`.

- [ ] **Step 1: Write and fail one screenshot model test**

```js
test('uses the free Gemini screenshot model', async () => {
  let model;
  await importCoursesFromScreenshot(validImport, {
    apiKey: 'user-key', catalog: [], nccuSearch: async () => [],
    aiRequest: async (request) => {
      model = request.model;
      return '{"recognizedCourses":[]}';
    },
  });
  assert.equal(model, 'gemini-3.1-flash-lite');
});
```

Run: `node --test --test-name-pattern="free Gemini screenshot" tests/ai-service.test.mjs`

Expected: FAIL.

- [ ] **Step 2: Switch screenshot service to Gemini**

Import Gemini constants and `requestGeminiJson`; replace `groqRequest` with `aiRequest = requestGeminiJson`; pass `model: GEMINI_SCREENSHOT_MODEL`. Keep prompts and official NCCU lookup unchanged.

Run the named test again. Expected: PASS.

- [ ] **Step 3: Write and fail one recommendation model test**

Use an existing three-plan fixture, inject `aiRequest`, capture `request.model`, and assert `gemini-3.5-flash` while existing minimum-credit assertions remain true.

Run: `node --test --test-name-pattern="free Gemini recommendation" tests/ai-service.test.mjs`

Expected: FAIL.

- [ ] **Step 4: Switch recommendation service and verify all rules**

Change line 534 to `const aiRequest = dependencies.aiRequest || requestGeminiJson;`, change the first argument on line 537 from `groqRequest` to `aiRequest`, and insert `model: GEMINI_RECOMMENDATION_MODEL` immediately after `apiKey`. Keep the system and user messages currently on lines 542-545 byte-for-byte. Keep the parser callback exactly `(content) => parseConflictFreePlans(content, eligibleCourses, request.lockedCourseIds)` and attempt count `1`.

Mechanically rename injected `groqRequest` test dependencies to `aiRequest`; do not change fixtures or deterministic expectations.

Run: `node --test tests/ai-service.test.mjs`

Expected: PASS including conflict, language, maximum-credit and minimum-credit tests.

- [ ] **Step 5: Write and fail one Worker Key-boundary test**

```js
test('removes the user key from service input', async () => {
  let captured;
  const worker = createWorker({
    html: '<h1>ok</h1>',
    importService: async (input, deps) => {
      captured = { input, deps };
      return { importedCourses: [], duplicates: [], pendingCourses: [], warnings: [] };
    },
  });
  await worker.fetch(new Request('http://local/api/ai/import-courses', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey: 'user-key', imageDataUrl: 'data:image/png;base64,QQ==', term: '115-1' }),
  }), { GROQ_API_KEY: 'must-not-be-used' });
  assert.equal(captured.deps.apiKey, 'user-key');
  assert.equal('apiKey' in captured.input, false);
});
```

Run: `node --test --test-name-pattern="removes the user key" tests/worker.test.mjs`

Expected: FAIL.

- [ ] **Step 6: Implement the Worker boundary and validation route**

```js
function takeUserApiKey(input) {
  const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : '';
  if (!apiKey) {
    const error = new Error('請先設定自己的 Gemini API Key。');
    error.status = 400;
    error.code = 'GEMINI_KEY_REQUIRED';
    throw error;
  }
  const serviceInput = { ...input };
  delete serviceInput.apiKey;
  return { apiKey, serviceInput };
}
```

Inject `validateKey = validateGeminiKey` into `createWorker`. Add `/api/ai/validate-key`; use `takeUserApiKey` for all three AI POST routes; never read `env.GROQ_API_KEY`.

- [ ] **Step 7: Add Worker cases one vertical slice at a time**

Add and individually pass: validation success, missing Key `400 GEMINI_KEY_REQUIRED`, safe 429, and `cache-control: private, no-store`.

Run: `node --test tests/worker.test.mjs`

Expected: PASS; no test relies on a server Groq secret.

- [ ] **Step 8: Update server bundle**

Read and concatenate `src/gemini-client.mjs` before `ai-service.mjs`. Remove `groqClient` from the generated server bundle, while retaining its historical source/tests. Update bundle fake response to Gemini `candidates[].content.parts[].text` and send a user `apiKey` in request body.

Run: `node --test tests/bundle-syntax.test.mjs && npm run lint`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/ai-service.mjs src/worker.mjs scripts/build.mjs tests/ai-service.test.mjs tests/worker.test.mjs tests/bundle-syntax.test.mjs
git commit -m "feat: route AI through user Gemini keys"
```

---

### Task 5: Accessible first-open onboarding

**Files:**
- Modify: `src/index.html:14-32,52-84,122-128`
- Modify: `src/styles.css:1-245`
- Modify: `tests/rendered-html.test.mjs:1-215`

**Interfaces:**
- Produces DOM IDs: `api-key-status-button`, `api-key-dialog`, `api-key-form`, `api-key-input`, `api-key-reveal`, `api-key-status`, `api-key-skip`, `api-key-clear`, `open-api-key-help`.

- [ ] **Step 1: Write one failing semantic UI test**

```js
test('renders an accessible Gemini API key onboarding dialog', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="api-key-status-button"/);
  assert.match(html, /<dialog id="api-key-dialog"[^>]*aria-labelledby="api-key-title"/);
  assert.match(html, /id="api-key-input"[^>]*type="password"[^>]*autocomplete="off"/);
  assert.match(html, /id="api-key-reveal"[^>]*aria-pressed="false"/);
  assert.match(html, /href="https:\/\/aistudio\.google\.com\/app\/apikey"[^>]*target="_blank"/);
  assert.match(html, /Google Assistant[^<]*不等於 Gemini API/);
  assert.match(html, /Key 僅供本分頁使用，關閉或重新整理即清除/);
  assert.match(html, /先使用一般排課功能/);
});
```

- [ ] **Step 2: Verify Red**

Run: `npm run build && node --test --test-name-pattern="accessible Gemini API key" tests/rendered-html.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Add semantic dialog and status entry**

Add a header status button and a `<dialog>` containing: three numbered steps, official AI Studio link with `rel="noopener noreferrer"`, password input, reveal button, privacy/free-tier note, live status, submit, skip, clear and close controls. Add compact help buttons in both AI sections.

Exact copy:

- Title: `讓 AI 使用你自己的免費額度`
- Difference: `Google Assistant／Gemini App 不等於 Gemini API；一般排課不需要 Key。`
- Safety: `Key 僅供本分頁使用，關閉或重新整理即清除。`
- Billing: `網站不要求啟用付費帳務。`

- [ ] **Step 4: Style with existing tokens**

Implement warm translucent backdrop, paper card, blue/violet/sun accents, 44px controls, visible `:focus-visible`, responsive single-column layout, and disabled motion under `prefers-reduced-motion`. Do not add mint or cyan.

- [ ] **Step 5: Verify Green and commit**

Run: `npm run build && node --test tests/rendered-html.test.mjs && npm run lint`

Expected: PASS.

```bash
git add src/index.html src/styles.css tests/rendered-html.test.mjs
git commit -m "feat: add Gemini key onboarding shell"
```

---

### Task 6: Onboarding and Key controls

**Files:**
- Modify: `src/app.mjs:1-31,689-863`
- Modify: `scripts/build.mjs:5-60`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/bundle-syntax.test.mjs:1-38`

**Interfaces:**
- Produces: `openApiKeyDialog({ showFullGuide })`, `renderApiKeyState()`, `requireApiKeyForAi(statusElement)`.

- [ ] **Step 1: Write one failing first-open test**

Assert the built HTML contains `API_ONBOARDING_SEEN_KEY = 'sunbreak:api-onboarding-seen:v1'`, reads/writes only that flag in `localStorage`, calls `showModal()`, and contains no `sessionStorage` or Key persistence call.

Run: `npm run build && node --test --test-name-pattern="full API key onboarding" tests/rendered-html.test.mjs`

Expected: FAIL.

- [ ] **Step 2: Bundle Key session and implement first-open state**

Wrap `createApiKeySession` and `validateAndStoreApiKey` before `app.mjs`. In `app.mjs`, create one session, safe read/write helpers for only the onboarding-seen flag, `openApiKeyDialog`, and `renderApiKeyState`. First visit opens full guide; later no-Key visits show compact setup only when AI is used.

Run the named test again. Expected: PASS.

- [ ] **Step 3: Write one failing validation interaction test**

Assert form submit calls `validateAndStoreApiKey`, clears `input.value`, resets input type and reveal state, marks guide seen, updates to `本分頁已連線`, and closes dialog only after success.

Run: `npm run build && node --test --test-name-pattern="validates and clears" tests/rendered-html.test.mjs`

Expected: FAIL.

- [ ] **Step 4: Implement submit, reveal, replace and clear**

On success, clear the DOM input and close. On error, show safe message and keep session empty. Reveal toggles `password`/`text` and `aria-pressed`. Clear calls `apiKeySession.clearKey()`, empties the field and updates all gates. Status button opens compact setup; help opens full guide.

- [ ] **Step 5: Refactor and verify**

Run: `node --test tests/api-key-session.test.mjs tests/bundle-syntax.test.mjs && npm run build && node --test tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app.mjs scripts/build.mjs tests/rendered-html.test.mjs tests/bundle-syntax.test.mjs
git commit -m "feat: manage Gemini keys per browser tab"
```

---

### Task 7: Gate and authenticate both AI flows

**Files:**
- Modify: `src/app.mjs:689-734,758-863`
- Modify: `src/index.html:71-84,122-128`
- Modify: `tests/rendered-html.test.mjs:120-215,280-300`

**Interfaces:**
- No AI fetch occurs without a Key; each AI POST includes `apiKey` in its body.

- [ ] **Step 1: Write and fail one advisor gate test**

Assert `requireApiKeyForAi(status)` executes before disabling submit; `if (!apiKey) return`; recommendation JSON includes `apiKey`.

Run: `npm run build && node --test --test-name-pattern="blocks recommendations" tests/rendered-html.test.mjs`

Expected: FAIL.

- [ ] **Step 2: Implement and pass the advisor gate**

```js
function requireApiKeyForAi(statusElement) {
  const apiKey = apiKeySession.getKey();
  if (apiKey) return apiKey;
  statusElement.textContent = '請先貼上自己的 Gemini API Key，再使用 AI 功能。';
  openApiKeyDialog({ showFullGuide: false });
  return null;
}
```

Add `apiKey` as the first recommendation body property.

- [ ] **Step 3: Write and fail one screenshot gate test**

Assert the click handler checks Key before `readFileAsDataUrl`, returns when absent, and includes `{ apiKey, imageDataUrl, term: '115-1' }`.

Run: `npm run build && node --test --test-name-pattern="blocks screenshot import" tests/rendered-html.test.mjs`

Expected: FAIL.

- [ ] **Step 4: Implement screenshot gate and Gemini copy**

Update privacy copy to Gemini, the user's Key, no server persistence, official NCCU validation, and free-tier models. Remove every user-facing `傳送給 Groq` string.

- [ ] **Step 5: Verify and commit**

Run: `npm run build && node --test tests/rendered-html.test.mjs`

Expected: PASS; no old Groq privacy copy.

```bash
git add src/app.mjs src/index.html tests/rendered-html.test.mjs
git commit -m "feat: require user keys for AI workflows"
```

---

### Task 8: CSP, live contract and docs

**Files:**
- Modify: `scripts/build.mjs:1-80`
- Modify: `src/worker.mjs:3-9,28-44`
- Modify: `tests/bundle-syntax.test.mjs`
- Create: `tests/gemini-live-contract.test.mjs`
- Modify: `package.json:10-16`
- Modify: `README.md:1-27`

- [ ] **Step 1: Write one failing CSP test**

```js
test('serves a restrictive hash-based script CSP', async () => {
  const response = await worker.fetch(new Request('http://localhost/'));
  const csp = response.headers.get('content-security-policy') || '';
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'sha256-[A-Za-z0-9+/=]+'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
});
```

- [ ] **Step 2: Verify Red, generate hash, verify Green**

In build script, SHA-256 hash the finished inline browser script. Pass a policy containing `default-src 'none'`, hash-only `script-src`, `connect-src 'self'`, `img-src 'self' data: blob:`, `style-src 'unsafe-inline'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'` into `createWorker`; serve it only on HTML.

Run: `npm run build && node --test --test-name-pattern="hash-based script CSP" tests/bundle-syntax.test.mjs`

Expected: PASS.

- [ ] **Step 3: Add the real Gemini contract**

Create conditional tests using `process.env.GEMINI_API_KEY` for: metadata validation, small JSON text on `gemini-3.5-flash`, and one-pixel inline image on `gemini-3.1-flash-lite`. Tests must skip without a Key and never print Key, headers or full image.

Register:

```json
"test:contract:gemini": "node --test tests/gemini-live-contract.test.mjs"
```

- [ ] **Step 4: Update README and lint**

Document Assistant/App versus API, AI Studio link, per-tab lifetime, per-request Worker proxy, reload clearing, free-tier models, no billing requirement, and secure `GEMINI_API_KEY` contract command. Add both new source modules to `lint`.

- [ ] **Step 5: Run security checks**

Run:

```bash
npm run test:contract:gemini
npm run build
node --test tests/bundle-syntax.test.mjs
rg -n "gsk_[A-Za-z0-9]+|AIza[A-Za-z0-9_-]+" dist src
```

Expected: live tests SKIP without a test Key; bundle tests PASS; `rg` returns no Key values.

- [ ] **Step 6: Commit**

```bash
git add scripts/build.mjs src/worker.mjs tests/bundle-syntax.test.mjs tests/gemini-live-contract.test.mjs package.json README.md
git commit -m "test: secure Gemini BYOK boundary"
```

---

### Task 9: Full verification and Chrome critical flows

**Files:**
- Create: `tests/browser/gemini-byok-critical-flows.md`

- [ ] **Step 1: Run automated verification**

```bash
npm run verify
npm run test:contract:gemini
```

Expected: unit, build, rendered HTML, lint and NCCU live contract PASS; Gemini tests SKIP if no Key is injected.

- [ ] **Step 2: Start local site**

Run: `PORT=4174 npm run dev`

Expected: `Local: http://127.0.0.1:4174/`; terminal never prints a request body or Key.

- [ ] **Step 3: Verify first-open and no-Key flows with Playwright CLI and Chrome**

Fresh context checklist:

1. Three-step dialog opens with focus in Key input.
2. AI Studio opens in a new tab.
3. Skip leaves course add/remove/lock, internship and manual events working.
4. Both AI actions open compact Key setup and send no AI request.
5. Invalid Key shows a specific safe error and never enters connected state.

- [ ] **Step 4: Verify Key controls and storage safety**

With a deterministic validation fake or interactively supplied real Key:

1. Connected state appears; input DOM value clears.
2. Reveal toggles type and `aria-pressed`.
3. Replace and clear work.
4. Local Storage, Session Storage, IndexedDB and Cookies contain no Key or fragment.
5. Reload clears connected state and shows compact reminder instead of full tutorial.

- [ ] **Step 5: Verify both AI flows**

With a valid interactive Key when available:

1. Known NCCU screenshot produces imported／duplicate／pending groups.
2. Three displayed routes satisfy requested minimum credits.
3. Async courses do not occupy fixed cells.
4. Conflicting routes are hidden.
5. Qualification and official restrictions remain visible.
6. Clearing Key does not change schedule or candidates.

- [ ] **Step 6: Record and commit evidence**

Record date, browser, viewport, commands, each result, and any real-Key skip in `tests/browser/gemini-byok-critical-flows.md`.

```bash
git add tests/browser/gemini-byok-critical-flows.md
git commit -m "test: verify Gemini BYOK browser flows"
```

- [ ] **Step 7: Final clean-tree check**

```bash
npm run verify
git status --short
git log -10 --oneline
```

Expected: verification PASS, clean worktree, all commits remain on `feature/sunbreak-redesign`, Main untouched.
