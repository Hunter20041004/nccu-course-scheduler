# HANDOFF — 政大排課系統（nccu-course-scheduler）

> 兩個貼上區塊：規劃找 🧠 Claude、實作找 🖐 Codex。由 Claude 於 2026-07-26 更新。
> 一句話現況：**正式站已上線，但使用者回報兩個 bug；根因已查清並寫成設計文件，等 Codex 實作。**

---
## ▼ 貼給 🧠 Claude（討論／規劃／決策）

我要處理政大排課系統的後續。先讀 `STATUS.md` 與
`docs/specs/2026-07-26-blocked-prerequisites-and-ai-comparison-design.md`。

⚠️ 你是大腦、Codex 是手：**不要自己改 `src/` 或 `tests/`**，除非我明講「你直接做」。
你的產出是診斷、設計文件與 `HANDOFF.md` 工單。

我完全沒有程式背景，專有名詞第一次出現請先用白話解釋。

---
## ▼ 貼給 🖐 Codex（照計畫實作）

我要修兩個 bug。**先完整讀
`docs/specs/2026-07-26-blocked-prerequisites-and-ai-comparison-design.md`**——
根因、真實資料的所有變化型、以及不能誤抓的反例都在裡面，不要跳過。

Node/JS，無外部套件。指令：`npm run test:unit`、`npm test`（含 build 與 rendered HTML）、
`npm run lint`、`npm run test:contract:nccu`。

照下面的 TDD 垂直切片做：**一次一個測試，紅 → 綠 → 重構，再進下一個**。
禁止先寫完所有測試再一次寫完所有實作。

---

### 🐞 Bug A：官方備註「擋修 X」沒有變成可勾選的條件

使用者加入「高級會計學（一）」（`303033011`），備註明明寫「擋修中會(二)。」，
修課資格卻顯示「條件符合」，條件區也沒有「我修過中會(二)」可勾。
影響 13 門真實課程（會計系必修鏈幾乎整條）。

主要檔案：`src/nccu-course-notes.mjs` 的 `classifyOfficialNotes()`。

#### 切片 A1 — 單一擋修課變成條件
- **測試**（`tests/nccu-course-notes.test.mjs`）：`restrictionText: '擋修中會(二)。'`
  → `eligibilityRules` 恰好一條，`conditionId` 為 `prerequisite-course:中會(二)`、
  `conditionLabel` 為 `我修過中會(二)`、`enforcement` 為 `required`。
- **實作**：在分類鏈最前面加擋修抽取。設計文件「建議修法」第 1、3、4、5 點。
- ⚠️ **注意**：這支檔案沒有 `unique` helper，
  **不要新增名為 `unique` 的頂層變數**——`src/eligibility-conditions.mjs` 已經有一個，
  bundle 會把所有模組併成一支檔案，重複宣告會讓 `tests/bundle-syntax.test.mjs` 直接爆。
  用 `[...new Set(...)]` 就好。

#### 切片 A2 — 一句擋修多門課
- **測試**：`'會二甲，擋修初會(一)、初會（二），擋修者請勿選修，不簽同意修課單。'`
  → 產生**兩條**規則：`prerequisite-course:初會(一)` 與 `prerequisite-course:初會(二)`。
  （同時驗證全形括號正規化，以及「擋修者」沒有被誤抓成課名。）
- **實作**：用 `、` 切多門課，`，` `,` `。` `；` `;` 當結束符；全形括號轉半形。

#### 切片 A3 — 排除講流程的「擋修」
- **測試**：`'如被擋修，請於加退選結束前將證明寄給助教，設定允許擋修後，方得於系統上選課'`
  → 不產生任何 `prerequisite-course:` 開頭的規則。
- **實作**：排除清單（設計文件第 2 點）。

#### 切片 A4 — 不弄丟同一句裡的其他備註
- **測試**：`'擋修初會（二）,英語授課，ETP優先。'`
  → 既產生擋修條件，原本這句話的既有分類行為也不變。
- **實作**：抽完擋修**不要 return**，繼續跑既有分類鏈。

#### A 完成後的驗收
- `npm run test:unit` 全綠（既有 200 個測試一個都不能倒）。
- 手動確認 `303033011` 在勾選前是「資格待確認」、勾選後「條件符合」、
  回答沒修過則「無法加入」。
- **截圖自檢**：這會讓 13 門會計課從綠色「條件符合」變成黃色「資格待確認」。
  這是正確的，但請照全域規則跑桌機 1280×800 ＋ 手機 375×812 兩輪截圖，
  確認待確認狀態不會被誤讀成壞掉，並把最終截圖附給使用者。

