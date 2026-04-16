# DEVELOPMENT.md

## 環境設定

### 環境變數表

| 變數名稱 | 用途 | 必要 | 預設值 / 說明 |
|---------|------|------|---------------|
| `JWT_SECRET` | JWT 簽名密鑰 | **必要** | 無，缺少時伺服器拒絕啟動 |
| `PORT` | HTTP 監聽埠口 | 選填 | `3001` |
| `BASE_URL` | 伺服器完整 URL（用於 OpenAPI 文件） | 選填 | `http://localhost:3001` |
| `FRONTEND_URL` | 允許的 CORS 來源 | 選填 | `http://localhost:5173`（但實際服務在 3001） |
| `ADMIN_EMAIL` | 預設 admin 帳號 Email | 選填 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | 預設 admin 帳號密碼 | 選填 | `12345678` |
| `ECPAY_MERCHANT_ID` | ECPay 特店代號 | 選填 | `3002607`（staging 測試值） |
| `ECPAY_HASH_KEY` | ECPay Hash Key | 選填 | staging 測試值 |
| `ECPAY_HASH_IV` | ECPay Hash IV | 選填 | staging 測試值 |
| `ECPAY_ENV` | ECPay 環境 | 選填 | `staging` |

> ECPay 相關變數目前未在應用程式中使用，為未來金流整合預留。

---

## 命名規則

### 後端（Node.js / Express）

| 類型 | 規則 | 範例 |
|------|------|------|
| 檔案名稱 | camelCase | `authRoutes.js`, `adminMiddleware.js` |
| 函式名稱 | camelCase | `generateOrderNo()`, `getAdminToken()` |
| 變數名稱 | camelCase | `cartItem`, `totalAmount` |
| 常數 | camelCase（非 ALL_CAPS） | `db`, `router` |
| 資料庫欄位 | snake_case | `user_id`, `product_name`, `created_at` |
| API 路徑 | kebab-case | `/api/admin/products`, `/api/auth/register` |
| 路由參數 | camelCase（`req.params`） | `req.params.id`, `req.params.itemId` |

### 前端（JavaScript）

| 類型 | 規則 | 範例 |
|------|------|------|
| 檔案名稱 | kebab-case | `product-detail.js`, `admin-orders.js` |
| Vue 資料 | camelCase | `products`, `cartItems`, `isLoading` |
| 函式名稱 | camelCase | `loadProducts()`, `addToCart()` |
| localStorage key | snake_case with prefix | `flower_token`, `flower_user`, `flower_session_id` |
| CSS class | Tailwind utility | 直接使用 Tailwind，自訂 class 用 kebab-case |

### 回應與請求格式

| 類型 | 規則 | 範例 |
|------|------|------|
| API 回應 JSON key | snake_case | `order_no`, `recipient_name`, `total_amount` |
| API 請求 body key | camelCase | `productId`, `recipientName`, `recipientEmail` |

---

## 模組系統

本專案後端使用 **CommonJS**（`require` / `module.exports`），前端不使用模組打包工具，所有 JS 直接以 `<script src="...">` 引入。

### 後端模組引入順序（app.js）

```javascript
const express = require('express')
const cors = require('cors')
const path = require('path')
// ... 其他 npm 套件
const db = require('./src/database')
const authMiddleware = require('./src/middleware/authMiddleware')
const sessionMiddleware = require('./src/middleware/sessionMiddleware')
// ... 路由
```

### 前端 JS 引入順序（EJS 模板中）

頁面模板中的 JS 引入有**固定順序依賴**，不可任意調整：

```html
<!-- 1. Vue 3 CDN（其他 JS 依賴 Vue） -->
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>

<!-- 2. 核心工具（auth、api 互相依賴，須先於頁面 JS） -->
<script src="/js/auth.js"></script>
<script src="/js/notification.js"></script>
<script src="/js/api.js"></script>

<!-- 3. 頁頭初始化（依賴 auth.js） -->
<script src="/js/header-init.js"></script>

<!-- 4. 頁面邏輯（依賴以上所有） -->
<script src="/js/pages/index.js"></script>
```

---

## 新增 API 端點的步驟

### 1. 在對應路由檔案新增 handler

```javascript
// src/routes/yourRoutes.js

/**
 * @swagger
 * /api/your-path:
 *   get:
 *     summary: 功能摘要
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功
 */
router.get('/your-path', authMiddleware, (req, res, next) => {
  try {
    const result = db.prepare('SELECT ...').all()
    res.json({
      data: result,
      error: null,
      message: '成功'
    })
  } catch (err) {
    next(err)  // 交給 errorHandler
  }
})
```

