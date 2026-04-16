# TESTING.md

## 測試框架與工具

| 工具 | 版本 | 用途 |
|------|------|------|
| Vitest | ^2.1.9 | 測試執行器、斷言庫 |
| Supertest | ^7.2.2 | HTTP API 整合測試 |

**測試類型**：整合測試（直接對 Express app 發送 HTTP 請求，使用真實 SQLite 資料庫）

---

## 測試檔案表

| 檔案 | 測試數 | 涵蓋範圍 |
|------|--------|---------|
| tests/setup.js | — | 共用工具函式，非獨立測試 |
| tests/auth.test.js | 6 | 註冊、登入、個人資料、認證失敗 |
| tests/products.test.js | 4 | 商品列表分頁、商品詳情、404 |
| tests/cart.test.js | 6 | 訪客購物車 CRUD、用戶購物車、商品不存在 |
| tests/orders.test.js | 6 | 建立訂單、空購物車、未認證、訂單查詢 |
| tests/adminProducts.test.js | 6 | Admin CRUD、權限檢查 |
| tests/adminOrders.test.js | 4 | Admin 訂單列表、狀態篩選、詳情含用戶 |
| **合計** | **32** | |

---

## 執行指令

```bash
# 執行全部測試（約 1.6 秒）
npm test

# 監看模式（開發時）
npx vitest

# 執行特定測試檔案
npx vitest run tests/auth.test.js
npx vitest run tests/cart.test.js
```

---

## 測試執行順序

`vitest.config.js` 定義了固定的執行順序（因為測試之間有資料依賴）：

```javascript
// vitest.config.js
export default {
  test: {
    sequence: {
      files: [
        'tests/auth.test.js',
        'tests/products.test.js',
        'tests/cart.test.js',
        'tests/orders.test.js',
        'tests/adminProducts.test.js',
        'tests/adminOrders.test.js',
      ]
    }
  }
}
```

**為何需要固定順序**：
- `orders.test.js` 需要有商品在購物車，依賴 `cart.test.js` 可能的狀態（但實際上各測試使用新的用戶，購物車是獨立的）
- `adminOrders.test.js` 依賴 `orders.test.js` 建立的訂單（或使用 setup 中獨立建立）

---

## 測試工具函式（tests/setup.js）

### `app`

```javascript
import app from '../app.js'
```

導出 Express app 實例，供 Supertest 發送請求。

---

### `getAdminToken()`

```javascript
async function getAdminToken(): Promise<string>
```

使用預設 admin 帳號（`admin@hexschool.com` / `12345678`）登入並返回 JWT token。

**用途**：在需要 admin 認證的測試中使用。

```javascript
const adminToken = await getAdminToken()
const res = await request(app)
  .get('/api/admin/products')
  .set('Authorization', `Bearer ${adminToken}`)
```

---

### `registerUser(overrides?)`

```javascript
async function registerUser(overrides?: Partial<UserData>): Promise<{
  token: string,
  user: User
}>
```

生成隨機 email（避免衝突），註冊新用戶並返回 token 和用戶資訊。

**預設值**：
- email: `test-{uuid}@test.com`
- password: `password123`
- name: `Test User`

**用途**：在需要一般用戶認證的測試中使用，確保每次測試使用不同帳號。

```javascript
const { token, user } = await registerUser()
const res = await request(app)
  .get('/api/orders')
  .set('Authorization', `Bearer ${token}`)
```

---

## 各測試檔案詳細說明

### tests/auth.test.js

| 測試名稱 | 期望 HTTP Code | 測試要點 |
|---------|--------------|---------|
| 應該成功註冊新用戶 | 201 | 返回 token 和用戶資訊 |
| 重複 email 應返回 409 | 409 | 先註冊一次，再用同 email 再註冊 |
| 應該成功登入 | 200 | 密碼正確，返回 token |
| 錯誤密碼應返回 401 | 401 | `message: '帳號或密碼錯誤'` |
| 應該取得個人資料 | 200 | 帶有效 token，返回用戶資料 |
| 無 token 應返回 401 | 401 | 不帶 Authorization header |

---

### tests/products.test.js

| 測試名稱 | 期望 HTTP Code | 測試要點 |
|---------|--------------|---------|
| 應該取得商品列表 | 200 | 確認返回陣列且有 pagination |
| 分頁應正常運作 | 200 | ?page=1&limit=2，totalPages 正確 |
| 應該取得商品詳情 | 200 | 先取列表，再用第一個 id 查詳情 |
| 不存在商品應返回 404 | 404 | 使用 non-existent-id |

---

### tests/cart.test.js

| 測試名稱 | 期望 HTTP Code | 測試要點 |
|---------|--------------|---------|
| 訪客應能加入購物車 | 200 | 用 X-Session-Id header |
| 訪客應能查看購物車 | 200 | items 不為空，total 正確 |
| 訪客應能更新數量 | 200 | PATCH 後 quantity 變更 |
| 訪客應能移除項目 | 200 | DELETE 後購物車為空 |
| 已登入用戶應能加入購物車 | 200 | 用 Authorization header |
| 不存在商品應返回 404 | 404 | productId 使用 fake-id |

