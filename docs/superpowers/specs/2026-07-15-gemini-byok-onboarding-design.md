# Gemini BYOK 首次引導與安全代理設計

日期：2026-07-15

狀態：已確認，待實作

範圍：政大 115-1 排課工具的 AI 金鑰設定、首次引導、Gemini 代理與錯誤處理

## 1. 背景

目前網站的截圖匯入與 AI 推薦由 Sites Worker 使用伺服器端 `GROQ_API_KEY` 呼叫 Groq。若讓朋友共用同一組金鑰，所有人會共享同一份免費額度，且金鑰濫用、額度耗盡與使用者隔離都由網站擁有者承擔。

本次改為 BYOK（Bring Your Own Key）：每位使用者自行到 Google AI Studio 申請 Gemini API Key。網站會在第一次開啟時提供申請教學，並讓使用者在需要 AI 功能時貼上自己的 Key。

Google Assistant 或 Gemini App 的使用權不等於 Gemini API 權限。使用者仍需用 Google 帳號接受 Gemini API 條款並建立 API Key；受學校或公司管理的帳號可能因 Workspace 政策無法建立或使用 Key。

## 2. 目標

- 第一次開啟網站時，以短流程教會沒有 API 經驗的使用者申請 Gemini API Key。
- 讓使用者安全地貼上、驗證、更換及清除自己的 Key。
- Key 僅存在目前分頁的 JavaScript 記憶體，重新整理或關閉分頁後立即消失。
- 一般排課功能不依賴 Key；使用者可略過設定，只在使用 AI 功能時補上。
- 只使用具有免費額度的 Gemini 模型；網站不要求使用者啟用 Google Cloud 付費帳務。
- 所有 Gemini 呼叫都經由本站 Worker 代理；前端不直接呼叫 Google。
- Worker 不持久化、不記錄、不回傳 Key 或含 Key 的上游錯誤資訊。
- 保留既有的課程官方資料核對、資格判斷、衝堂檢查、最低學分、非同步課程與實習時段驗證。

## 3. 非目標

- 不建立帳號、會員或跨裝置同步。
- 不把 Key 存入 `localStorage`、`sessionStorage`、IndexedDB、Cookie、資料庫或 Sites 環境變數。
- 不提供記住 Key、匯出 Key、分享 Key 或自動同步 Key。
- 不改變一般排課資料繼續使用 `localStorage` 的既有行為。
- 不在此階段支援 Gemini 以外的使用者自備模型供應商。
- 不移除既有 Groq 程式碼與測試，除非它阻礙 Gemini BYOK 的明確邊界；公開 AI 流程則不再依賴共用 Groq Key。

## 4. 採用方案與取捨

採用「分頁記憶體＋後端代理」。Key 只存於前端模組的記憶體狀態，每次 AI 請求隨 HTTPS request body 傳到 Worker。Worker 只在該次請求內使用 Key 呼叫 Gemini。

未採用方案：

- `sessionStorage`＋後端代理：重新整理後較方便，但同網域的惡意腳本或 XSS 可以讀取 Key。
- `localStorage` 或 IndexedDB：可長期保存，但洩漏風險最高，且違反「關閉分頁即清除」的使用者選擇。
- 瀏覽器直接呼叫 Gemini：架構較短，但 Key 會直接暴露給前端第三方程式碼與瀏覽器請求流程。

此方案仍無法消除所有風險。Key 在目前分頁存活期間仍可能被同頁 XSS 讀取，且 Worker 在單次請求處理期間會短暫看到 Key。因此實作必須搭配嚴格的輸入限制、內容安全政策、無日誌設計與錯誤清理。

## 5. 使用者體驗

### 5.1 第一次開啟

第一次開啟網站時顯示三步驟引導視窗：

1. **為什麼需要 API Key**
   - 說明 Google Assistant／Gemini App 不等於 Gemini API。
   - 說明網站只有 AI 截圖匯入與推薦功能需要 Key；一般排課可直接使用。
2. **到 Google AI Studio 申請**
   - 提供前往 `https://aistudio.google.com/app/apikey` 的外部連結，使用新分頁開啟。
   - 指示使用個人 Google 帳號登入、同意條款、建立並複製 API Key。
   - 提醒若學校或公司帳號受管理員限制，改用個人 Google 帳號。
   - 說明網站不要求啟用付費帳務；若使用者自行選用已啟用付費的 Google Cloud 專案，超過免費額度是否計費仍由該專案設定決定，網站無法代為關閉帳務。
3. **貼上並驗證**
   - 提供密碼型輸入欄、顯示／隱藏按鈕及「驗證並開始使用」。
   - 欄位旁固定顯示：「Key 僅供本分頁使用，關閉或重新整理即清除。」
   - 驗證成功後才啟用 AI 截圖匯入與 AI 推薦。

引導視窗另有「先使用一般排課功能」。略過後仍可使用所有非 AI 功能。網站只可以在 `localStorage` 記錄「完整教學已看過」，不得記錄 Key、Key 片段或驗證結果。

