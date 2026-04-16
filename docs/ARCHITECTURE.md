# ARCHITECTURE.md

## 系統概覽

本專案是一個 **伺服器端渲染（SSR）+ API** 混合架構的電商應用。Express 同時負責：
1. 渲染 EJS 頁面（`/`、`/products/:id`、`/cart` 等）
2. 提供 RESTful API（`/api/*`）

前端頁面由 EJS 模板渲染初始 HTML，再由 Vue 3（CDN 引入）接管動態互動邏輯。

---

## 目錄結構

```
project-root/
├── app.js                      # Express 應用工廠 — 掛載 middleware、路由、錯誤處理
├── server.js                   # 伺服器啟動 — 讀取 PORT、啟動 HTTP 監聽
├── package.json                # 依賴與 npm scripts
├── .env                        # 環境變數（不進版控）
├── .env.example                # 環境變數範本
├── vitest.config.js            # Vitest 測試設定（測試順序）
├── swagger-config.js           # Swagger/OpenAPI 生成設定
├── generate-openapi.js         # 執行 OpenAPI 文件生成的腳本
├── openapi.json                # 生成的 OpenAPI 3.0.3 規範（可忽略版控）
├── database.sqlite             # SQLite 資料庫檔案（不進版控）
├── database.sqlite-shm         # SQLite WAL 共享記憶體檔案（自動產生）
├── database.sqlite-wal         # SQLite WAL 日誌檔案（自動產生）
│
├── src/                        # 後端源碼
│   ├── database.js             # 資料庫連線、Schema 定義、初始資料植入
│   ├── middleware/
│   │   ├── authMiddleware.js   # 驗證 JWT Token，設定 req.user
│   │   ├── adminMiddleware.js  # 檢查 req.user.role === 'admin'
│   │   ├── sessionMiddleware.js # 提取 X-Session-Id header，設定 req.sessionId
│   │   └── errorHandler.js    # Express 全域錯誤處理（4 個參數）
│   └── routes/
│       ├── authRoutes.js       # POST /api/auth/register|login, GET /api/auth/profile
│       ├── productRoutes.js    # GET /api/products, GET /api/products/:id
│       ├── cartRoutes.js       # GET/POST /api/cart, PATCH/DELETE /api/cart/:itemId
│       ├── orderRoutes.js      # POST/GET /api/orders, GET/PATCH /api/orders/:id(/pay)
│       ├── adminProductRoutes.js # GET/POST /api/admin/products, PUT/DELETE /api/admin/products/:id
│       ├── adminOrderRoutes.js # GET /api/admin/orders, GET /api/admin/orders/:id
│       └── pageRoutes.js       # 所有前台與後台 EJS 頁面路由
│
├── public/                     # 靜態資源（Express static middleware 提供）
│   ├── css/
│   │   ├── input.css           # Tailwind 指令來源檔
│   │   └── output.css          # Tailwind CLI 編譯輸出（版控）
│   ├── js/
│   │   ├── api.js              # apiFetch() — 統一 API 請求封裝，自動帶認證 header
│   │   ├── auth.js             # Auth 物件 — localStorage token/user/sessionId 管理
│   │   ├── notification.js     # Notification.show() — 右上角浮動通知
│   │   ├── header-init.js      # 頁頭初始化（登入狀態、購物車數量徽章）
│   │   └── pages/              # 各頁面 Vue 3 應用邏輯
│   │       ├── index.js        # 商品列表頁
│   │       ├── product-detail.js # 商品詳情頁
│   │       ├── login.js        # 登入/註冊頁
│   │       ├── cart.js         # 購物車頁
│   │       ├── checkout.js     # 結帳頁
│   │       ├── orders.js       # 訂單列表頁
│   │       ├── order-detail.js # 訂單詳情頁
│   │       ├── admin-products.js # 後台商品管理頁
│   │       └── admin-orders.js # 後台訂單管理頁
│   └── stylesheets/
│       └── style.css           # 補充樣式（Tailwind 之外）
│
├── views/                      # EJS 模板
│   ├── layouts/
│   │   ├── front.ejs           # 前台佈局（header + footer）
│   │   └── admin.ejs           # 後台佈局（sidebar + admin header）
│   ├── pages/
│   │   ├── index.ejs
│   │   ├── product-detail.ejs
│   │   ├── login.ejs
│   │   ├── cart.ejs
│   │   ├── checkout.ejs
│   │   ├── orders.ejs
│   │   ├── order-detail.ejs
│   │   ├── 404.ejs
│   │   └── admin/
│   │       ├── products.ejs
│   │       └── orders.ejs
│   └── partials/
│       ├── head.ejs            # <head> 共用內容（meta、CSS、JS 引入）
│       ├── header.ejs          # 前台導覽列
│       ├── footer.ejs          # 頁尾
│       ├── admin-header.ejs    # 後台頂部列
│       ├── admin-sidebar.ejs   # 後台側邊選單
│       └── notification.ejs   # 通知 DOM 容器
│
└── tests/                      # 測試
    ├── setup.js                # 測試工具函式（app 實例、getAdminToken、registerUser）
    ├── auth.test.js
    ├── products.test.js
    ├── cart.test.js
    ├── orders.test.js
    ├── adminProducts.test.js
    └── adminOrders.test.js
```

