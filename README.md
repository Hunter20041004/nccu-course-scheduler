# 政大排課｜NCCU Course Scheduler

[![CI](https://github.com/Hunter20041004/nccu-course-scheduler/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Hunter20041004/nccu-course-scheduler/actions/workflows/ci.yml)

**[Share-safe Demo](https://hunter20041004.github.io/nccu-course-scheduler/)**
· **[Live Demo](https://nccu-internship-scheduler.abuzz-teal-2691.chatgpt.site)**

政大學生的實習友善排課系統。新訪客會從完全空白的個人工作區開始，再透過政大 115-1 課程庫搜尋、AI 截圖匯入或手動新增建立自己的候選清單。它把政大節次、課程資格、實習時段、非同步課程、個人行程與 AI 推薦整合在同一個課表工作台，讓使用者先檢查衝堂與條件，再做選課決策。

## Executive Summary

NCCU Course Scheduler is a public portfolio version of a real course-planning workflow for National Chengchi University students. It supports click-to-schedule course blocks, NCCU period-grid rendering, eligibility-condition tracking, internship availability planning, screenshot-based course imports, AI-assisted route recommendations, and phone-wallpaper schedule export.

The project is intentionally privacy-aware: users bring their own Gemini API key for AI features, the key stays in the current browser session only, and the server does not persist uploaded screenshots or planning prompts.

## 作品集重點

- **完整學生決策流程**：候選課程 → 資格檢查 → 課表排入 → 衝堂提醒 → 實習空檔評估。
- **空白且個人化的起點**：朋友第一次進站不會看到作者的課程；同一個網址、同一個瀏覽器會自動保留自己的候選清單與課表。
- **直接查詢官方課程**：可依課名、教師或九碼課號搜尋政大 115-1 公開課程，加入候選清單不需要 API Key。
- **政大語境建模**：使用政大節次 A/B/1/2/…/H 與週一到週日方格式課表。
- **AI 輔助但不盲信**：AI 可辨識備選清單截圖、產生三個推薦方案；系統仍會用本地規則過濾幻覺課程、衝堂方案與不合理學分配置。
- **可客製化資格條件**：從官方課程限制產生可勾選條件，也允許使用者新增自己的學程、系級或先修條件。
- **實習友善規劃**：支援自動找實習空檔，也支援固定幾天、幾點到幾點的實習時段。
- **作品集級安全邊界**：不提交 API key、不保存使用者金鑰、不長期保存原始截圖。
- **可驗證品質門檻**：unit tests、rendered HTML tests、NCCU live contract test 與 CI workflow。

## 60 秒 Demo

1. 打開 Share-safe Demo；新訪客的候選清單與課表都是空白的。
2. 到「匯入／新增」，直接搜尋政大 115-1 課程庫，也可用 AI 截圖辨識或手動新增課程、社團與個人行程。
3. 回到「候選課程」，點選課程加入左側政大方格式課表。
4. 切到「選課條件」，勾選自己符合的系級、學程、雙主修或先修限制。
5. 在「實習設定」調整希望保留的實習天數與時段，觀察左側保留區塊。
6. 到「AI 推薦」輸入背景、目標與偏好，產生三個不衝堂的推薦方案。
7. 排好後使用「匯出手機桌布」，輸出雨後日光 × 輕夢核風格課表圖。

排課資料只保存在瀏覽器本機；使用同一個網址與同一個瀏覽器再次開啟時會接續上次進度。換裝置、換瀏覽器、清除網站資料，或改用另一個部署網址，會得到新的空白工作區。

## 架構摘要

```text
src/index.html              單頁應用 HTML、教學中心與主要介面骨架
src/styles.css              Sunbreak / 輕夢核視覺系統與 responsive layout
src/app.mjs                 前端狀態、課表互動、匯入、AI 推薦與匯出桌布
src/course-data.mjs         舊有儲存資料與截圖核對所需的課程 metadata（不會預載給新訪客）
src/planner-core.mjs        選課、鎖定、刪除、衝堂與實習空檔核心邏輯
src/eligibility-conditions.mjs  課程資格條件正規化
src/nccu-periods.mjs        政大節次與時間區間
src/nccu-course-adapter.mjs 政大公開課程查詢資料轉換
src/ai-service.mjs          AI 截圖匯入與推薦方案服務
src/gemini-client.mjs       Gemini BYOK request / validation client
src/worker.mjs              Cloudflare Worker-compatible HTTP entrypoint
tests/                      Unit、rendered HTML、contract 與 safety tests
scripts/build.mjs           無外部相依的 build pipeline
```

成品是 `dist/server/index.js` 的 Cloudflare Worker-compatible bundle，不依賴外部 npm 套件即可部署。

## AI 與資料安全邊界

- AI 功能使用 **Bring Your Own Key**：使用者貼上自己的 Gemini API Key。
- API Key 只保存在目前分頁的記憶體中；重新整理或關閉分頁即清除。
- Gemini key 會送到本服務的 API endpoint 進行單次請求代理，不寫入 repository、localStorage、sessionStorage 或伺服器長期儲存。
- 截圖匯入會把使用者選取的課程清單截圖送到 Gemini 辨識；辨識後仍以政大 115-1 公開課程資料核對。
- AI 推薦結果會被本地規則重新檢查：不存在的課程、不可非同步卻被標成非同步、以及衝堂方案都會被修正或排除。
- 本 repo 不包含任何真實 API key、學生個資、選課帳密或私有課程資料。

## 本機開發

需求：Node.js 22.13 或更新版本。

```bash
git clone https://github.com/Hunter20041004/nccu-course-scheduler.git
cd nccu-course-scheduler
npm install
npm run dev
```

開啟終端顯示的本機網址即可使用。政大 115-1 課程搜尋、一般排課、手動新增、衝堂檢查與桌布匯出都不需要 key；只有 AI 截圖辨識與 AI 推薦需要使用者在介面中貼上自己的 Gemini API Key。

## 驗證

```bash
npm run verify
```

`npm run verify` 會執行：

- Node test runner unit tests；
- production build；
- rendered HTML / browser bundle contract tests；
- syntax checks；
- 政大公開課程查詢 live contract test。

若需要驗證舊版 Groq adapter 的真實邊界，可在安全環境注入 `GROQ_API_KEY` 後執行：

```bash
npm run test:contract:groq
```

## 部署

GitHub Pages 靜態版適合傳給朋友測試一般排課流程，較不容易被 Instagram／LINE 內建瀏覽器攔截：

[https://hunter20041004.github.io/nccu-course-scheduler/](https://hunter20041004.github.io/nccu-course-scheduler/)

完整 Worker demo 部署於 OpenAI Sites：

[https://nccu-internship-scheduler.abuzz-teal-2691.chatgpt.site](https://nccu-internship-scheduler.abuzz-teal-2691.chatgpt.site)

部署平台只保存網站版本與必要 runtime 設定；使用者自己的 Gemini API Key 不由網站長期保存。

## Limitations

- 政大課程資料、模型可用性與免費額度可能變動；Live Demo 反映部署時的公開課程資料與目前可用模型。
- 政大 115-1 課程庫搜尋使用政大公開查詢資料；課程異動仍應回正式選課系統確認。
- AI 推薦是決策輔助，不保證符合每位學生的畢業門檻、學分抵免或系所人工審核。
- GitHub Pages 版是靜態備用網址，適合測試排課、條件、實習設定與桌布匯出；需要 Worker API 的 AI 匯入／推薦功能請使用 Live Demo 或改用自有後端部署。
- 使用者仍應以政大正式選課系統與系所公告作為最終依據。

## License

Author-owned source code and documentation in this repository are licensed under the [MIT License](LICENSE). National Chengchi University course data, third-party model services, and user-supplied screenshots remain subject to their respective owners' terms.
