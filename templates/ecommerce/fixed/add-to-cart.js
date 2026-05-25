/* @meta
{
  "name": "ysbang/add-to-cart",
  "description": "将药品加入购物车",
  "domain": "dian2.ysbang.cn",
  "args": {
    "wholesaleId": {"required": true, "description": "批发 ID"},
    "quantity": {"required": false, "description": "数量，默认 1"}
  },
  "capabilities": ["network"],
  "readOnly": false,
  "example": "bb-browser site ysbang/add-to-cart --wholesaleId 12345 --quantity 10 --openclaw"
}
*/

async function(args) {
  const { wholesaleId, drugId, quantity = 1 } = args;

  const id = Number(wholesaleId || drugId);
  if (!id || Number.isNaN(id)) {
    return { error: '请提供商品 wholesaleId 或 drugId' };
  }

  const safeQuantity = Math.max(1, Math.min(9999, parseInt(quantity, 10) || 1));

  try {
    const API_BASE = 'https://dian2.ysbang.cn';
    const resp = await fetch(API_BASE + '/shopping-cart/cart/joinShoppingCart/v4190', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      credentials: 'include',
      body: JSON.stringify({
        wholesaleId: id,
        amount: safeQuantity,
        freeDeliveryTagId: 0,
        platform: 'pc',
        version: '6.0.0',
        ua: 'Chrome146',
        trafficType: 0
      })
    });

    if (!resp.ok) {
      return {
        error: 'HTTP ' + resp.status,
        hint: '请检查网络连接'
      };
    }

    const data = await resp.json();

    if (data.code !== 0 && data.code !== '0' && data.code !== 40001 && data.code !== '40001') {
      return {
        error: '添加失败：' + (data.message || '未知错误'),
        code: data.code
      };
    }

    return {
      success: true,
      message: data.message || '添加成功',
      cartId: data.data?.cartId,
      wholesaleId: id,
      quantity: safeQuantity,
      metadata: {
        version: 'v4190',
        endpoint: 'joinShoppingCart/v4190'
      }
    };

  } catch (e) {
    return {
      error: e.message,
      hint: '网络请求失败，请检查网络连接'
    };
  }
}
