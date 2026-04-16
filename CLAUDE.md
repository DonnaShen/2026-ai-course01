# CLAUDE.md

## 專案概述

花卉電商平台 — Node.js + Express + SQLite + EJS + Vue 3 + Tailwind CSS

這是一個完整的 B2C 花卉電商應用，支援商品瀏覽、購物車（訪客與會員雙模式）、訂單管理，以及管理員後台。後端採用 RESTful API，前端使用 EJS 伺服器端渲染搭配 Vue 3 CDN 頁面邏輯，無前端打包工具。

## 常用指令

```bash
# 開發（需兩個終端機）
npm run dev:server   # 啟動 Express 伺服器（port 3001）
npm run dev:css      # 監看 Tailwind CSS 變更

# 一鍵生產啟動（建置 CSS 後啟動）
npm start

# 測試
npm test             # 執行全部 32 個測試（Vitest + Supertest）

# 其他
npm run openapi      # 生成 openapi.json 文件
npm run css:build    # 手動建置並壓縮 CSS
```

## 關鍵規則

- **雙模式購物車**：購物車 API 同時接受 `Authorization: Bearer <token>`（已登入）與 `X-Session-Id: <uuid>`（訪客）。未帶任何憑證會返回 401。修改購物車邏輯時必須同時覆蓋兩種路徑。
- **統一 API 回應格式**：所有路由必須使用 `{ data, error, message }` 格式，不允許裸返回物件。成功時 `error: null`，失敗時 `data: null`。
- **訂單 Transaction 原子性**：建立訂單涉及 4 步驟（建訂單、建明細、扣庫存、清購物車），必須用 `db.transaction()` 包裹，任一步驟失敗需全部 rollback。
- **商品價格快照**：訂單明細的 `product_name` 與 `product_price` 是建立時快照，不隨商品更動。查詢訂單時不要用 JOIN 取商品現值。
- **Admin 路由雙重中間件**：`/api/admin/*` 所有路由必須同時套用 `authMiddleware` + `adminMiddleware`，缺一不可。
- 功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`

## 詳細文件

- [docs/README.md](./docs/README.md) — 項目介紹、技術棧、快速開始、常用指令表
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 架構、目錄結構、API 路由總覽、資料庫 Schema、認證機制
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 開發規範、命名規則、新增 API 步驟、環境變數表
- [docs/FEATURES.md](./docs/FEATURES.md) — 功能列表、行為描述、業務邏輯、錯誤碼
- [docs/TESTING.md](./docs/TESTING.md) — 測試規範、測試檔案表、執行順序、撰寫新測試指南
- [docs/CHANGELOG.md](./docs/CHANGELOG.md) — 更新日誌

## 回覆的語氣
- 請采用文言文的方式，回覆我訊息，以節省回覆的token(開發上不用特別節省)，回覆時，可以有一些簡單的英文單字。