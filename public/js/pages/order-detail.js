const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    if (!Auth.requireAuth()) return {};

    const el = document.getElementById('app');
    const orderId = el.dataset.orderId;
    const paymentResult = ref(el.dataset.paymentResult || null);

    const order = ref(null);
    const loading = ref(true);
    const paying = ref(false);
    const querying = ref(false);

    const statusMap = {
      pending: { label: '待付款', cls: 'bg-apricot/20 text-apricot' },
      paid: { label: '已付款', cls: 'bg-sage/20 text-sage' },
      failed: { label: '付款失敗', cls: 'bg-red-100 text-red-600' },
    };

    const paymentMessages = {
      success: { text: '付款成功！感謝您的購買。', cls: 'bg-sage/10 text-sage border border-sage/20' },
      failed: { text: '付款失敗，請重試。', cls: 'bg-red-50 text-red-600 border border-red-100' },
      cancel: { text: '付款已取消。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
    };

    /** 呼叫 QueryTradeInfo API 確認付款結果（本地端核心驗證機制） */
    async function queryPaymentStatus() {
      if (querying.value) return;
      querying.value = true;
      try {
        const res = await apiFetch('/api/ecpay/query/' + orderId);
        if (res.data) {
          order.value = { ...order.value, status: res.data.status };
          paymentResult.value = res.data.status === 'paid' ? 'success' : 'failed';
        }
      } catch (e) {
        Notification.show('查詢付款狀態失敗，請稍後再試', 'error');
      } finally {
        querying.value = false;
      }
    }

    /** 前往綠界 AIO 付款頁（取得 auto-submit HTML 後替換頁面） */
    async function goToPayment() {
      if (!order.value || paying.value) return;
      paying.value = true;
      try {
        const res = await fetch('/api/ecpay/checkout/' + order.value.id, {
          method: 'POST',
          headers: Auth.getAuthHeaders(),
        });
        if (!res.ok) {
          const data = await res.json();
          Notification.show(data.message || '無法前往付款頁面', 'error');
          paying.value = false;
          return;
        }
        const html = await res.text();
        document.open();
        document.write(html);
        document.close();
      } catch (e) {
        Notification.show('無法前往付款頁面，請稍後再試', 'error');
        paying.value = false;
      }
    }

    onMounted(async function () {
      try {
        const res = await apiFetch('/api/orders/' + orderId);
        order.value = res.data;
      } catch (e) {
        Notification.show('載入訂單失敗', 'error');
      } finally {
        loading.value = false;
      }

      // ECPay 付款後導回此頁，自動觸發 QueryTradeInfo 確認結果
      if (el.dataset.paymentResult) {
        await queryPaymentStatus();
      }
    });

    return {
      order, loading, paying, querying,
      paymentResult, statusMap, paymentMessages,
      goToPayment, queryPaymentStatus,
    };
  }
}).mount('#app');
