/* @meta
{
  "name": "ysbang/checkout",
  "description": "药师帮结算页操作（获取结算信息或创建订单）",
  "domain": "dian2.ysbang.cn",
  "args": {
    "action": {"required": false, "description": "操作类型：info 获取结算信息/create 创建订单"},
    "addressId": {"required": false, "description": "收货地址 ID（创建订单时必填）"}
  },
  "capabilities": ["network"],
  "readOnly": false,
  "example": "bb-browser site ysbang/checkout --action info --json"
}
*/

async function(args) {
  const API_BASE = 'https://dian2.ysbang.cn';
  const { action = 'info', addressId } = args;
  
  if (action === 'info') {
    // 获取结算信息 - 需要浏览器上下文，API 直接调用可能失败
    // 尝试 API 调用
    let data;
    try {
      data = await (await fetch(API_BASE + '/order-ysb/api/order/getOrderInfo/v5280', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'pc',
        version: '6.0.0',
        ua: 'Chrome146',
        trafficType: 0
      })
    })).json();
    
    } catch (e) {
      data = { code: -1, message: 'API 调用失败' };
    }
    
    if (!data || (data.code !== 0 && data.code !== '0' && data.code !== 40001 && data.code !== '40001')) {
      return { 
        error: '获取结算信息失败：需要浏览器上下文',
        hint: '💡 请在浏览器中打开结算页面查看：https://dian2.ysbang.cn/#/orderConfirm'
      };
    }
    
    return {
      success: true,
      message: '获取结算信息成功',
      data: data.data
    };
  }
  
  if (action === 'create') {
    return {
      success: false,
      message: '创建订单功能请使用 order-create adapter',
      hint: 'bb-browser site ysbang/order-create --providerName "供应商名称" --json'
    };
  }
  
  return { error: '未知操作：' + action };
}
