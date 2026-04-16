# 花卉電商平台

全端 B2C 電商應用，以花卉商品為主題，支援完整購物流程：商品瀏覽 → 加入購物車 → 建立訂單 → 模擬付款。管理員可透過後台管理商品與查看訂單。

---

## 技術棧

| 分類 | 技術 | 版本 | 說明 |
|------|------|------|------|
| 後端框架 | Express | ~4.16.1 | Web 伺服器與路由 |
| 資料庫 | better-sqlite3 | ^12.8.0 | 嵌入式 SQLite，同步 API |
| 認證 | jsonwebtoken | ^9.0.2 | JWT HS256，7 天有效期 |
| 密碼加密 | bcrypt | ^6.0.0 | Salt rounds 10（生產） |
| 前端模板 | EJS | ^5.0.1 | 伺服器端渲染 |
| 前端框架 | Vue 3 | CDN | 組合式 API，無打包工具 |
| CSS 框架 | Tailwind CSS | ^4.2.2 | CLI 工具編譯 |
| 測試框架 | Vitest | ^2.1.9 | 搭配 Supertest HTTP 測試 |
| API 文件 | swagger-jsdoc | ^6.2.8 | 生成 OpenAPI 3.0 規範 |
| ID 生成 | uuid | ^11.1.0 | UUID v4 |
| 跨域 | cors | ^2.8.5 | 允許指定來源 |

---

## 快速開始

### 前置需求

- Node.js 18+
- npm 9+

### 安裝與啟動

```bash
# 1. 複製環境變數
cp .env.example .env

# 2. 編輯 .env，至少設定 JWT_SECRET
#    其他變數有預設值可直接使用

# 3. 安裝依賴
npm install

# 4a. 開發模式（需兩個終端機）
npm run dev:server   # 終端機 1：啟動伺服器
npm run dev:css      # 終端機 2：監看 CSS

# 4b. 生產模式（一鍵啟動）
npm start
```

### 預設帳號

資料庫初始化時自動建立：

| 帳號 | 密碼 | 角色 |
|------|------|------|
| admin@hexschool.com | 12345678 | admin |

### 預設資料

資料庫初始化時自動植入 8 種花卉商品（粉色玫瑰、百合、向日葵、繡球花、牡丹、薰衣草、大麗花、非洲菊）。

---

## 常用指令表

| 指令 | 說明 |
|------|------|
| `npm run dev:server` | 啟動開發伺服器（port 3001，需手動 CSS） |
| `npm run dev:css` | 監看 Tailwind CSS 變更並重新編譯 |
| `npm start` | 生產啟動（先建置 CSS 再啟動） |
| `npm test` | 執行全部測試（32 個，約 1.6 秒） |
| `npm run css:build` | 手動建置並壓縮 CSS |
| `npm run openapi` | 從 JSDoc 生成 openapi.json |

---

## 存取位置

- **前台**：http://localhost:3001/
- **後台**：http://localhost:3001/admin/products
- **OpenAPI 文件**：執行 `npm run openapi` 後查看 `openapi.json`

---

## 文件索引

| 文件 | 說明 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 架構、目錄結構、API 路由總覽、資料庫 Schema、認證機制、資料流 |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 開發規範、命名規則、新增功能步驟、環境變數表 |
| [FEATURES.md](./FEATURES.md) | 功能列表、詳細行為描述、業務邏輯、錯誤碼說明 |
| [TESTING.md](./TESTING.md) | 測試規範、測試檔案表、撰寫新測試指南、常見陷阱 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新日誌 |
| [plans/](./plans/) | 進行中的開發計畫 |
| [plans/archive/](./plans/archive/) | 已完成的計畫歸檔 |