### 2. 確認 middleware 套用

- **公開端點**：無需 middleware
- **需要登入**：套用 `authMiddleware`
- **需要管理員**：依序套用 `authMiddleware`, `adminMiddleware`

```javascript
// 公開
router.get('/products', handler)

// 需登入
router.get('/orders', authMiddleware, handler)

// 需 admin
router.get('/admin/orders', authMiddleware, adminMiddleware, handler)
```

### 3. 在 app.js 掛載新路由（若新路由檔）

```javascript
// app.js
const yourRoutes = require('./src/routes/yourRoutes')
app.use('/api', yourRoutes)
```

### 4. 更新文件

- 在 `docs/FEATURES.md` 新增功能描述
- 在 `docs/ARCHITECTURE.md` 更新 API 路由總覽表
- 執行 `npm run openapi` 重新生成 `openapi.json`

---

## 新增 Middleware 的步驟

```javascript
// src/middleware/yourMiddleware.js

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function yourMiddleware(req, res, next) {
  // 驗證或處理邏輯
  if (/* 失敗條件 */) {
    return res.status(400).json({
      data: null,
      error: 'YOUR_ERROR_CODE',
      message: '錯誤說明'
    })
  }
  // 成功：設定 req 屬性並繼續
  req.yourData = ...
  next()
}

module.exports = yourMiddleware
```

---

## 新增資料庫表的步驟

在 `src/database.js` 的初始化區塊新增 `CREATE TABLE IF NOT EXISTS`：

```javascript
// src/database.js

db.exec(`
  CREATE TABLE IF NOT EXISTS your_table (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
```

> **注意**：`better-sqlite3` 使用同步 API，不需要 async/await。所有 DB 操作直接返回結果，不回傳 Promise。

---

## JSDoc 格式說明

本專案使用 swagger-jsdoc 從路由檔案的 JSDoc 生成 OpenAPI 3.0.3 文件。

### 基本格式

```javascript
/**
 * @swagger
 * /api/path:
 *   post:
 *     summary: 端點摘要（一行）
 *     description: 詳細說明（選填）
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       201:
 *         description: 建立成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 error:
 *                   type: null
 *                 message:
 *                   type: string
 *       400:
 *         description: 驗證失敗
 */
```

### Tags 對應

| Tag | 對應路由檔案 |
|-----|------------|
| Authentication | authRoutes.js |
| Products | productRoutes.js |
| Cart | cartRoutes.js |
| Orders | orderRoutes.js |
| Admin - Products | adminProductRoutes.js |
| Admin - Orders | adminOrderRoutes.js |

---

## 計畫歸檔流程

### 計畫檔案命名格式

```
docs/plans/YYYY-MM-DD-<feature-name>.md
```

範例：`docs/plans/2026-04-15-payment-integration.md`

### 計畫文件結構

```markdown
# YYYY-MM-DD — Feature Name

## User Story
身為 [角色]，我希望 [目標]，以便 [價值]。

## Spec
### 需求描述
### API 變更
### DB 變更（若有）
### 前端變更（若有）

## Tasks
- [ ] Task 1
- [ ] Task 2
- [x] Task 3（已完成）
```

### 功能完成後的流程

1. 將計畫檔案從 `docs/plans/` 移至 `docs/plans/archive/`
2. 更新 `docs/FEATURES.md`：
   - 標記功能狀態為完成 ✅
   - 加入功能行為描述
3. 更新 `docs/CHANGELOG.md`：
   - 在對應版本下新增 `### Added` 或 `### Changed` 條目

---

## 開發常見問題

### Q: 新增商品後前端沒更新

Tailwind CSS 使用 CLI 工具編譯，**不是 JIT 即時模式**。若新增了 Tailwind class 到模板但畫面沒套用，需執行 `npm run dev:css` 重新編譯。

### Q: JWT_SECRET 未設定造成啟動失敗

`server.js` 啟動時會檢查 `process.env.JWT_SECRET`，若未設定則 `throw Error` 並中止。請確認 `.env` 檔案存在且包含此變數。

### Q: SQLite 檔案鎖定

若測試或開發過程中 `database.sqlite` 被鎖定，可能是前一個進程未正常結束。終止所有 Node.js 進程後重試：

```bash
pkill -f "node server.js"
```

### Q: 購物車訪客模式測試

訪客模式需要 `X-Session-Id` header。使用 curl 測試時：

```bash
curl -H "X-Session-Id: test-session-123" http://localhost:3001/api/cart
```
