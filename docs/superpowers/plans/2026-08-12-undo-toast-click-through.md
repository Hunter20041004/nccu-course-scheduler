# Undo Toast Click-Through Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 15 秒復原提示的文字區不再阻擋後方課程操作，同時保留可點擊的「復原」按鈕。

**Architecture:** 維持既有 `capturePlannerUndo()`、15 秒計時器與 `undo.restore()` 資料流程，只在既有 CSS 上縮小可接收點擊的範圍。用 rendered HTML 回歸測試鎖定 CSS 契約，再用真實瀏覽器的 `elementFromPoint()` 驗證文字區會穿透、復原按鈕仍是點擊目標。

**Tech Stack:** Node.js 內建 test runner、既有靜態 HTML/CSS/JavaScript、`playwright-cli`。

## Global Constraints

- 不新增套件、外部服務、資料欄位或 API。
- 不移動提示、不改提示文案、不改 15 秒期限、不改排課與 AI 資料流程。
- 一次只做一個 TDD 垂直切片：先看測試因缺少 click-through CSS 失敗，再寫最小 CSS 讓它通過。
- 保留「復原」按鈕至少 44px 的操作尺寸、鍵盤焦點與既有視覺樣式。
- 桌機 1280×800、手機 375×812 各跑兩輪截圖自檢；最終正式站沿用原網址。

---

### Task 1: 讓復原提示只在按鈕區接收點擊

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: 既有 `.planner-undo-toast` 容器與 `.planner-undo-toast button` 選擇器。
- Produces: CSS 契約——容器 `pointer-events: none`，按鈕 `pointer-events: auto`。

- [ ] **Step 1: 寫入單一失敗測試**

在 `offers a fifteen-second undo after destructive planner changes` 測試後加入：

```js
test('lets clicks pass through the undo toast except its restore button', async () => {
  const html = await (await render()).text();

  assert.match(html, /\.planner-undo-toast\s*\{[^}]*pointer-events:\s*none/);
  assert.match(html, /\.planner-undo-toast button\s*\{[^}]*pointer-events:\s*auto/);
});
```

- [ ] **Step 2: 執行單一測試並確認紅燈原因正確**

Run:

```bash
npm run build && node --test --test-name-pattern="lets clicks pass through the undo toast except its restore button" tests/rendered-html.test.mjs
```

Expected: 只有新測試失敗，訊息指出 rendered HTML 找不到 `pointer-events: none`；這證明測試能抓到目前的遮擋行為。

- [ ] **Step 3: 寫入最小 CSS 修正**

把既有兩條規則改成：

```css
.planner-undo-toast { position: fixed; z-index: 80; right: 20px; bottom: 20px; display: flex; max-width: min(420px, calc(100vw - 32px)); align-items: center; gap: 18px; border: 1px solid #403B49; border-radius: var(--radius-control); background: var(--ink); color: #fff; padding: 10px 12px 10px 16px; box-shadow: 0 18px 50px rgb(33 31 38 / 24%); font-size: .78rem; font-weight: 750; pointer-events: none; }
.planner-undo-toast button { flex: 0 0 auto; border: 1px solid rgb(255 255 255 / 38%); border-radius: 6px; background: transparent; color: #fff; padding: 0 12px; font-weight: 850; cursor: pointer; pointer-events: auto; }
```

- [ ] **Step 4: 重新執行單一測試並確認綠燈**

Run:

```bash
npm run build && node --test --test-name-pattern="lets clicks pass through the undo toast except its restore button" tests/rendered-html.test.mjs
```

Expected: 新測試通過，0 failure。

- [ ] **Step 5: 檢查差異並提交 TDD 切片**

Run:

```bash
git diff --check
git diff -- tests/rendered-html.test.mjs src/styles.css
git add tests/rendered-html.test.mjs src/styles.css
git commit -m "fix: let clicks pass through undo toast"
```

Expected: 只有測試與兩個 CSS 屬性變更進入提交。

---

### Task 2: 從學生視角驗證桌機與手機互動

**Files:**
- Modify: `.gitignore` only if `.screenshots/` is not already ignored
- Create locally, ignored: `.screenshots/undo-toast/round-1/desktop.png`
- Create locally, ignored: `.screenshots/undo-toast/round-1/mobile.png`
- Create locally, ignored: `.screenshots/undo-toast/round-2/desktop.png`
- Create locally, ignored: `.screenshots/undo-toast/round-2/mobile.png`

**Interfaces:**
- Consumes: 本機建置後的完整排課網站、手動新增課程、清空課表與 15 秒復原流程。
- Produces: 真實點擊命中測試、復原資料驗證與兩輪響應式截圖證據。