### 5.2 再次開啟或重新整理

若完整教學已看過但目前分頁沒有 Key，不重播完整教學。AI 功能顯示簡短設定卡，說明為了安全已清除 Key，並提供「貼上 API Key」按鈕。

### 5.3 全域狀態入口

導覽區提供 API Key 狀態按鈕：

- 未設定：`API Key 未設定`
- 已驗證：`本分頁已連線`

點擊後可開啟設定面板，執行：

- 貼上並驗證
- 顯示／隱藏輸入內容
- 更換 Key
- 立即清除
- 重新開啟申請教學

Key 清除後，所有 AI 功能立即回到未設定狀態；一般排課狀態保持不變。

## 6. 前端狀態與元件邊界

### 6.1 記憶體 Key store

建立單一職責的分頁記憶體 Key store，對外只提供：

- `setKey(value)`：驗證成功後保存原始 Key。
- `getKey()`：只供 AI request builder 取得。
- `clearKey()`：更換、使用者主動清除或頁面卸載時清空。
- `hasKey()`：供 UI 顯示狀態，不回傳 Key。

Key store 不得讀寫任何 Web Storage，也不得提供序列化或 debug 輸出。

### 6.2 引導與設定元件

元件分為：

- 首次引導視窗：只負責三步教學、略過與前往設定。
- Key 設定面板：負責輸入、顯示／隱藏、驗證、更換與清除。
- AI 功能門檻：無 Key 時顯示設定入口；有 Key 時顯示原有操作。
- Key 狀態按鈕：只顯示連線狀態，不顯示 Key 片段。

敏感輸入在成功驗證後必須從輸入 DOM value 清空，避免 Key 長期留在畫面節點中。

## 7. 後端 API 與資料流

### 7.1 驗證 Key

`POST /api/ai/validate-key`

Request body：

```json
{
  "apiKey": "使用者貼上的 Gemini API Key"
}
```

Worker 使用低成本的 Gemini 模型資訊請求驗證 Key 是否可用，不產生推薦文字，也不持久化結果。

成功回應：

```json
{
  "valid": true
}
```

錯誤回應使用本網站的安全錯誤契約，只包含 `code` 與可顯示訊息，不包含 Key、Google response headers 或原始 response body。

### 7.2 截圖匯入

`POST /api/ai/import-courses` 保留既有輸入欄位，另加入 request body 的 `apiKey`。Worker 使用 Gemini 3.1 Flash-Lite 辨識圖片，再走既有政大公開課程資料核對、資格條件抽取、重複課程與待確認流程。

### 7.3 AI 推薦

`POST /api/ai/recommend-plans` 保留既有輸入欄位，另加入 request body 的 `apiKey`。Worker 使用 Gemini 3.5 Flash 產生候選方案，再由既有確定性規則執行：

- 鎖定課程保留
- 資格條件檢查
- 實體／同步時段衝突檢查
- 非同步課程不占固定課表時段
- 最低學分硬性條件
- 實習天數與時段檢查
- 無效方案不得顯示或套用

### 7.4 Key 生命週期

1. 使用者在前端貼上 Key。
2. 前端將 Key 送到驗證 API。
3. 驗證成功後，前端把 Key 寫入記憶體 store，並清空輸入 DOM。
4. 每次 AI 操作由 request builder 即時從 store 取 Key，放入該次 request body。
5. Worker 呼叫 Gemini 後結束請求，不保存 Key。
6. 使用者清除、重新整理或關閉分頁後，store 不再持有 Key。

## 8. Gemini client 邊界

建立供 Worker 使用的 Gemini client，負責：

- 固定 Google Gemini API 端點與模型名稱。
- 文字與圖片 payload 轉換。
- timeout、JSON 解析及錯誤碼映射。
- 移除錯誤中的上游 headers、原始 body 和可能回顯的 Key。
- 接受可注入的 `fetch`，供單元測試驗證實際 request shape。

AI service 不直接依賴 Google request 格式。它只依賴「輸入結構化請求、取得 JSON 結果」的 provider 介面，使現有課程邏輯、schema 重試與確定性驗證能繼續獨立測試。

## 9. 錯誤處理

公開錯誤類型：

| 情況 | 顯示訊息 | 行為 |
| --- | --- | --- |
| 未提供 Key | 請先設定自己的 Gemini API Key。 | 開啟設定面板，不送 AI 請求 |
| Key 無效或無權限 | 這組 API Key 無法使用，請回到 Google AI Studio 確認。 | 不保存 Key |
| 受管理帳號限制 | 此 Google 帳號可能受到學校或公司政策限制，建議改用個人帳號。 | 不保存 Key，保留教學入口 |
| 免費額度用完／429 | 今天的免費額度已用完，請稍後或明天再試。 | 保留已驗證 Key |
| Google 暫時異常 | Gemini 暫時無法回應，請稍後再試。 | 保留已驗證 Key |
| 網路或 timeout | 連線逾時，請確認網路後再試。 | 保留已驗證 Key |
| 重新整理後無 Key | 為了保護你的 Key，重新整理後需要重新貼上。 | 顯示簡短設定卡 |