---

### tests/orders.test.js

| 測試名稱 | 期望 HTTP Code | 測試要點 |
|---------|--------------|---------|
| 應能從購物車建立訂單 | 201 | 先加商品到購物車，再建立訂單 |
| 空購物車應返回 400 | 400 | 未加商品直接建立訂單 |
| 未認證應返回 401 | 401 | 不帶 token 建立訂單 |
| 應能取得訂單列表 | 200 | 返回陣列 |
| 應能取得訂單詳情 | 200 | 含 items 陣列 |
| 不存在訂單應返回 404 | 404 | 使用 fake-order-id |

---

### tests/adminProducts.test.js

| 測試名稱 | 期望 HTTP Code | 測試要點 |
|---------|--------------|---------|
| Admin 應能取得商品列表 | 200 | 用 adminToken |
| Admin 應能建立商品 | 201 | POST 新商品，返回建立的商品 |
| Admin 應能更新商品 | 200 | PUT 更新名稱或價格 |
| Admin 應能刪除商品 | 200 | DELETE，確認 message |
| 一般用戶應無法訪問 | 403 | 用普通用戶 token |
| 無 token 應返回 401 | 401 | 不帶 Authorization header |

---

### tests/adminOrders.test.js

| 測試名稱 | 期望 HTTP Code | 測試要點 |
|---------|--------------|---------|
| Admin 應能取得訂單列表 | 200 | 返回 orders 陣列 + pagination |
| 應能依狀態篩選訂單 | 200 | ?status=pending，所有返回的訂單 status 皆為 pending |
| Admin 應能取得訂單詳情 | 200 | 含 items 和 user 物件 |
| 一般用戶應無法訪問 | 403 | 用普通用戶 token |

---

## 撰寫新測試的步驟與範例

### 步驟

1. 在 `tests/` 目錄建立 `yourFeature.test.js`
2. 在 `vitest.config.js` 的 `sequence.files` 陣列中加入檔案路徑（維持順序）
3. 使用以下模板：

```javascript
// tests/yourFeature.test.js
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { app, getAdminToken, registerUser } from './setup.js'

describe('Your Feature', () => {
  let adminToken
  let userToken
  let userId

  beforeAll(async () => {
    adminToken = await getAdminToken()
    const { token, user } = await registerUser()
    userToken = token
    userId = user.id
  })

  it('應該成功執行某操作', async () => {
    const res = await request(app)
      .post('/api/your-endpoint')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ key: 'value' })

    expect(res.status).toBe(200)
    expect(res.body.error).toBeNull()
    expect(res.body.data).toBeDefined()
    expect(res.body.message).toBe('成功')
  })

  it('應該在未認證時返回 401', async () => {
    const res = await request(app)
      .get('/api/your-endpoint')

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('UNAUTHORIZED')
  })
})
```

### 訪客模式測試範例

```javascript
it('訪客應能使用 Session ID 操作', async () => {
  const sessionId = 'test-session-' + Date.now()

  const res = await request(app)
    .post('/api/cart')
    .set('X-Session-Id', sessionId)
    .send({ productId: existingProductId, quantity: 1 })

  expect(res.status).toBe(200)
})
```

---

## 常見陷阱

### 1. Email 衝突

**問題**：多個測試使用相同 email 註冊會導致 409。

**解法**：使用 `registerUser()` 工具函式，它每次生成帶隨機 UUID 的 email。

---

### 2. 測試資料庫污染

**問題**：測試使用真實 SQLite（`database.sqlite`），不同測試執行後遺留的資料可能影響後續測試。

**現狀**：目前測試未清理資料庫，依賴資料的唯一性或使用獨立的識別符（如新建的用戶 ID）來隔離測試。

**注意**：若測試失敗且資料庫狀態不符預期，可刪除 `database.sqlite` 重新初始化：

```bash
rm database.sqlite database.sqlite-shm database.sqlite-wal
npm run dev:server  # 重新啟動會自動建立並植入預設資料
```

---

### 3. 需要購物車中有商品才能測試訂單

**問題**：`POST /api/orders` 需要購物車非空。

**解法**：在 `beforeAll` 或測試開始時先呼叫 `POST /api/cart` 加入商品：

```javascript
beforeAll(async () => {
  // 先加商品到購物車
  await request(app)
    .post('/api/cart')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ productId: knownProductId, quantity: 1 })
})
```

---

### 4. bcrypt 在測試中的效能

**問題**：生產環境 bcrypt salt rounds = 10，在測試中每次 `registerUser()` 都會雜湊密碼，可能使測試變慢。

**現況**：`setup.js` 在測試環境中將 salt rounds 設為 1（`process.env.NODE_ENV === 'test'`），大幅加速測試執行。

---

### 5. 管理員商品刪除後影響後續測試

**問題**：`adminProducts.test.js` 會刪除商品，若後續測試依賴這些商品 ID 會失敗。

**解法**：`adminProducts.test.js` 應建立並刪除**新商品**，不要對預設的 8 個花卉商品執行刪除。
