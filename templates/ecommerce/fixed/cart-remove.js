/* @meta
{
  "name": "ysbang/cart-remove",
  "description": "删除药师帮购物车中的商品",
  "domain": "dian2.ysbang.cn",
  "args": {
    "wholesaleId":  {"required": false, "description": "单个商品批发 ID"},
    "wholesaleIds": {"required": false, "description": "商品批发 ID 数组（批量删除）"}
  },
  "capabilities": ["network"],
  "readOnly": false,
  "example": "bb-browser site ysbang/cart-remove --wholesaleId 123 --json"
}
*/

async function(args) {
  const { wholesaleId, wholesaleIds } = args;

  let ids = [];
  if (wholesaleIds && Array.isArray(wholesaleIds)) {
    ids = wholesaleIds;
  } else if (wholesaleId) {
    ids = [wholesaleId];
  }

  if (ids.length === 0) {
    return {
      error: '请提供商品 wholesaleId 或 wholesaleIds 数组',
      hint: '使用 cart-list 查看购物车商品并获取 wholesaleId'
    };
  }

  const safeIds = ids.map(id => Number(id)).filter(id => id > 0);
  if (safeIds.length === 0) {
    return { error: '包含无效的批发ID' };
  }

  // Get token from cookie
  const cookies = document.cookie.split(';');
  let token = null;
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'Token' || name === 'token') {
      token = value;
      break;
    }
  }

  try {
    const resp = await fetch('https://dian2.ysbang.cn/shopping-cart/cart/deleteDrug/v4190', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
      credentials: 'include',
      body: JSON.stringify({
        wholesaleIds: safeIds,
        invalidWholesaleIds: [],
        platform: 'pc',
        version: '6.0.0',
        ua: 'Chrome146',
        trafficType: 0,
        token: token
      })
    });

    if (!resp.ok) {
      return { error: 'HTTP ' + resp.status, hint: '请检查网络连接' };
    }

    const data = await resp.json();

    if (data.code !== 0 && data.code !== '0' && data.code !== 40001 && data.code !== '40001') {
      return {
        error: '删除失败：' + (data.message || '未知错误'),
        code: data.code
      };
    }

    return {
      success: true,
      message: '删除成功',
      wholesaleIds: safeIds
    };

  } catch (e) {
    return { error: e.message, hint: '网络请求失败，请检查网络连接' };
  }
}