---

### 🐞 Bug B：AI 課綱比較回「AI 課程比較格式不正確」

主因：`src/ai-service.mjs` 第 81 行 `maxCompletionTokens: 2_600` 對思考型模型太小，
回覆被中途截斷。詳見設計文件「Bug B」整節。

#### 切片 B1 — 截斷要講人話（先做這個，它同時是 B4 的診斷工具）
- **測試**（`tests/gemini-client.test.mjs`）：`fetchImpl` 回
  `{ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"summary":"被截斷' }] } }] }`
  → `requestGeminiJson` 丟出 `status: 502`、`code: 'AI_RESPONSE_TRUNCATED'`、
  訊息「AI 回覆長度超出上限而被截斷，請稍後重試。」
- **實作**：`src/gemini-client.mjs` 讀 `candidates[0].finishReason`，
  在取 `content` 之前就攔下來。

#### 切片 B2 — 驗證失敗要重試一次
- **測試**（`tests/ai-service.test.mjs`）：mock 的 `aiRequest` 第一次回半截 JSON、
  第二次回合法比較 JSON → `compareCourseSyllabi` 成功回傳，且 `aiRequest` 被呼叫 **2 次**，
  第二次的最後一則 system message 含「未通過驗證」。
- **實作**：`src/ai-service.mjs` 第 92 行 `), 1);` 改成 `), 2);`。
  （`requestWithSchemaRetries` 的重試邏輯本來就寫好了，只是被 `1` 關掉。）

#### 切片 B3 — 課綱不要塞兩成空白給 AI
- **測試**（`tests/nccu-syllabus.test.mjs`）：含 `\r\n\r\n\r\n` 連續 CRLF 的 HTML
  → `extractSyllabusText` 輸出不含 `\r`，連續空行收合成單一 `\n`。
- **實作**：`src/nccu-syllabus.mjs` 在既有空白收合**之前**加 `.replace(/\r\n?/g, '\n')`。
- 參考數字：真實課綱 5,886 → 4,401 字元、7,466 → 5,998 字元。

#### 切片 B4 — 放大預算並壓住輸出長度（根因修復）
- 這段沒有好寫的單元測試（斷言一個常數等於 8000 沒有意義），**改用真實驗證**：
  1. `src/ai-service.mjs` 第 81 行 `2_600` → `8_000`。
  2. 比較的 system prompt 補上字數限制，比照同檔 `recommendCoursePlans()` 的寫法：
     summary 100 字內、sharedTopics 最多 5 項每項 15 字內、
     每門課 focus／uniqueValue／assessment／workload 各 50 字內、
     recommendation.reason 100 字內、personalized.reason 60 字內、
     limitations 最多 3 項每項 40 字內。
  3. **必要的真實驗證**（見下方「⚠️ 這件事一定要做」）。

#### B 完成後的驗收
- `npm test`、`npm run lint`、`npm run test:contract:nccu` 全綠。

---

### ⚠️ 這件事一定要做：Bug B 的真實邊界驗證

**Bug B 的根因判斷還沒對真實 Gemini API 驗證過。**
現有測試全是 mock，mock 永遠回合法 JSON，所以這個 bug 在單元測試裡永遠不會出現——
這正是全域規則講的「mock 邊界」陷阱。

請這樣驗證（**不要把 Key 寫進任何會進版控的檔案**）：

1. 請使用者把自己的 Gemini API Key 放進**專案根目錄的 `.env.local`**
   （先確認 `.gitignore` 有涵蓋，沒有的話先加）：`GEMINI_API_KEY=...`
2. 比照 `tests/groq-live-contract.test.mjs` 的寫法，新增
   `tests/gemini-live-contract.test.mjs`：沒有 `process.env.GEMINI_API_KEY` 時 skip，
   有的話用**兩門真實政大課程**（例如 `070394021` 人工智慧方法與工具、
   `783004001` 人工智慧程式設計）真的跑一次 `compareCourseSyllabi`，
   斷言回傳通過 schema 驗證。
3. 用 `node --env-file=.env.local --test tests/gemini-live-contract.test.mjs` 跑。
4. **修好前先跑一次**：如果它以 `AI_RESPONSE_TRUNCATED` 失敗，
   就證實了截斷這個根因；如果是別的錯，**回報實際的 `finishReason` 與錯誤**，
   不要硬把測試改成會過——根因判斷可能要跟著修正。
5. 修好後再跑一次，確認會過。

---

## 本輪狀態（2026-07-26／Codex 實作）