---

## 啟動流程

```
npm start
  └── npm run css:build            (1) Tailwind CLI 編譯並壓縮 CSS
  └── node server.js
        ├── 讀取 .env (dotenv)
        ├── 驗證 JWT_SECRET 存在
        ├── require('./app.js')
        │     ├── 初始化 Express
        │     ├── 套用 cors、express.json、express.urlencoded
        │     ├── 套用 express.static('public')
        │     ├── 設定 EJS view engine（views 目錄）
        │     ├── 套用 sessionMiddleware（全域）
        │     ├── 掛載 API 路由（/api/auth、/api/products...）
        │     ├── 掛載頁面路由（/）
        │     └── 掛載 errorHandler（全域）
        ├── require('./src/database.js')
        │     ├── 開啟/建立 database.sqlite
        │     ├── PRAGMA journal_mode = WAL
        │     ├── PRAGMA foreign_keys = ON
        │     ├── CREATE TABLE IF NOT EXISTS（5 張表）
        │     └── 植入預設商品與 admin 帳號
        └── app.listen(PORT || 3001)
```

---

## API 路由總覽

### 認證 API — `/api/auth`

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| POST | /api/auth/register | 無 | 註冊新帳號，返回 token |
| POST | /api/auth/login | 無 | 登入，返回 token |
| GET | /api/auth/profile | JWT 必要 | 取得當前用戶資料 |

### 商品 API — `/api/products`

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| GET | /api/products | 無 | 商品列表（支援分頁） |
| GET | /api/products/:id | 無 | 商品詳情 |

### 購物車 API — `/api/cart`

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| GET | /api/cart | JWT 或 Session | 查看購物車 |
| POST | /api/cart | JWT 或 Session | 加入商品 |
| PATCH | /api/cart/:itemId | JWT 或 Session | 更新數量 |
| DELETE | /api/cart/:itemId | JWT 或 Session | 移除項目 |

### 訂單 API — `/api/orders`

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| POST | /api/orders | JWT 必要 | 從購物車建立訂單 |
| GET | /api/orders | JWT 必要 | 取得我的訂單列表 |
| GET | /api/orders/:id | JWT 必要 | 取得訂單詳情 |
| PATCH | /api/orders/:id/pay | JWT 必要 | 模擬付款（成功/失敗） |

### 管理員商品 API — `/api/admin/products`

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| GET | /api/admin/products | JWT + admin | 後台商品列表（支援分頁） |
| POST | /api/admin/products | JWT + admin | 新增商品 |
| PUT | /api/admin/products/:id | JWT + admin | 更新商品 |
| DELETE | /api/admin/products/:id | JWT + admin | 刪除商品 |

### 管理員訂單 API — `/api/admin/orders`

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| GET | /api/admin/orders | JWT + admin | 後台訂單列表（支援分頁、狀態篩選） |
| GET | /api/admin/orders/:id | JWT + admin | 後台訂單詳情（含用戶資訊） |

### 頁面路由

