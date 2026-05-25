/* @meta
{
  "name": "ysbang/switch-store",
  "description": "通过 joinDrugStore 接口切换当前操作药店",
  "domain": "dian2.ysbang.cn",
  "args": {
    "storeId": {"required": true, "description": "目标药店 ID"},
    "timeout": {"required": false, "description": "超时时间（秒），默认 30"}
  },
  "capabilities": ["network"],
  "readOnly": false,
  "example": "bb-browser site ysbang/switch-store --storeId 2818407 --timeout 30 --openclaw"
}
*/

async function(args) {
  const API_BASE = 'https://dian2.ysbang.cn';
  const { storeId, timeout = 30 } = args || {};
  const timeoutMs = Number(timeout) > 0 ? Number(timeout) * 1000 : 30000;
  const startedAt = Date.now();
  const CURRENT_STORE_CACHE_KEY = '__ysbang_current_store_cache__';

  if (!storeId) {
    return { error: '请提供药店 storeId' };
  }

  const targetStoreId = Number(storeId);
  if (!Number.isFinite(targetStoreId) || targetStoreId <= 0) {
    return { error: 'storeId 必须是有效数字' };
  }

  function elapsed() {
    return Date.now() - startedAt;
  }

  function assertTimeout(step) {
    if (elapsed() > timeoutMs) {
      throw new Error(`${step} 超时`);
    }
  }

  async function postJson(path, body) {
    const response = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${path}`);
    }

    return await response.json();
  }

  function isSuccessCode(code) {
    return code === 0 || code === '0' || code === 40001 || code === '40001';
  }

  function buildCommonPayload(extra = {}) {
    return {
      platform: 'pc',
      version: '6.0.0',
      ua: navigator.userAgent,
      trafficType: 0,
      ...extra
    };
  }

  function readCurrentStoreCache() {
    try {
      const raw = localStorage.getItem(CURRENT_STORE_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeCurrentStoreCache(value) {
    try {
      localStorage.setItem(CURRENT_STORE_CACHE_KEY, JSON.stringify(value));
    } catch (_) {
      // ignore cache failures
    }
  }

  try {
    assertTimeout('步骤 1');
    const listBefore = await postJson(
      '/ysb-user/api/store/getUserHistoryWholesaleStore/v5330',
      buildCommonPayload()
    );

    if (!isSuccessCode(listBefore.code)) {
      return {
        error: '获取药店列表失败：' + (listBefore.message || JSON.stringify(listBefore)),
        elapsed: elapsed()
      };
    }

    const storeInfos = Array.isArray(listBefore.data?.storeInfos) ? listBefore.data.storeInfos : [];
    const currentStore = listBefore.data?.storeName || '';
    const currentStoreCache = readCurrentStoreCache();
    const targetStore = storeInfos.find((store) => Number(store.storeid) === targetStoreId)
      || (currentStoreCache && Number(currentStoreCache.id) === targetStoreId ? {
        storeid: currentStoreCache.id,
        storetitle: currentStoreCache.name,
        address: currentStoreCache.address || '',
        userName: currentStoreCache.userName || ''
      } : null);

    if (!targetStore) {
      return {
        error: '未找到目标药店',
        targetStoreId,
        currentStore,
        availableStores: storeInfos.map((store) => ({
          id: store.storeid,
          name: store.storetitle
        })),
        elapsed: elapsed()
      };
    }

    if (currentStore && currentStore === targetStore.storetitle) {
      writeCurrentStoreCache({
        id: targetStoreId,
        name: currentStore,
        address: targetStore.address || '',
        userName: targetStore.userName || ''
      });
      return {
        success: true,
        message: '已是当前药店，无需切换',
        storeId: targetStoreId,
        currentStore,
        elapsed: elapsed()
      };
    }

    assertTimeout('步骤 2');
    const switchResult = await postJson(
      '/ysb-user/api/store/joinDrugStore/v5260',
      buildCommonPayload({
        operationType: 1,
        userName: targetStore.userName || '',
        storeInfo: {
          storeId: targetStoreId,
          address: targetStore.address || '',
          storeTitle: targetStore.storetitle || ''
        }
      })
    );

    if (!isSuccessCode(switchResult.code)) {
      return {
        error: '切换药店失败：' + (switchResult.message || JSON.stringify(switchResult)),
        targetStoreId,
        elapsed: elapsed()
      };
    }

    assertTimeout('步骤 3');
    const listAfter = await postJson(
      '/ysb-user/api/store/getUserHistoryWholesaleStore/v5330',
      buildCommonPayload()
    );

    if (!isSuccessCode(listAfter.code)) {
      return {
        success: true,
        message: '切换药店成功，但回读校验失败',
        storeId: targetStoreId,
        fromStore: currentStore,
        toStore: {
          id: targetStore.storeid,
          name: targetStore.storetitle,
          address: targetStore.address || ''
        },
        switchResult,
        verifyWarning: listAfter.message || '回读列表失败',
        elapsed: elapsed()
      };
    }

    const verifiedCurrentStore = listAfter.data?.storeName || '';
    const currentUserInfo = switchResult?.data?.userInfo || {};
    writeCurrentStoreCache({
      id: currentUserInfo.drugstoreid || targetStoreId,
      name: currentUserInfo.storetitle || verifiedCurrentStore || targetStore.storetitle || '',
      address: currentUserInfo.address || targetStore.address || '',
      userName: currentUserInfo.username || targetStore.userName || ''
    });

    return {
      success: true,
      message: verifiedCurrentStore === targetStore.storetitle
        ? '切换药店成功'
        : '切换请求已提交，请刷新页面确认',
      storeId: targetStoreId,
      fromStore: currentStore,
      toStore: {
        id: targetStore.storeid,
        name: targetStore.storetitle,
        address: targetStore.address || ''
      },
      verifiedCurrentStore,
      switchResult,
      elapsed: elapsed()
    };
  } catch (error) {
    return {
      error: error.message || '切换药店失败',
      targetStoreId,
      elapsed: elapsed(),
      timeout: timeoutMs
    };
  }
}
