# 政大排課｜實習友善課表規劃

私人單頁排課網站。右側課程庫點擊後加入左側課表，並計算學分、實習空檔、衝堂、資格與特殊日期。

## 開發

```bash
npm test
npm run lint
npm run build
```

成品為 `dist/server/index.js` 的 Cloudflare Worker，不依賴外部 npm 套件。

## AI 功能

AI API 金鑰只設定於 Sites 的加密環境變數 `GROQ_API_KEY`。不要建立含金鑰的 `.env` 或提交金鑰。截圖與顧問表單會傳送到 Groq，伺服器不保存請求內容。

```bash
# 一般測試與政大公開資料真實契約
npm run verify

# 在安全環境注入 GROQ_API_KEY 後，驗證 Groq 文字與單張圖片契約
npm run test:contract:groq
```
