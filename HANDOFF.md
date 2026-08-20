# HANDOFF — 政大排課系統（nccu-course-scheduler）

> 兩個貼上區塊：規劃找 🧠 Claude、實作找 🖐 Codex。由 Codex 於 2026-08-20 更新。
> 一句話現況：**701889001 的遠距／單次考試課表已修復並合併 `main`；待完成正式站發布驗收。**
> 專案全貌、網址、版本控制狀態一律看 `STATUS.md`，這裡不重複。

---

## 本輪做完了什麼（2026-08-20）

- 官方 115-1 課號 `701889001` 改按課綱呈現：平時為遠距非同步，不再占用每週二 78E；
  第 11 週上機考保留成單次提醒，不推測未公布的日期。
- 新匯入、官方刷新與既有瀏覽器資料都會修正；首次升級預設非同步，之後使用者主動改成
  實體／同步仍會保存，不會被刷新或重開頁面偷偷覆寫。
- TDD 與全套驗證：230 unit、110 rendered HTML、7 NCCU live contract、build、lint，
  全部 0 失敗；程式複核無 Critical，Important 項目均已修正。
- 1280×800 與 375×812 完成兩輪畫面自檢；真實流程確認固定課表 0 個該課區塊、
  單次考試提醒可見、重新載入保留出席選擇、console 0 error／warning。
- 最終截圖：`.screenshots/one-time-exam/round-4/desktop.png`、
  `.screenshots/one-time-exam/round-4/mobile.png`。

上一輪（2026-08-12）：API Key 防護、QA 與復原提示點擊問題已修復並發布 Sites 第 24 版。

---

## 上一輪做完了什麼（2026-07-26）

- **Bug A（官方備註「擋修 X」沒變成可勾選條件）** — 已修，並補上舊資料升級路徑：
  既有瀏覽器資料會在啟動時自動重建成先修條件，使用者不必刪課重加。
- **Bug B（AI 課綱比較回「格式不正確」）** — 可靠性已補齊：截斷會回明確錯誤、
  schema 失敗會帶回饋重試一次、課綱換行正規化、比較預算提高到 8,000 token。
- **追加：「僅供…修習」受眾限制** — 明確受眾限制現在會變成 required 條件。
- 完整驗證：210 unit、104 rendered HTML、build、lint、7 NCCU live contract、
  1 Gemini live contract 全部 0 失敗；正式站第 21 版已發布並線上驗收（HTTP 200、
  console 0 error）。

完整實作紀錄與驗收證據：`docs/history/HANDOFF-2026-07-26-bugfix.md`。

---

## ⚠️ 留下來的一個未結案項目

**Bug B 的根因沒有被真實呼叫重現。**

`tests/gemini-live-contract.test.mjs` 用兩門真實政大課程做端到端呼叫，修前修後
各跑一次**都通過**——也就是說，防護補齊了，但「回應被截斷」這個推測的主因
**沒有被真實 API 證實**。

意思是：如果使用者之後又遇到「AI 課程比較格式不正確」，不要假設已經修好了，
要拿當下的實際 `finishReason` 與錯誤訊息重新診斷。

---

## ▼ 貼給 🖐 Codex（照計畫實作）

這一輪沒有工單。有新工作時，先讀 `STATUS.md` 與這一輪指到的設計文件再動手。

Node/JS，無外部套件。指令：`npm run test:unit`、`npm test`（含 build 與 rendered HTML）、
`npm run lint`、`npm run test:contract:nccu`。
需要真實 Gemini 呼叫時：`node --env-file=.env.local --test tests/gemini-live-contract.test.mjs`
（Key 放專案根目錄 `.env.local`，已被 `.gitignore` 涵蓋，**不要進版控**）。

TDD 一次一個測試，紅 → 綠 → 重構，再進下一個。禁止先寫完所有測試再一次寫完所有實作。

---

## ▼ 貼給 🧠 Claude（討論／規劃／決策）

我要處理政大排課系統的後續。先讀 `STATUS.md`。

⚠️ 你是大腦、Codex 是手：**不要自己改 `src/` 或 `tests/`**，除非我明講「你直接做」。
你的產出是診斷、設計文件與 `HANDOFF.md` 工單。

我完全沒有程式背景，專有名詞第一次出現請先用白話解釋。

---

## 歷史

每一輪的完整實作紀錄與驗收證據放在 `docs/history/`，這份交接單只留當前這一輪
（上限 4 KB，由 `~/.claude/hooks/handoff-size-gate.mjs` 把關）。
