/* @meta
{
  "name": "ysbang/store-select",
  "description": "通过药店名称切换当前操作药店（完整浏览器自动化流程）",
  "domain": "dian2.ysbang.cn",
  "args": {
    "name": {"required": true, "description": "药店名称（支持模糊匹配）"},
    "timeout": {"required": false, "description": "超时时间（秒），默认 60"}
  },
  "capabilities": ["browser"],
  "readOnly": false,
  "example": "bb-browser site ysbang/store-select --name '第一分公司' --timeout 60 --openclaw"
}
*/

async function(args) {
  const API_BASE = 'https://dian2.ysbang.cn';
  const { name, timeout = 60 } = args;
  const startTime = Date.now();
  const timeoutMs = timeout * 1000;
  
  if (!name) {
    return { error: '请提供药店名称 (name 参数)' };
  }
  
  // ========== 步骤 1: 获取药店列表 ==========
  if (Date.now() - startTime > timeoutMs) {
    return { error: '步骤 1 超时', elapsed: Date.now() - startTime, timeout: timeoutMs };
  }
  
  const listData = await (await fetch(API_BASE + '/ysb-user/api/store/getUserHistoryWholesaleStore/v5330', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: 'pc',
      version: '6.0.0',
      ua: 'Chrome146',
      trafficType: 0
    })
  })).json();
  
  if (listData.code !== '40001' && listData.code !== 40001) {
    return { 
      error: '步骤 1 失败：获取药店列表失败',
      message: listData.message,
      elapsed: Date.now() - startTime
    };
  }
  
  const storeInfos = Array.isArray(listData.data?.storeInfos) ? listData.data.storeInfos : [];
  const currentStore = listData.data?.storeName || '';
  
  if (storeInfos.length === 0) {
    return { error: '步骤 1 失败：账号下没有可切换的药店', elapsed: Date.now() - startTime };
  }
  
  // ========== 步骤 2: 查找匹配的药店 ==========
  if (Date.now() - startTime > timeoutMs) {
    return { error: '步骤 2 超时', elapsed: Date.now() - startTime, timeout: timeoutMs };
  }
  
  const matched = storeInfos.filter(s => s.storetitle && s.storetitle.includes(name));
  
  if (matched.length === 0) {
    const allNames = storeInfos.map(s => s.storetitle).join(', ');
    return { 
      error: '步骤 2 失败：未找到匹配的药店',
      hint: `可用药店：${allNames}`,
      elapsed: Date.now() - startTime
    };
  }
  
  if (matched.length > 1) {
    const names = matched.map(s => `${s.storetitle} (ID: ${s.storeid})`).join(', ');
    return {
      error: '步骤 2 失败：找到多个匹配的药店',
      hint: `匹配结果：${names}`,
      elapsed: Date.now() - startTime
    };
  }
  
  const targetStore = matched[0];
  
  // 检查是否已经是当前药店
  if (currentStore === targetStore.storetitle) {
    return {
      success: true,
      message: '已是当前药店，无需切换',
      currentStore: currentStore,
      elapsed: Date.now() - startTime
    };
  }
  
  // ========== 步骤 3: 浏览器自动化 - 点击切换药店按钮 ==========
  if (Date.now() - startTime > timeoutMs) {
    return { error: '步骤 3 超时', elapsed: Date.now() - startTime, timeout: timeoutMs };
  }
  
  const clickScript = `
    (function() {
      const elements = document.querySelectorAll('div, span, li, p, button, a');
      for (const el of elements) {
        const text = el.textContent || '';
        if (text.includes('切换药店')) {
          el.click();
          return { success: true, step: 'clicked_switch_button' };
        }
      }
      return { success: false, error: '未找到切换药店按钮' };
    })()
  `;
  
  let clickResult;
  try {
    clickResult = eval(clickScript);
  } catch (e) {
    clickResult = { success: false, error: e.message };
  }
  
  if (!clickResult.success) {
    return { 
      error: '步骤 3 失败：' + clickResult.error,
      elapsed: Date.now() - startTime
    };
  }
  
  // ========== 步骤 4: 等待弹出框并点击目标药店 ==========
  if (Date.now() - startTime > timeoutMs) {
    return { error: '步骤 4 超时', elapsed: Date.now() - startTime, timeout: timeoutMs };
  }
  
  // 等待 500ms 让弹出框出现
  const waitStart = Date.now();
  while (Date.now() - waitStart < 500) { /* 空转 */ }
  
  const selectScript = `
    (function() {
      const targetName = '${targetStore.storetitle}';
      const elements = document.querySelectorAll('div, span, li');
      for (const el of elements) {
        const text = el.textContent || '';
        if (text.includes(targetName) && text.length < 100) {
          el.click();
          return { success: true, step: 'clicked_store', name: targetName };
        }
      }
      return { success: false, error: '未找到目标药店元素' };
    })()
  `;
  
  let selectResult;
  try {
    selectResult = eval(selectScript);
  } catch (e) {
    selectResult = { success: false, error: e.message };
  }
  
  if (!selectResult.success) {
    return { 
      error: '步骤 4 失败：' + selectResult.error,
      elapsed: Date.now() - startTime
    };
  }
  
  // ========== 步骤 5: 点击确认按钮并等待 API 响应 ==========
  if (Date.now() - startTime > timeoutMs) {
    return { error: '步骤 5 超时', elapsed: Date.now() - startTime, timeout: timeoutMs };
  }
  
  // 等待 500ms 确保弹出框完全渲染
  const wait2Start = Date.now();
  while (Date.now() - wait2Start < 500) { /* 空转 */ }
  
  // 使用更精确的选择器找到确认按钮
  const confirmScript = `
    (function() {
      // 查找包含"确认"文本的按钮，优先查找弹出框中的
      const allElements = document.querySelectorAll('button, span, div');
      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        if (text === '确认' || text.includes('确认')) {
          // 检查是否在弹出框附近（通常弹出框会有特定的样式或位置）
          const rect = el.getBoundingClientRect();
          if (rect.top > 100 && rect.top < 500) {  // 弹出框通常在页面中间
            el.click();
            return { success: true, step: 'clicked_confirm', tagName: el.tagName };
          }
        }
      }
      // 如果没找到，尝试点击第一个"确认"按钮
      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        if (text === '确认') {
          el.click();
          return { success: true, step: 'clicked_confirm_fallback', tagName: el.tagName };
        }
      }
      return { success: false, error: '未找到确认按钮' };
    })()
  `;
  
  let confirmResult;
  try {
    confirmResult = eval(confirmScript);
  } catch (e) {
    confirmResult = { success: false, error: e.message };
  }
  
  if (!confirmResult.success) {
    return { 
      error: '步骤 5 失败：' + confirmResult.error,
      elapsed: Date.now() - startTime
    };
  }
  
  // ========== 步骤 6: 等待切换完成 ==========
  if (Date.now() - startTime > timeoutMs) {
    return { error: '步骤 6 超时', elapsed: Date.now() - startTime, timeout: timeoutMs };
  }
  
  // 等待 1500ms 让后端处理
  const wait3Start = Date.now();
  while (Date.now() - wait3Start < 1500) { /* 空转 */ }
  
  const totalTime = Date.now() - startTime;
  
  return {
    success: true,
    message: '门店切换完成（请刷新页面验证）',
    fromStore: currentStore,
    toStore: {
      id: targetStore.storeid,
      name: targetStore.storetitle,
      address: targetStore.address
    },
    steps: {
      1: '获取药店列表 ✓',
      2: '查找目标药店 ✓',
      3: '点击切换药店按钮 ✓',
      4: '选择目标药店 ✓',
      5: '点击确认 ✓',
      6: '等待处理完成 ✓'
    },
    totalTime: totalTime + 'ms',
    timeout: timeoutMs + 'ms',
    hint: '切换操作已执行，请手动刷新页面确认'
  };
}