| 路由 | 說明 | 需認證 |
|------|------|--------|
| GET / | 商品首頁 | 否 |
| GET /products/:id | 商品詳情 | 否 |
| GET /cart | 購物車 | 否 |
| GET /checkout | 結帳 | 前端跳轉（非 middleware） |
| GET /login | 登入/註冊 | 否 |
| GET /orders | 我的訂單 | 前端跳轉（非 middleware） |
| GET /orders/:id | 訂單詳情 | 前端跳轉（非 middleware） |
| GET /admin/products | 後台商品管理 | 前端跳轉（非 middleware） |
| GET /admin/orders | 後台訂單管理 | 前端跳轉（非 middleware） |

> **注意**：頁面路由本身不驗證認證，認證由前端 JavaScript (`Auth.requireAuth()`, `Auth.requireAdmin()`) 在頁面載入時處理，未授權則 redirect 到 `/login`。

---

## 統一 API 回應格式

所有 API 端點均使用以下格式：

```json
// 成功回應
{
  "data": { ... },
  "error": null,
  "message": "操作成功的說明文字"
}

// 失敗回應
{
  "data": null,
  "error": "ERROR_CODE",
  "message": "人類可讀的錯誤說明"
}
```

**HTTP 狀態碼與錯誤碼對應**：

| HTTP Code | error 欄位 | 常見情境 |
|-----------|-----------|--------|
| 400 | VALIDATION_ERROR | 欄位缺失、格式錯誤 |
| 401 | UNAUTHORIZED | 缺少 token、token 無效或過期、用戶不存在 |
| 403 | FORBIDDEN | 權限不足（非 admin 訪問 admin 路由） |
| 404 | NOT_FOUND | 商品/訂單/用戶不存在 |
| 409 | CONFLICT | Email 已存在、商品有未完成訂單無法刪除 |
| 422 | （無固定碼） | 業務邏輯錯誤（庫存不足、購物車空、訂單非 pending 狀態） |
| 500 | INTERNAL_ERROR | 未預期的伺服器錯誤 |

---

## 認證與授權機制

### JWT 參數

| 參數 | 值 |
|------|-----|
| 演算法 | HS256 |
| 有效期 | 7 天（`expiresIn: '7d'`） |
| 密鑰來源 | `process.env.JWT_SECRET` |

**Payload 結構**：
```json
{
  "userId": "uuid-string",
  "email": "user@example.com",
  "role": "user | admin",
  "iat": 1713000000,
  "exp": 1713604800
}
```

### `authMiddleware` 行為

1. 讀取 `Authorization` header，格式必須為 `Bearer <token>`
2. 缺少或格式錯誤 → 401 `{ error: 'UNAUTHORIZED', message: '未授權的請求' }`
3. `jwt.verify()` 失敗（過期或簽名錯誤）→ 401 `{ error: 'UNAUTHORIZED', message: 'Token 無效或已過期' }`
4. 以 `decoded.userId` 查詢資料庫，用戶不存在 → 401
5. 驗證通過 → 設定 `req.user = { userId, email, role }`

### `adminMiddleware` 行為

1. 檢查 `req.user` 是否存在（依賴先執行 `authMiddleware`）
2. 若 `req.user.role !== 'admin'` → 403 `{ error: 'FORBIDDEN', message: '權限不足' }`

### `sessionMiddleware` 行為

- 從 `X-Session-Id` header 提取值，設定到 `req.sessionId`
- 此 middleware 掛載在全域，所有請求都會執行
- 若 header 不存在，`req.sessionId` 為 `undefined`

### 購物車雙模式認證邏輯

購物車的 4 個端點都使用自訂認證邏輯（非標準 middleware），優先順序如下：

```javascript
// cartRoutes.js 中每個 handler 的認證邏輯
if (req.user) {
  // 已登入：用 user_id 識別購物車
  identifier = { user_id: req.user.userId }
} else if (req.sessionId) {
  // 訪客：用 session_id 識別購物車
  identifier = { session_id: req.sessionId }
} else {
  // 兩者皆無 → 401
  return res.status(401).json(...)
}
```

> `authMiddleware` 並非以 middleware 方式套用在購物車路由，而是在路由 handler 內部呼叫 jwt.verify() 並容錯（允許失敗），以支援訪客模式。

---

## 資料庫 Schema

