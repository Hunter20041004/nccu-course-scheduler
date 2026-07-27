# 專案現況 — 政大排課系統（NCCU Course Scheduler）

> 由 Claude 於 2026-07-23 整理。**新對話請先讀這份**。

## 這是什麼

**政大學生的實習友善排課系統。** 新訪客從空白工作區開始，透過政大 115-1 課程庫
搜尋、AI 截圖匯入或手動新增建立候選清單。把政大節次、課程資格、**實習時段**、
非同步課程、個人行程與 AI 推薦，整合在同一個課表工作台。

## 網址

| 用途 | 連結 |
|---|---|
| GitHub | https://github.com/Hunter20041004/nccu-course-scheduler |
| Share-safe Demo | https://hunter20041004.github.io/nccu-course-scheduler/ |
| Live Demo | https://nccu-course-planner-1151.huntertseng.chatgpt.site |

## 技術棧

Node/JS．`src/`、`scripts/`、`tests/`、`docs/`
CI 與部署：`.github/workflows/ci.yml`、`pages.yml`（GitHub Pages 由 `main` 部署）

## 版本控制狀態

- `main` 分支，**179 commits**，✅ **已推上 GitHub 且設定追蹤 `origin/main`**
- 2026-07-23 之前 main 曾領先 GitHub 5 個 commit（含 `fix: restore original canonical site`），
  且**未設定追蹤**導致看不到警訊——已推送並修正設定
- 舊分支 `feature/sunbreak-redesign`（內容已全在 main）與 `feature/nccu-grid-internship`
  （落後 165 commits、從未推送）已刪除
- ⚠️ GitHub 上仍留有遠端分支 `origin/feature/sunbreak-redesign`，可考慮刪除

## `_workspace/`（不進版控）

專案外圍的工作檔，2026-07-23 從舊容器收進來，已加入 `.gitignore`：
- `work/` — `course-data.mjs`、`build-course-planner.mjs` 與測試（12 個檔）
- `outputs/nccu-course-planner/` — 產出版本（29 個檔）
- `docs/` — 零星文件

## 2026-07-23 的整理

原本埋在 `~/Documents/Codex/2026-07-13/new-chat/site`（容器名稱與專案名不符），
已拉平為獨立專案 `~/Developer/nccu-course-scheduler`。
同層的 `profile-Hunter20041004`（你的 GitHub 個人首頁 repo）已獨立為 `~/Developer/profile-Hunter20041004`。

## 下一步

主線功能（AI 課程比較、跨工具共享個人檔案）已完成並上線，可依需求繼續迭代。
