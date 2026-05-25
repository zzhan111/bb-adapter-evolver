/* @meta
{
  "name": "ysbang/cart-update",
  "description": "修改药师帮购物车商品数量",
  "domain": "dian2.ysbang.cn",
  "args": {
    "wholesaleId": {"required": true, "description": "商品批发 ID"},
    "quantity": {"required": true, "description": "目标数量"},
    "isChosen": {"required": false, "description": "是否选中（默认 2）"}
  },
  "capabilities": ["network"],
  "readOnly": false,
  "example": "bb-browser site ysbang/cart-update --wholesaleId 123 --quantity 5 --json"
}
*/

const HOME_URL = 'https://dian2.ysbang.cn';

async function(args) {
  const { wholesaleId, quantity, isChosen = 2 } = args;

  if (!wholesaleId) {
    return {
      error: '请提供商品 wholesaleId',
      hint: '💡 使用 cart-list 查看购物车商品并获取 wholesaleId:\n   bb-browser site ysbang/cart-list --json'
    };
  }

  const normalizedWholesaleId = String(wholesaleId).trim();
  if (!/^\d+$/.test(normalizedWholesaleId)) {
    return { error: '批发ID格式无效' };
  }

  function safeParseInt(value, fallback, min, max) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
  }

  const safeQuantity = safeParseInt(quantity, 1, 1, 9999);
  const safeIsChosen = safeParseInt(isChosen, 2, 0, 2);

  if (safeQuantity < 1) {
    return { error: '请提供有效的数量（至少1）' };
  }

  try {
    let result;
    let versionUsed = 'v4190';

    // 传统API调用（降级方案）
    const API_BASE = 'https://dian2.ysbang.cn';
    const resp = await fetch(API_BASE + '/shopping-cart/cart/updateDrugAmount/v4190', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cartModifyList: [{
          wholesaleId: parseInt(normalizedWholesaleId, 10),
          drugAmount: safeQuantity,
          isChosen: safeIsChosen
        }],
        platform: 'pc',
        version: '6.0.0',
        ua: 'Chrome146',
        trafficType: 0
      })
    });

    if (!resp.ok) {
      return {
        error: 'HTTP ' + resp.status,
        hint: '请检查网络连接',
        version: versionUsed
      };
    }

    const data = await resp.json();

    if (data.code !== 0 && data.code !== '0' && data.code !== 40001 && data.code !== '40001') {
      return {
        error: '更新失败：' + (data.message || '未知错误'),
        code: data.code,
        version: versionUsed
      };
    }

    return {
      success: true,
      message: '更新成功',
      wholesaleId: normalizedWholesaleId,
      quantity: safeQuantity,
      metadata: {
        version: versionUsed,
        endpoint: 'cart-update',
        fallback: true
      }
    };

  } catch (e) {
    return {
      error: e.message,
      hint: '网络请求失败，请检查网络连接'
    };
  }
}