### `users` 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| email | TEXT | UNIQUE NOT NULL | 登入用 Email |
| password_hash | TEXT | NOT NULL | bcrypt 雜湊（rounds=10） |
| name | TEXT | NOT NULL | 顯示名稱 |
| role | TEXT | NOT NULL, DEFAULT 'user', CHECK IN ('user','admin') | 角色 |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間（ISO 格式） |

### `products` 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL | 商品名稱 |
| description | TEXT | — | 商品描述（可為空） |
| price | INTEGER | NOT NULL, CHECK(price > 0) | 售價（新台幣元） |
| stock | INTEGER | NOT NULL, DEFAULT 0, CHECK(stock >= 0) | 庫存數量 |
| image_url | TEXT | — | 圖片 URL（可為空） |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |
| updated_at | TEXT | NOT NULL, DEFAULT datetime('now') | 最後更新時間 |

### `cart_items` 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| session_id | TEXT | — | 訪客 Session ID（可為空） |
| user_id | TEXT | FK → users(id)，可為空 | 已登入用戶 ID |
| product_id | TEXT | FK → products(id)，NOT NULL | 商品 ID |
| quantity | INTEGER | NOT NULL, DEFAULT 1, CHECK(quantity > 0) | 購買數量 |

> `session_id` 與 `user_id` 恰好一個有值，另一個為 NULL（業務邏輯保證，無 DB 約束）。

### `orders` 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_no | TEXT | UNIQUE NOT NULL | 訂單編號，格式 `ORD-YYYYMMDD-XXXXX` |
| user_id | TEXT | FK → users(id)，NOT NULL | 購買用戶 |
| recipient_name | TEXT | NOT NULL | 收件人姓名 |
| recipient_email | TEXT | NOT NULL | 收件人 Email |
| recipient_address | TEXT | NOT NULL | 收件地址 |
| total_amount | INTEGER | NOT NULL | 訂單總額（元） |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','paid','failed') | 訂單狀態 |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |

### `order_items` 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_id | TEXT | FK → orders(id)，NOT NULL | 所屬訂單 |
| product_id | TEXT | NOT NULL | 商品 ID（不設 FK，保留歷史） |
| product_name | TEXT | NOT NULL | 商品名稱**快照** |
| product_price | INTEGER | NOT NULL | 商品單價**快照** |
| quantity | INTEGER | NOT NULL | 購買數量 |

> `product_name` 與 `product_price` 是建立訂單當下的快照，不隨商品資料異動。

---

## 資料流圖

### 購物（訪客 → 登入 → 下單）

```
訪客瀏覽器
  │
  ├─ GET /           → pageRoutes → EJS 渲染 index.ejs
  │   └─ 前端 JS 呼叫 GET /api/products → 商品列表
  │
  ├─ POST /api/cart  (X-Session-Id header)
  │   └─ sessionMiddleware 提取 req.sessionId
  │   └─ cartRoutes 用 session_id 儲存 cart_items
  │
  ├─ POST /api/auth/login → 取得 JWT token
  │   └─ Auth.login(token, user) → 儲存至 localStorage
  │
  ├─ POST /api/orders (Authorization: Bearer <token>)
  │   └─ authMiddleware 驗證 → req.user 設定
  │   └─ 讀取 user_id 的 cart_items
  │   └─ db.transaction() {
  │       1. INSERT orders
  │       2. INSERT order_items（含快照）
  │       3. UPDATE products SET stock = stock - quantity
  │       4. DELETE cart_items
  │   }
  │
  └─ PATCH /api/orders/:id/pay → 更新狀態 pending → paid/failed
```

---

## 金流整合（未實現）

`.env` 中預留了 ECPay 相關環境變數：

```
ECPAY_MERCHANT_ID=3002607
ECPAY_HASH_KEY=pwFHCqoQZGmho4w6
ECPAY_HASH_IV=EkRm7iFT261dpevs
ECPAY_ENV=staging
```

**現況**：使用模擬付款端點 `PATCH /api/orders/:id/pay`，由前端傳入 `action: 'success'|'fail'` 來切換訂單狀態，不經過真實金流閘道。未來若需接入 ECPay，需在此端點替換為真實的金流 SDK 呼叫。
