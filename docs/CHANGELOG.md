# CHANGELOG.md

本專案更新日誌依 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/) 格式撰寫。

---

## [Unreleased]

---

## [1.0.0] — 2026-04-15

### Added

**認證系統**
- 用戶註冊（`POST /api/auth/register`）：email + password + name，返回 JWT token
- 用戶登入（`POST /api/auth/login`）：email + password，返回 JWT token
- 取得個人資料（`GET /api/auth/profile`）：需 JWT 認證
- JWT HS256 認證，有效期 7 天
- bcrypt 密碼雜湊（salt rounds: 10）
- admin 角色系統（`role: 'user' | 'admin'`）

**商品功能**
- 商品列表（`GET /api/products`）：支援 `page`、`limit` 分頁查詢
- 商品詳情（`GET /api/products/:id`）：公開存取
- 管理員新增商品（`POST /api/admin/products`）
- 管理員更新商品（`PUT /api/admin/products/:id`）：支援部分更新
- 管理員刪除商品（`DELETE /api/admin/products/:id`）：含未完成訂單保護
- 預設植入 8 種花卉商品

**購物車功能**
- 雙模式購物車：已登入用戶（JWT）與訪客（Session ID）
- 查看購物車（`GET /api/cart`）：返回商品資訊與總金額
- 加入購物車（`POST /api/cart`）：同商品自動累加數量，含庫存驗證
- 更新數量（`PATCH /api/cart/:itemId`）：含庫存驗證
- 移除項目（`DELETE /api/cart/:itemId`）

**訂單功能**
- 建立訂單（`POST /api/orders`）：
  - 從購物車一鍵建立
  - Transaction 確保原子性（建立訂單、明細、扣庫存、清購物車）
  - 商品名稱與價格快照
  - 訂單號格式：`ORD-YYYYMMDD-XXXXX`
- 我的訂單列表（`GET /api/orders`）
- 訂單詳情（`GET /api/orders/:id`）：含明細
- 模擬付款（`PATCH /api/orders/:id/pay`）：action `success/fail` 切換狀態
- 訂單狀態：`pending → paid/failed`

**管理員功能**
- 後台商品列表（`GET /api/admin/products`）：支援分頁
- 後台訂單列表（`GET /api/admin/orders`）：支援分頁、`status` 狀態篩選
- 後台訂單詳情（`GET /api/admin/orders/:id`）：含訂購者資訊
- 雙重 middleware 保護（`authMiddleware` + `adminMiddleware`）

**前台頁面**
- 商品首頁（`/`）
- 商品詳情頁（`/products/:id`）
- 購物車頁（`/cart`）
- 結帳頁（`/checkout`）
- 登入/註冊頁（`/login`）
- 訂單列表頁（`/orders`）
- 訂單詳情頁（`/orders/:id`）
- 404 頁面

**後台頁面**
- 商品管理頁（`/admin/products`）：新增、編輯、刪除商品
- 訂單管理頁（`/admin/orders`）：查看訂單列表與詳情

**基礎設施**
- Express + EJS 伺服器端渲染
- Vue 3（CDN）前端互動
- Tailwind CSS 4 UI 框架
- better-sqlite3 資料庫，WAL 模式，外鍵約束
- 統一 API 回應格式 `{ data, error, message }`
- 全域 errorHandler middleware
- sessionMiddleware 自動提取 `X-Session-Id`
- CORS 設定
- OpenAPI 3.0.3 文件生成（swagger-jsdoc）
- Vitest + Supertest 整合測試（32 個測試，全通過）
- 預設 admin 帳號（admin@hexschool.com / 12345678）