- ✅ **Bug A 已修復，並補上舊資料升級路徑**：`classifyOfficialNotes()` 會把單門／多門「擋修」轉成
  `prerequisite-course:<課名>` 的 required 條件，統一全形括號並排除「擋修者」、
  「擋修程序」、「擋修後」等流程文字；同句的英語授課等既有分類仍會保留。
  2026-07-26 晚間依使用者正式站截圖發現，先前只修到新匯入課程；既有瀏覽器資料
  仍把「擋修中會(二)」留在 `informationNotes`。現在
  `sanitizeOfficialEligibilityRules()` 會在啟動時自動把這種政大舊資料重建成先修條件，
  不需使用者刪課重加。
- ✅ `303033011` 已用「修正前正式站的舊 localStorage 資料形狀」在真實瀏覽器驗收三種狀態：
  未回答為「資格待確認」、
  回答修過為「條件符合」、回答沒修過為「條件不符合」且無法加入。
- ✅ 待確認狀態使用既有黃色 `sun` 設計代幣；補修完成兩輪 1280×800 與 375×812
  截圖自檢，手機無橫向捲動。最終截圖：
  `.screenshots/legacy-blocked-prereq/round-2/desktop.png`、
  `.screenshots/legacy-blocked-prereq/round-2/mobile.png`。
- ✅ **Bug B 可靠性修復完成**：Gemini `MAX_TOKENS` 會回
  `AI_RESPONSE_TRUNCATED`；比較 schema 失敗會帶驗證回饋重試一次；課綱 CRLF
  會正規化；比較預算提高到 8,000 token，並限制各欄位篇幅。
- ✅ 新增 `tests/gemini-live-contract.test.mjs`，使用兩門真實政大課程端到端呼叫
  Gemini。修前與修後各跑一次都通過，因此**本次沒有重現截斷，也不能宣稱真實
  呼叫已證實 Claude 推測的主因**；診斷與防護仍已補齊。
- ✅ 補修後完整驗證：208 unit、104 rendered HTML、build、lint、6 NCCU live
  contract 全部 0 失敗；真實瀏覽器三態流程也全綠。
- ✅ 修正已合併至 `main` 並推送 GitHub；Sites 正式站已沿用原網址重新發布：
  `https://nccu-course-planner-1151.huntertseng.chatgpt.site/`。
- ✅ 正式站以修正前的舊 localStorage 高會資料完成線上驗收：HTTP 200、console
  0 error、高會顯示「資格待確認」，條件頁出現「我修過中會(二)」。
- ✅ **追加修復「僅供…修習」受眾限制**：使用者回報 `088E54011`
  「精進華語：中級一」的「僅供外籍交換生與外籍學位生修習」沒有進入選課條件。
  根因是分類器只認得「僅限…學生修讀」。現在新匯入課程會產生
  `official-restriction:<課號>` 條件「我是外籍交換生或外籍學位生」；舊
  localStorage 裡仍被歸為資訊備註的課程，也會在啟動時自動重建條件。
- ✅ 真實政大 115-1 API 已驗證現行課號 `088F54011`：明確受眾限制會成為一條
  required 條件；「學分不予採計」、第一堂出席與點名規則仍維持資訊備註。
- ✅ 已用修正前的舊資料形狀完成瀏覽器三態驗收：未回答為黃色「資格待確認」，
  回答不符合時課程停用，回答符合時恢復可選；console 0 error。
- ✅ 兩輪 1280×800 與 375×812 截圖自檢完成。第一輪發現手機截圖停在課表、
  無法作為條件流程證據；第二輪切到工具並把目標條件捲入畫面後，八項視覺檢查
  全部通過，手機無橫向捲動。最終截圖：
  `.screenshots/exclusive-audience/round-2/desktop.png`、
  `.screenshots/exclusive-audience/round-2/mobile.png`。
- ✅ 本次追加修復的完整驗證：210 unit、104 rendered HTML、build、lint、
  7 NCCU live contract 與 1 Gemini live contract 全部 0 失敗。
- ⏳ 待本輪收尾完成合併 `main`、推送及正式站重新部署。

---

## 上一輪（2026-07-26 稍早）：發布

- ✅ 已將本機 `HEAD`（`233227a`）儲存為 Sites 第 18 版，發布到原正式網址
  `https://nccu-course-planner-1151.huntertseng.chatgpt.site/`
- ✅ 發布前驗證通過：200 unit、103 rendered HTML、26 JS 語法檢查、6 NCCU live contract。
- ✅ 正式站 HTTP 200，console error 為 0。
