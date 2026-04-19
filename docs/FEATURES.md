# FEATURES.md

## 功能完成狀態總覽

| 功能區塊 | 狀態 | 說明 |
|---------|------|------|
| 用戶認證（註冊/登入/個人資料） | ✅ 完成 | JWT + bcrypt |
| 商品列表與詳情 | ✅ 完成 | 分頁、公開存取 |
| 購物車（訪客 + 已登入） | ✅ 完成 | 雙模式，Session ID 或 JWT |
| 訂單建立（含庫存扣減） | ✅ 完成 | Transaction 確保原子性 |
| 訂單查詢 | ✅ 完成 | 列表 + 詳情 |
| 模擬付款（測試用） | ✅ 完成 | 手動觸發成功/失敗，不經真實金流 |
| ECPay AIO 金流整合 | ✅ 完成 | 綠界 AIO 信用卡付款，QueryTradeInfo 確認結果 |
| 管理員商品管理 | ✅ 完成 | CRUD 含庫存保護 |
| 管理員訂單查詢 | ✅ 完成 | 分頁 + 狀態篩選 + 用戶資訊 |
| 前台頁面（EJS + Vue 3） | ✅ 完成 | 9 個頁面 |
| 後台頁面（EJS + Vue 3） | ✅ 完成 | 2 個管理頁面 |
| OpenAPI 文件 | ✅ 完成 | 生成 openapi.json |

---

## 1. 用戶認證

### POST /api/auth/register — 註冊

**行為描述**：建立新用戶帳號並立即返回 JWT token（免重新登入）。

**請求 body（必填欄位）**：

| 欄位 | 型別 | 必填 | 驗證規則 |
|------|------|------|--------|
| email | string | 是 | 格式驗證（含 `@`）、資料庫唯一性 |
| password | string | 是 | 最少 6 字元 |
| name | string | 是 | 非空字串 |

**業務邏輯**：
1. 驗證欄位格式與完整性
2. 查詢 email 是否已存在 → 409 CONFLICT
3. 以 `bcrypt.hash(password, 10)` 雜湊密碼
4. 生成 UUID 作為用戶 ID
5. INSERT 新用戶到 users 表
6. 簽發 JWT（有效期 7 天）
7. 返回用戶資訊（不含 password_hash）+ token

**回應範例**：
```json
{
  "data": {
    "user": { "id": "uuid", "email": "...", "name": "...", "role": "user" },
    "token": "eyJhbGc..."
  },
  "error": null,
  "message": "註冊成功"
}
```

**錯誤情境**：
- 欄位缺失 → 400 `VALIDATION_ERROR`
- Email 格式錯誤 → 400 `VALIDATION_ERROR`
- Email 已存在 → 409 `CONFLICT`

---

### POST /api/auth/login — 登入

**行為描述**：驗證帳號密碼，返回 JWT token。

**請求 body（必填欄位）**：

| 欄位 | 型別 | 必填 | 驗證規則 |
|------|------|------|--------|
| email | string | 是 | 非空 |
| password | string | 是 | 非空 |

**業務邏輯**：
1. 以 email 查詢用戶 → 不存在則 401（不透露是 email 不存在還是密碼錯誤）
2. `bcrypt.compareSync(password, user.password_hash)` 比對密碼 → 不符合則 401
3. 簽發新 JWT token（每次登入都發新的）
4. 返回用戶資訊 + token

**錯誤情境**：
- 欄位缺失 → 400
- 帳號或密碼錯誤 → 401 `UNAUTHORIZED`, `message: '帳號或密碼錯誤'`

---

### GET /api/auth/profile — 取得個人資料

**認證**：JWT 必要（`authMiddleware`）

**行為描述**：返回當前登入用戶的完整資料（除 password_hash 外所有欄位）。

