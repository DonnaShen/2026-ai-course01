const crypto = require('crypto');

const STAGE_BASE_URL = 'https://payment-stage.ecpay.com.tw';
const PROD_BASE_URL = 'https://payment.ecpay.com.tw';

function getBaseUrl(env) {
  return env === 'production' ? PROD_BASE_URL : STAGE_BASE_URL;
}

/**
 * ECPay 專用 URL encode（對應 PHP urlencode + .NET 特殊字元替換）
 * 參考：guides/13-checkmacvalue.md
 */
function ecpayUrlEncode(source) {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
  encoded = encoded.toLowerCase();
  // 還原 .NET 不編碼的 7 個字元
  const restore = { '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!', '%2a': '*', '%28': '(', '%29': ')' };
  for (const [old, char] of Object.entries(restore)) {
    encoded = encoded.split(old).join(char);
  }
  return encoded;
}

/**
 * 計算 CheckMacValue（SHA256）
 * 流程：過濾 CheckMacValue → key 不分大小寫字典序排序 → 拼 HashKey/IV → ecpayUrlEncode → SHA256 → toUpperCase
 */
function generateCheckMacValue(params, hashKey, hashIv) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );
  const sorted = Object.keys(filtered).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  const paramStr = sorted.map(k => `${k}=${filtered[k]}`).join('&');
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIv}`;
  const encoded = ecpayUrlEncode(raw);
  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

/**
 * timing-safe 驗證 CheckMacValue（防止 timing attack）
 */
function verifyCheckMacValue(params, hashKey, hashIv) {
  const received = params.CheckMacValue || '';
  const expected = generateCheckMacValue(params, hashKey, hashIv);
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * 回傳 AIO auto-submit HTML form
 * 瀏覽器收到後會立即 POST 至 ECPay 付款頁
 */
function buildAioFormHtml(params, actionUrl) {
  const fields = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`)
    .join('\n    ');
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>付款中，請稍候...</title></head>
<body>
  <p style="font-family:sans-serif;text-align:center;margin-top:80px">正在跳轉至付款頁面，請稍候...</p>
  <form id="ecpay-form" method="POST" action="${actionUrl}">
    ${fields}
  </form>
  <script>document.getElementById('ecpay-form').submit();</script>
</body>
</html>`;
}

/**
 * 呼叫 ECPay QueryTradeInfo/V5 主動查詢付款狀態
 * TimeStamp 有效期 3 分鐘，每次呼叫重新產生
 * 回傳：URL-encoded 字串解析後的物件（含 TradeStatus、TradeNo、PaymentDate 等）
 */
async function queryTradeInfo(merchantTradeNo, config) {
  const baseUrl = getBaseUrl(config.env);
  const params = {
    MerchantID: config.merchantId,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: String(Math.floor(Date.now() / 1000)),
  };
  params.CheckMacValue = generateCheckMacValue(params, config.hashKey, config.hashIv);

  const body = new URLSearchParams(params).toString();
  const response = await fetch(`${baseUrl}/Cashier/QueryTradeInfo/V5`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await response.text();
  return Object.fromEntries(new URLSearchParams(text));
}

module.exports = {
  getBaseUrl,
  generateCheckMacValue,
  verifyCheckMacValue,
  buildAioFormHtml,
  queryTradeInfo,
};
