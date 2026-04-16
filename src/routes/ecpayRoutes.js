const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getBaseUrl,
  generateCheckMacValue,
  verifyCheckMacValue,
  buildAioFormHtml,
  queryTradeInfo,
} = require('../ecpay');

const router = express.Router();

const ecpayConfig = {
  merchantId: process.env.ECPAY_MERCHANT_ID,
  hashKey: process.env.ECPAY_HASH_KEY,
  hashIv: process.env.ECPAY_HASH_IV,
  env: process.env.ECPAY_ENV || 'staging',
};

/** 格式化台灣時間為 ECPay 要求的 yyyy/MM/dd HH:mm:ss */
function formatTradeDate() {
  const now = new Date();
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${tw.getUTCFullYear()}/${pad(tw.getUTCMonth() + 1)}/${pad(tw.getUTCDate())} ` +
    `${pad(tw.getUTCHours())}:${pad(tw.getUTCMinutes())}:${pad(tw.getUTCSeconds())}`;
}

/**
 * POST /api/ecpay/checkout/:orderId
 * 產生 AIO auto-submit form，導向綠界付款頁
 */
router.post('/checkout/:orderId', authMiddleware, (req, res) => {
  const { orderId } = req.params;
  const userId = req.user.userId;

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '找不到訂單' });
  }
  if (order.status !== 'pending') {
    return res.status(400).json({ data: null, error: 'INVALID_STATUS', message: '訂單狀態不允許付款' });
  }
  if (!order.ecpay_trade_no) {
    return res.status(400).json({ data: null, error: 'NO_TRADE_NO', message: '訂單缺少付款編號' });
  }

  // 組合 ItemName（商品名以 # 串接，總長不超過 400 字元）
  const items = db.prepare('SELECT product_name, quantity FROM order_items WHERE order_id = ?').all(orderId);
  let itemName = items.map(i => `${i.product_name} x${i.quantity}`).join('#');
  if (itemName.length > 400) itemName = itemName.substring(0, 397) + '...';

  const serverBaseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const baseUrl = getBaseUrl(ecpayConfig.env);

  const params = {
    MerchantID: ecpayConfig.merchantId,
    MerchantTradeNo: order.ecpay_trade_no,
    MerchantTradeDate: formatTradeDate(),
    PaymentType: 'aio',
    TotalAmount: String(order.total_amount),
    TradeDesc: '花卉電商訂單',
    ItemName: itemName,
    ReturnURL: `${serverBaseUrl}/api/ecpay/notify`,
    OrderResultURL: `${serverBaseUrl}/api/ecpay/result`,
    ChoosePayment: 'Credit',
    EncryptType: '1',
  };

  params.CheckMacValue = generateCheckMacValue(params, ecpayConfig.hashKey, ecpayConfig.hashIv);

  const html = buildAioFormHtml(params, `${baseUrl}/Cashier/AioCheckOut/V5`);
  res.type('html').send(html);
});

/**
 * POST /api/ecpay/notify
 * ReturnURL（Server-to-Server）：本地端不會被呼叫，但 ECPay 必填
 * 必須回傳純文字 "1|OK"
 */
router.post('/notify', (req, res) => {
  const params = { ...req.body };
  if (verifyCheckMacValue(params, ecpayConfig.hashKey, ecpayConfig.hashIv)) {
    const { MerchantTradeNo, RtnCode } = params;
    if (MerchantTradeNo && RtnCode === '1') {
      db.prepare("UPDATE orders SET status = 'paid' WHERE ecpay_trade_no = ?").run(MerchantTradeNo);
    }
  }
  res.type('text/plain').send('1|OK');
});

/**
 * POST /api/ecpay/result
 * OrderResultURL：瀏覽器付款後導回此端點
 * 驗證 CMV 後 redirect 至訂單頁（帶 paymentResult query param）
 */
router.post('/result', (req, res) => {
  const params = { ...req.body };
  const { MerchantTradeNo, RtnCode } = params;

  if (!MerchantTradeNo) {
    return res.redirect('/orders?error=invalid_response');
  }

  const order = db.prepare('SELECT id FROM orders WHERE ecpay_trade_no = ?').get(MerchantTradeNo);
  if (!order) {
    return res.redirect('/orders?error=order_not_found');
  }

  if (!verifyCheckMacValue(params, ecpayConfig.hashKey, ecpayConfig.hashIv)) {
    return res.redirect(`/orders/${order.id}?payment=failed`);
  }

  // 先依 RtnCode 更新狀態（QueryTradeInfo 會再次確認）
  if (RtnCode === '1') {
    db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(order.id);
    return res.redirect(`/orders/${order.id}?payment=success`);
  } else {
    db.prepare("UPDATE orders SET status = 'failed' WHERE id = ?").run(order.id);
    return res.redirect(`/orders/${order.id}?payment=failed`);
  }
});

/**
 * GET /api/ecpay/query/:orderId
 * 主動呼叫 QueryTradeInfo 確認付款狀態（本地端核心驗證機制）
 */
router.get('/query/:orderId', authMiddleware, async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user.userId;

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '找不到訂單' });
  }
  if (!order.ecpay_trade_no) {
    return res.status(400).json({ data: null, error: 'NO_TRADE_NO', message: '尚未建立付款' });
  }

  try {
    const tradeInfo = await queryTradeInfo(order.ecpay_trade_no, ecpayConfig);

    if (tradeInfo.TradeStatus === '1') {
      db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(orderId);
      return res.json({
        data: { status: 'paid', tradeInfo },
        error: null,
        message: '付款成功',
      });
    }

    // TradeStatus !== '1'：未付款或交易異常
    const currentStatus = tradeInfo.TradeStatus === '0' ? 'pending' : 'failed';
    if (currentStatus === 'failed') {
      db.prepare("UPDATE orders SET status = 'failed' WHERE id = ?").run(orderId);
    }
    return res.json({
      data: { status: currentStatus, tradeInfo },
      error: null,
      message: currentStatus === 'pending' ? '尚未完成付款' : '付款失敗',
    });
  } catch (err) {
    return res.status(500).json({
      data: null,
      error: 'QUERY_FAILED',
      message: '查詢付款狀態失敗，請稍後再試',
    });
  }
});

module.exports = router;