**回應**：
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "使用者名稱",
    "role": "user",
    "created_at": "2026-04-15T12:00:00.000Z"
  },
  "error": null,
  "message": "成功"
}
```

---

## 2. 商品功能

### GET /api/products — 商品列表

**認證**：無（公開）

**查詢參數**：

| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| page | integer | 1 | 頁碼，從 1 開始 |
| limit | integer | 10 | 每頁筆數，最大 100 |

**業務邏輯**：
1. 解析並驗證 `page`、`limit` 參數（非整數或超出範圍時使用預設值）
2. `SELECT COUNT(*) FROM products` 取得總數
3. `SELECT * FROM products LIMIT ? OFFSET ?` 取得分頁資料
4. 計算 `totalPages = Math.ceil(total / limit)`
5. 返回商品陣列 + 分頁資訊

**回應格式**：
```json
{
  "data": {
    "products": [
      {
        "id": "uuid",
        "name": "粉色玫瑰",
        "description": "...",
        "price": 299,
        "stock": 50,
        "image_url": "https://...",
        "created_at": "...",
        "updated_at": "..."
      }
    ],
    "pagination": {
      "total": 8,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "error": null,
  "message": "成功"
}
```

---

### GET /api/products/:id — 商品詳情

**認證**：無（公開）

**路徑參數**：`id` — 商品 UUID

**錯誤情境**：
- 商品不存在 → 404 `NOT_FOUND`, `message: '商品不存在'`

---

## 3. 購物車功能

### 雙模式認證說明

購物車的每個端點均支援兩種識別方式：

| 模式 | 識別方式 | 說明 |
|------|---------|------|
| 已登入用戶 | `Authorization: Bearer <token>` | 購物車綁定 `user_id` |
| 未登入訪客 | `X-Session-Id: <uuid>` | 購物車綁定 `session_id` |

兩者皆未提供 → 401。`authMiddleware` **不以 middleware 方式套用**，而是在 handler 內用 try/catch 呼叫 `jwt.verify()`，允許失敗時 fallback 到 sessionId。

---

### GET /api/cart — 查看購物車

**行為描述**：返回當前用戶/訪客購物車中的所有項目，並 JOIN 商品資訊。

**回應格式**：
```json
{
  "data": {
    "items": [
      {
        "id": "cart-item-uuid",
        "product_id": "product-uuid",
        "quantity": 2,
        "product": {
          "name": "粉色玫瑰",
          "price": 299,
          "stock": 50,
          "image_url": "https://..."
        }
      }
    ],
    "total": 598
  },
  "error": null,
  "message": "成功"
}
```

`total` = 每個 item 的 `quantity × product.price` 的總和。

---

### POST /api/cart — 加入商品

**請求 body（必填欄位）**：

| 欄位 | 型別 | 必填 | 驗證規則 |
|------|------|------|--------|
| productId | string | 是 | 商品必須存在 |
| quantity | integer | 是 | 正整數 |

**業務邏輯（累加邏輯）**：
1. 驗證 productId 對應商品是否存在 → 不存在 404
2. 驗證 quantity 為正整數
3. 計算現有購物車中此商品的 quantity + 新增量 → 不能超過 `stock`
4. 查詢購物車中是否已有此商品：
   - **已有**：UPDATE quantity（累加，不是取代）
   - **無**：INSERT 新購物車項目
5. 返回更新後的購物車項目

**庫存檢查範例**：
- 購物車已有 3 個，再加 2 個，庫存 4 → 拒絕（3+2=5 > 4）
- 購物車已有 3 個，再加 1 個，庫存 4 → 允許（3+1=4 ≤ 4）

**錯誤情境**：
- 商品不存在 → 404
- quantity 非正整數 → 400
- 超過庫存 → 422（`message: '庫存不足'`）

---

### PATCH /api/cart/:itemId — 更新數量

**請求 body**：

| 欄位 | 型別 | 必填 | 驗證規則 |
|------|------|------|--------|
| quantity | integer | 是 | 正整數，不能超過庫存 |

**業務邏輯**：
1. 確認 cart_item 存在且屬於當前用戶/session
2. 驗證新 quantity 不超過商品庫存
3. UPDATE cart_items SET quantity = ?

**注意**：不能更新為 0（用 DELETE 移除）。若需清零，必須呼叫 DELETE 端點。

**錯誤情境**：
- 購物車項目不存在或不屬於當前用戶/session → 404
- quantity 超過庫存 → 422

---

### DELETE /api/cart/:itemId — 移除項目

**業務邏輯**：
1. 確認 cart_item 存在且屬於當前用戶/session → 不存在或不屬於則 404
2. DELETE FROM cart_items WHERE id = ?

---

## 4. 訂單功能

### POST /api/orders — 建立訂單

**認證**：JWT 必要（訪客不能建立訂單）

**請求 body（必填欄位）**：

| 欄位 | 型別 | 必填 | 驗證規則 |
|------|------|------|--------|
| recipientName | string | 是 | 非空 |
| recipientEmail | string | 是 | 有效 email 格式 |
| recipientAddress | string | 是 | 非空 |

**業務邏輯（Transaction 確保原子性）**：

```
1. 讀取用戶 cart_items（JOIN products）
2. 若購物車為空 → 400
3. 驗證每件商品庫存充足（quantity <= stock）
4. 計算 totalAmount = Σ(product.price × quantity)
5. 生成訂單號：ORD-YYYYMMDD-{5位大寫亂數}（取 UUID v4 前 5 字元）
6. db.transaction() {
     a. INSERT INTO orders(...)
     b. 對每件商品：INSERT INTO order_items(含快照)
     c. 對每件商品：UPDATE products SET stock = stock - quantity
     d. DELETE FROM cart_items WHERE user_id = ?
   }
```

**快照說明**：`order_items.product_name` 和 `order_items.product_price` 在訂單建立時寫入當下商品資料，不受後續商品編輯影響。

**訂單號格式範例**：`ORD-20260415-A3F2E`

**錯誤情境**：
- 購物車為空 → 400
- 任一商品庫存不足 → 422，`message: '{商品名稱} 庫存不足'`
- recipientEmail 格式錯誤 → 400

**回應**（201）：
```json
{
  "data": {
    "id": "order-uuid",
    "order_no": "ORD-20260415-A3F2E",
    "recipient_name": "王小明",
    "recipient_email": "wang@example.com",
    "recipient_address": "台北市信義路123號",
    "total_amount": 598,
    "status": "pending",
    "items": [
      {
        "product_name": "粉色玫瑰",
        "product_price": 299,
        "quantity": 2
      }
    ],
    "created_at": "2026-04-15T12:00:00.000Z"
  },
  "error": null,
  "message": "訂單建立成功"
}
```

---

### GET /api/orders — 我的訂單列表

**認證**：JWT 必要

**行為描述**：返回當前登入用戶的所有訂單，按建立時間倒序排列。

**回應**：
```json
{
  "data": {
    "orders": [
      {
        "id": "...",
        "order_no": "ORD-...",
        "total_amount": 598,
        "status": "pending",
        "created_at": "..."
      }
    ]
  },
  "error": null,
  "message": "成功"
}
```

---

### GET /api/orders/:id — 訂單詳情

**認證**：JWT 必要

**業務邏輯**：
1. 查詢訂單 → 不存在則 404
2. 確認 `order.user_id === req.user.userId` → 不一致則 404（不透露他人訂單的存在）
3. 查詢 order_items（用快照資料，不 JOIN products）
4. 返回完整訂單資訊含明細

---

### PATCH /api/orders/:id/pay — 模擬付款

**認證**：JWT 必要

**請求 body**：

| 欄位 | 型別 | 必填 | 允許值 |
|------|------|------|--------|
| action | string | 是 | `'success'` 或 `'fail'` |

**業務邏輯**：
1. 查詢訂單並驗證屬於當前用戶
2. 確認訂單狀態為 `pending` → 非 pending 則 422（`message: '訂單狀態不允許此操作'`）
3. `action === 'success'` → `status = 'paid'`
4. `action === 'fail'` → `status = 'failed'`
5. UPDATE orders SET status = ?
6. 返回更新後完整訂單（含 items）

**狀態轉移規則**：

```
pending ─────→ paid
      └──────→ failed
paid/failed → 不允許任何狀態轉移（返回 422）
```

---

## 5. ECPay AIO 金流

> **整合模式**：本地端無法接收 Server-to-Server Notify，付款結果以主動呼叫 `QueryTradeInfo` API 為授信依據。

### POST /api/ecpay/checkout/:orderId — 發起付款

**認證**：JWT 必要

**行為描述**：驗證訂單後，組合綠界 AIO 參數並產生 auto-submit HTML form，瀏覽器收到後自動 POST 至 ECPay 付款頁面。

**前置條件**：
- 訂單必須屬於當前登入用戶
- 訂單 `status` 必須為 `pending`
- 訂單必須有 `ecpay_trade_no`（建立訂單時自動產生）

**AIO 必填參數**：
- `MerchantTradeNo`：= `orders.ecpay_trade_no`（`order_no` 去除 `-`，≤ 20 字元）
- `MerchantTradeDate`：台灣時區 `yyyy/MM/dd HH:mm:ss`
- `TotalAmount`：= `orders.total_amount`
- `ItemName`：商品名稱以 `#` 串接，總長截斷至 400 字元
- `ChoosePayment: Credit`、`EncryptType: 1`（SHA256 CMV）

**錯誤情境**：
- 訂單不存在或不屬於當前用戶 → 404 `NOT_FOUND`
- 訂單 status 非 `pending` → 400 `INVALID_STATUS`
- 訂單缺少 ecpay_trade_no → 400 `NO_TRADE_NO`

---

### POST /api/ecpay/notify — ReturnURL 回呼

**認證**：無（Server-to-Server，由 ECPay 主動呼叫）

**行為描述**：ECPay 付款完成後，以 Server-to-Server POST 通知本伺服器。本地開發環境不會收到此呼叫，但端點必須存在以符合 ECPay 規範。

**業務邏輯**：
1. 以 `verifyCheckMacValue` 驗證簽章
2. `RtnCode === '1'`（付款成功）→ `UPDATE orders SET status = 'paid'`
3. 回傳純文字 `1|OK`（ECPay 規範要求）

---

### POST /api/ecpay/result — OrderResultURL 瀏覽器回呼

**認證**：無（瀏覽器 POST，由 ECPay 頁面導回）

**行為描述**：用戶在 ECPay 付款頁面完成或取消後，ECPay 將瀏覽器 POST 至此端點，伺服器驗證後 redirect 至訂單詳情頁。

**業務邏輯**：
1. 以 `MerchantTradeNo` 查詢對應訂單
2. 以 `verifyCheckMacValue` 驗證簽章 → 失敗 redirect 至 `/orders/:id?payment=failed`
3. `RtnCode === '1'` → `status = 'paid'`，redirect `/orders/:id?payment=success`
4. 其他 RtnCode → `status = 'failed'`，redirect `/orders/:id?payment=failed`

**注意**：此端點的狀態更新為初步更新；前端收到 `?payment=success` query param 後，會再呼叫 `/api/ecpay/query/:orderId` 做最終確認。

---

### GET /api/ecpay/query/:orderId — 主動查詢付款狀態

**認證**：JWT 必要

**行為描述**：前端在 `/orders/:id?payment=*` 載入時自動呼叫此端點，伺服器向 ECPay 發送 `QueryTradeInfo` 請求取得最終付款結果，再更新資料庫並回傳狀態。

**業務邏輯**：
1. 驗證訂單屬於當前用戶
2. 取得 `ecpay_trade_no` → 不存在則 400
3. 組合 `QueryTradeInfo` 參數（`TimeStamp` 每次重新產生，有效期 3 分鐘）
4. POST 至 ECPay QueryTradeInfo API，解析 URL-encoded 回應
5. `TradeStatus === '1'` → `status = 'paid'`，回傳 `{ status: 'paid', tradeInfo }`
6. `TradeStatus === '0'` → 仍為 `pending`，回傳 `{ status: 'pending', tradeInfo }`
7. 其他 → `status = 'failed'`，回傳 `{ status: 'failed', tradeInfo }`

**回應格式**：
```json
{
  "data": {
    "status": "paid",
    "tradeInfo": { "TradeStatus": "1", "TradeAmt": "598", ... }
  },
  "error": null,
  "message": "付款成功"
}
```

**錯誤情境**：
- 訂單不存在或不屬於當前用戶 → 404 `NOT_FOUND`
- 訂單無 ecpay_trade_no → 400 `NO_TRADE_NO`
- QueryTradeInfo 呼叫失敗 → 500 `QUERY_FAILED`

---

## 6. 管理員商品管理

### GET /api/admin/products — 後台商品列表

**認證**：JWT + admin 角色

**查詢參數**：與前台相同（`page`、`limit`）

**與前台差異**：回應格式相同，但此端點需要認證。

---

### POST /api/admin/products — 新增商品

**認證**：JWT + admin 角色

**請求 body**：

| 欄位 | 型別 | 必填 | 驗證規則 |
|------|------|------|--------|
| name | string | 是 | 非空 |
| description | string | 否 | 任意字串 |
| price | integer | 是 | > 0 |
| stock | integer | 是 | >= 0 |
| image_url | string | 否 | 任意字串 |

**業務邏輯**：
1. 驗證必填欄位
2. 生成 UUID 作為商品 ID
3. INSERT 到 products 表
4. 返回新建商品資料（201）

---

### PUT /api/admin/products/:id — 更新商品

**認證**：JWT + admin 角色

**行為描述**：支援部分更新，未傳入的欄位保留原值。

**請求 body**（所有欄位皆選填）：
- `name`：非空字串
- `description`：任意字串（可傳入 null 清空）
- `price`：正整數
- `stock`：非負整數
- `image_url`：任意字串（可傳入 null 清空）

**業務邏輯**：
1. 查詢商品是否存在 → 不存在則 404
2. 合併原有資料與請求 body（`{ ...existingProduct, ...body }`）
3. UPDATE products SET ... WHERE id = ?，同時更新 `updated_at = datetime('now')`

---

### DELETE /api/admin/products/:id — 刪除商品

**認證**：JWT + admin 角色

**業務邏輯**：
1. 查詢商品是否存在 → 不存在則 404
2. 檢查是否有狀態為 `pending` 的訂單包含此商品 → 有則 409
3. DELETE FROM products WHERE id = ?

**錯誤情境**：
- 商品存在於未完成訂單 → 409 `CONFLICT`, `message: '此商品存在於未完成的訂單中，無法刪除'`

---

## 7. 管理員訂單管理

### GET /api/admin/orders — 後台訂單列表

**認證**：JWT + admin 角色

**查詢參數**：

| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| page | integer | 1 | 頁碼 |
| limit | integer | 10 | 每頁筆數 |
| status | string | （全部） | 可選：`pending`、`paid`、`failed` |

**業務邏輯**：
1. 若有 `status` 參數，驗證值為允許值之一
2. 動態組合 WHERE 子句（有 status 時加入篩選）
3. 返回訂單列表 + 分頁資訊

**回應**：
```json
{
  "data": {
    "orders": [
      {
        "id": "...",
        "order_no": "ORD-...",
        "user_id": "...",
        "recipient_name": "...",
        "recipient_email": "...",
        "total_amount": 598,
        "status": "paid",
        "created_at": "..."
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "error": null,
  "message": "成功"
}
```

---

### GET /api/admin/orders/:id — 後台訂單詳情

**認證**：JWT + admin 角色

**與用戶版的差異**：
- 無 `user_id` 擁有權限驗證（管理員可查看任何訂單）
- 回應額外包含 `user` 物件（訂購者資訊）

**回應額外欄位**：
```json
{
  "data": {
    "...（訂單欄位）": "...",
    "items": [ "...（order_items）" ],
    "user": {
      "name": "王小明",
      "email": "wang@example.com"
    }
  }
}
```

---

## 8. 前台頁面功能

| 頁面 | 路由 | 前端 JS | 認證處理 |
|------|------|---------|---------|
| 商品首頁 | `/` | index.js | 無 |
| 商品詳情 | `/products/:id` | product-detail.js | 無 |
| 購物車 | `/cart` | cart.js | 無 |
| 結帳 | `/checkout` | checkout.js | `Auth.requireAuth()` 重導向 `/login` |
| 登入/註冊 | `/login` | login.js | 已登入則重導向 `/` |
| 訂單列表 | `/orders` | orders.js | `Auth.requireAuth()` 重導向 `/login` |
| 訂單詳情 | `/orders/:id` | order-detail.js | `Auth.requireAuth()` 重導向 `/login` |
| 後台商品管理 | `/admin/products` | admin-products.js | `Auth.requireAdmin()` 重導向 `/login` |
| 後台訂單管理 | `/admin/orders` | admin-orders.js | `Auth.requireAdmin()` 重導向 `/login` |
| 404 | `*` | 無 | 無 |

> 認證由前端 JavaScript 在 Vue 應用掛載前執行，非伺服器端 middleware 控制。