- [ ] **Step 1: 確認截圖目錄不會進版控並啟動本機網站**

Run:

```bash
git check-ignore -q .screenshots
npm run dev
```

Expected: `.screenshots` 已被忽略；本機網站回報可開啟的 localhost URL。

- [ ] **Step 2: 桌機第一輪——建立資料、顯示提示並驗證命中區**

使用 `playwright-cli` 在 1280×800 開啟本機網站，直接開始使用，新增一門 3 學分手動課程，再從「更多操作」清空課表並接受確認。提示顯示後執行以下瀏覽器判斷：

```js
const toast = document.querySelector('#planner-undo-toast');
const button = document.querySelector('#restore-planner-change');
const toastBox = toast.getBoundingClientRect();
const buttonBox = button.getBoundingClientRect();
const textX = toastBox.left + 8;
const textY = toastBox.top + toastBox.height / 2;
const textHit = document.elementFromPoint(textX, textY);
const buttonHit = document.elementFromPoint(
  buttonBox.left + buttonBox.width / 2,
  buttonBox.top + buttonBox.height / 2,
);
if (toast.contains(textHit)) throw new Error('Undo toast text still blocks the page');
if (buttonHit !== button && !button.contains(buttonHit)) throw new Error('Restore button is not clickable');
```

接著點擊「復原」，確認摘要回到 3 學分。輸出 `.screenshots/undo-toast/round-1/desktop.png`。

- [ ] **Step 3: 手機第一輪——重跑相同互動並檢查破版**

把 viewport 改為 375×812，重跑清空、命中區與復原，並執行：

```js
const viewportWidth = window.innerWidth;
const pageWidth = document.documentElement.scrollWidth;
if (pageWidth > viewportWidth) throw new Error(`Horizontal overflow: ${pageWidth} > ${viewportWidth}`);
```

輸出 `.screenshots/undo-toast/round-1/mobile.png`。

- [ ] **Step 4: 第一輪自評並只修正不合格項目**

逐項記錄：層次、留白、字體、配色、對齊、375px 響應式、hover/focus/空白/載入/錯誤狀態、微動效。這次不更改視覺；若任何項目不合格，只修與本次提示互動直接相關的問題，然後重新跑 Task 1 單一測試。

- [ ] **Step 5: 桌機與手機第二輪**

在 1280×800 與 375×812 各重跑一次 Step 2–3 的命中區、復原與無橫向捲動驗證，輸出 round-2 兩張截圖。舊截圖不再讀取；第二輪逐項確認八項視覺檢查全部通過。

---

### Task 3: 完整驗證、紀錄、整合與正式部署

**Files:**
- Modify: `HANDOFF.md` only if the existing user edits can be preserved without staging unrelated content
- Reference: `docs/superpowers/specs/2026-08-12-undo-toast-click-through-design.md`
- Reference: `docs/superpowers/plans/2026-08-12-undo-toast-click-through.md`

**Interfaces:**
- Consumes: Task 1 的 CSS 修正、Task 2 的真實瀏覽器證據。
- Produces: 全測結果、可追溯提交、遠端 `main` 與原正式網址上的修正版。

- [ ] **Step 1: 在功能分支跑完整驗證**

Run:

```bash
npm run verify
```

Expected: unit、build、rendered HTML、lint、NCCU live contract 全部 0 failure。

- [ ] **Step 2: 確認工作樹與提交內容**

Run:

```bash
git status --short
git log -3 --oneline
git diff main...HEAD --check
git diff main...HEAD --stat
```

Expected: 功能提交只包含 `tests/rendered-html.test.mjs` 與 `src/styles.css`；設計與計畫文件各自可追溯，使用者原本的 `HANDOFF.md` 與 `docs/history/` 內容未被納入功能提交。

- [ ] **Step 3: 整合回 main 並在 main 重跑完整驗證**

依專案全域規則把功能分支合併回 `main`，保留使用者原本未提交內容；若發生衝突立即停止。合併後執行：

```bash
npm run verify
```

Expected: main 全部 0 failure。

- [ ] **Step 4: 推送與部署原正式站**

Run:

```bash
git push origin main
```

接著沿用專案既有 Sites 發布流程部署 `https://nccu-course-planner-1151.huntertseng.chatgpt.site/`，不得建立新的重複站點。

- [ ] **Step 5: 正式站使用者視角驗收**

在正式網址重跑 1280×800 與 375×812 的清空、提示命中區、復原與無橫向捲動檢查；確認 HTTP 200、console 0 error。只有這些證據全部通過後，才回報可以發文。
