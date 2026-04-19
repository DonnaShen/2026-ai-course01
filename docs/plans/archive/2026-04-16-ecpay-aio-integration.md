# 計畫：串接 ECPay AIO 金流（本地查詢模式）

## Context

專案已有完整結帳流程，但付款按鈕為模擬操作。本計畫以 ECPay AIO（全方位金流）取代，並因本地端無法接收 Server Notify，改用 `QueryTradeInfo` API 主動查詢付款結果作為授信依據。

---

## 付款流程

```
建立訂單 → 訂單詳情頁點「前往付款」
  → POST /api/ecpay/checkout/:orderId（附 Bearer token）
  → 伺服器回傳 auto-submit HTML form → 瀏覽器自動 POST 至 ECPay
  → 使用者於 ECPay 付款
  → ECPay POST 結果至 /api/ecpay/result（OrderResultURL）
  → 伺服器 redirect 至 /orders/:orderId?paymentResult=<rtnCode>
  → 頁面偵測到 paymentResult query param → 自動呼叫 GET /api/ecpay/query/:orderId
  → 伺服器呼叫 QueryTradeInfo → 更新 orders.status → 頁面顯示最終結果
```

---

## 異動檔案

### 1. 新建 `src/ecpay.js` — 工具函式

- `ecpayUrlEncode(str)` — Node.js 版 ECPay URL encode（`%20→+`、`~→%7e`、`'→%27`、還原 7 個不編碼字元）
- `generateCheckMacValue(params, hashKey, hashIv)` — SHA256 CMV 計算（過濾 CheckMacValue → key 不分大小寫排序 → 拼 HashKey/IV → ecpayUrlEncode → SHA256 → toUpperCase）
- `verifyCheckMacValue(params, hashKey, hashIv)` — timing-safe 驗證（先比長度）
- `buildAioFormHtml(params, actionUrl)` — 回傳含 hidden inputs 的 auto-submit HTML
- `queryTradeInfo(merchantTradeNo, config)` — 呼叫 `/Cashier/QueryTradeInfo/V5`，TimeStamp 每次重新產生（有效期 3 分鐘），回傳 URL-encoded 解析物件

### 2. 新建 `src/routes/ecpayRoutes.js` — 4 個端點

| 端點 | 說明 |
|---|---|
| `POST /api/ecpay/checkout/:orderId` | 需 authMiddleware；驗證訂單屬於該 user 且 status='pending'；組 AIO 參數→生成 CMV→回傳 auto-submit HTML |
| `POST /api/ecpay/notify` | ReturnURL（本地不會被呼叫）；驗證 CMV 後回傳純文字 `1\|OK` |
| `POST /api/ecpay/result` | OrderResultURL（瀏覽器 redirect）；驗證 CMV；依 RtnCode 更新 orders.status；redirect 至 `/orders/:id?paymentResult=<rtnCode>` |
| `GET /api/ecpay/query/:orderId` | 需 authMiddleware；呼叫 QueryTradeInfo；TradeStatus==='1' 則更新 status='paid'；回傳 `{ data: { status, tradeInfo }, ... }` |

**AIO 必填參數**：
```
MerchantID, MerchantTradeNo (= ecpay_trade_no), MerchantTradeDate (yyyy/MM/dd HH:mm:ss, 台灣時間)
PaymentType=aio, TotalAmount, TradeDesc=花卉電商訂單
ItemName (商品名以 # 串接, 總長≤400)
ReturnURL=/api/ecpay/notify, OrderResultURL=/api/ecpay/result
ChoosePayment=Credit, EncryptType=1
```

### 3. 修改 `src/database.js`

在 `initializeDatabase()` 呼叫之後加 migration：
```javascript
try { db.exec('ALTER TABLE orders ADD COLUMN ecpay_trade_no TEXT'); } catch (_) {}
```

### 4. 修改 `src/routes/orderRoutes.js`

在建立訂單時（第 134-142 行），產生 `ecpay_trade_no` 並存入 DB：
```javascript
const ecpayTradeNo = orderNo.replace(/-/g, ''); // "ORD20260416ABC12" ≤20 字元
// INSERT INTO orders 加入 ecpay_trade_no 欄位與值
```

### 5. 修改 `app.js`

在第 34 行之後加：
```javascript
app.use('/api/ecpay', require('./src/routes/ecpayRoutes'));
```

### 6. 修改 `views/pages/order-detail.ejs`

- 第 74-89 行：移除「付款成功」/「付款失敗」模擬按鈕
- 新增：`v-if="order.status === 'pending'"` 的「前往付款」按鈕（`@click="goToPayment"`）
- 新增：`v-if="querying"` 的查詢中 spinner

### 7. 修改 `public/js/pages/order-detail.js`

- 移除 `simulatePay`、`handlePaySuccess`、`handlePayFail`
- 新增 `querying` ref
- 新增 `goToPayment()` — fetch POST `/api/ecpay/checkout/:orderId`（帶 Authorization header）→ 取回 HTML → `document.open(); document.write(html); document.close()`
- 新增 `queryPaymentStatus()` — fetch GET `/api/ecpay/query/:orderId` → 更新 `order.value.status`
- `onMounted` 中：若 URL 含 `paymentResult` query param，自動呼叫 `queryPaymentStatus()`

---

## 環境變數

`.env` 已有完整 ECPay staging 設定，無需異動：
```
ECPAY_MERCHANT_ID=3002607
ECPAY_HASH_KEY=pwFHCqoQZGmho4w6
ECPAY_HASH_IV=EkRm7iFT261dpevs
ECPAY_ENV=staging
BASE_URL=http://localhost:3001
```

---

## 關鍵設計決策

- **ecpay_trade_no** = order_no 去除 `-`（如 `ORD20260416ABC12`，16 字元，≤20 限制）
- **不依賴 ReturnURL**：Server Notify 在本地無法接收，付款結果以 QueryTradeInfo 為準
- **OrderResultURL** 做 POST handler 接收瀏覽器 redirect，驗證後再 redirect 至訂單頁
- **TradeDesc** 為純文字（不自行 urlencode，CMV 計算時 `ecpayUrlEncode` 統一處理）
- **ItemName** 組合 order items（`#` 分隔，截斷至 400 字元）

---

## 測試步驟

1. `npm run dev:server`，登入後加商品至購物車
2. 結帳 → 建立訂單 → 訂單詳情頁出現「前往付款」按鈕
3. 點擊 → 應跳轉至 ECPay staging 付款頁
4. 測試信用卡：`4311-9522-2222-2222`，到期：任意未來日，CVV：`222`，3DS：`1234`
5. 付款完成 → 重導回訂單頁，自動查詢 → status 變為「已付款」
6. 確認 DB 中 `orders.status = 'paid'`