除非 Google 明確回傳 Key 已失效或無權限，暫時性錯誤不得自動清除 Key。

## 10. 安全要求

- 所有正式環境請求必須使用 HTTPS。
- Key 不得出現在 URL、query string、HTML、CSS、bundle、Web Storage、Cookie 或回應內容。
- Worker 不得 `console.log` request body、Key、Google Authorization 資訊或原始上游錯誤。
- API 回應加上 `Cache-Control: no-store`；敏感 POST 不得被快取。
- 請求 body 設定合理大小上限；截圖沿用現有圖片大小限制。
- 加入適合現有 Sites 架構的 Content Security Policy，限制腳本與連線來源，降低 XSS 取得記憶體 Key 的風險。
- 正式頁面避免載入不必要的第三方腳本、分析 SDK 或能讀取 DOM 的外部程式碼。
- Google AI Studio 教學需提醒使用者把 Key 限制為 Gemini API；若發現洩漏，應立即停用或輪替。
- 不在畫面顯示 Key 尾碼，避免截圖或共享畫面時留下可識別片段。

## 11. TDD 與邊界驗證

所有實作遵循一次一個垂直切片的 Red → Green → Refactor：

1. **記憶體生命週期**
   - Red：測試 Key store 不讀寫 Web Storage，且清除後無法取得 Key。
   - Green：以最小實作完成 store。
   - Refactor：收斂公開介面並維持全綠。
2. **首次引導**
   - Red：測試第一次開啟顯示完整教學，略過後一般排課仍可用。
   - Green：加入必要 DOM 與互動。
   - Refactor：整理狀態與可存取性。
3. **Key 設定互動**
   - Red：測試顯示／隱藏、驗證成功、輸入 DOM 清空、更換與清除。
   - Green：接上記憶體 store。
   - Refactor：抽離重複狀態更新。
4. **驗證 API**
   - Red：以 Worker 測試驗證成功、無 Key、401／403、429、timeout 與安全錯誤格式。
   - Green：實作 Gemini client 與 `/api/ai/validate-key`。
   - Refactor：統一錯誤映射與 `no-store` headers。
5. **AI 功能門檻**
   - Red：測試無 Key 時兩項 AI 功能不發出請求並開啟設定面板。
   - Green：加入 request gate。
   - Refactor：共用 gate 行為。
6. **截圖 Gemini 路由**
   - Red：測試截圖請求使用 Gemini 3.1 Flash-Lite，且仍通過官方課程核對。
   - Green：接入 provider。
   - Refactor：保留 provider 與課程 adapter 的清楚邊界。
7. **推薦 Gemini 路由**
   - Red：測試推薦使用 Gemini 3.5 Flash，低於最低學分或有衝堂的方案不會顯示。
   - Green：接入 provider。
   - Refactor：移除 Groq 專屬命名但不改變既有規則。
8. **真實邊界契約**
   - 使用環境注入的測試 Gemini Key 實際驗證模型資訊、文字生成、圖片輸入、response shape 與主要錯誤格式。
   - 未提供測試 Key 時安全略過；測試不得印出 Key 或完整個資。
9. **瀏覽器端到端**
   - 驗證首次引導、略過、申請連結、貼上、顯示／隱藏、錯誤訊息、更換、清除、重新整理與兩項 AI 流程。
   - 驗證無 Key 時一般排課、候選課程、實習與手動行程仍正常。

## 12. 完成條件

- 第一次使用者能在網站內理解 Google Assistant 與 Gemini API 的差異，並從官方連結完成申請。
- 使用者可貼上、驗證、更換與清除 Key。
- Key 只存於目前分頁記憶體，重新整理或關閉分頁後消失。
- Key 不出現在 `localStorage`、`sessionStorage`、IndexedDB、Cookie、URL、bundle、日誌或 API 回應。
- 無 Key 時一般排課完整可用，AI 功能提供明確設定入口。
- 截圖匯入使用 Gemini 3.1 Flash-Lite；推薦使用 Gemini 3.5 Flash。
- 無效、衝堂、資格不符或未達最低學分的推薦方案不得顯示或套用。
- 單元、Worker、bundle、rendered HTML、真實 Gemini 契約與瀏覽器關鍵流程測試均通過；沒有測試 Key 時只有真實 Gemini 契約可安全略過。

## 13. 官方參考

- Gemini API Key：<https://ai.google.dev/gemini-api/docs/api-key>
- Google AI Studio API Key：<https://aistudio.google.com/app/apikey>
- Google Cloud API Key 限制：<https://docs.cloud.google.com/docs/authentication/api-keys>
- Gemini API 錯誤排查：<https://ai.google.dev/gemini-api/docs/troubleshooting>
- Gemini 模型：<https://ai.google.dev/gemini-api/docs/models>
