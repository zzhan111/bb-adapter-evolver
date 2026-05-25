/* @meta
{
  "name": "ysbang/select-best-add",
  "description": "先按有效期区间筛选当前搜索结果页，再选择最优商品加入购物车",
  "domain": "dian2.ysbang.cn",
  "args": {
    "keyword": {"required": true, "description": "搜索关键词"},
    "range": {"required": true, "description": "有效期区间：6m-1y、1y+（1年以上）、1y-1.5y、1.5y-2y、2y+"},
    "strategy": {"required": false, "description": "选品策略，当前支持 best-price"},
    "quantity": {"required": false, "description": "加入购物车数量，默认 1"}
  },
  "capabilities": ["dom", "network"],
  "readOnly": false,
  "example": "bb-browser site ysbang/select-best-add --keyword \"阿莫西林\" --range \"1y+\" --strategy best-price --quantity 1 --json"
}
*/

async function(args) {
  const { keyword, range, strategy = 'best-price', quantity = 1 } = args;
  const HOME_URL = 'https://dian2.ysbang.cn/#/home';
  const RANGE_MAP = {
    '6m-1y':   { label: '6个月-1年',   minDays: 183, maxDays: 365      },
    '6mo-1y':  { label: '6个月-1年',   minDays: 183, maxDays: 365      },
    '1y+':     { label: '1年以上',     minDays: 365, maxDays: Infinity  },
    'over-1y': { label: '1年以上',     minDays: 365, maxDays: Infinity  },
    '1y-1.5y': { label: '1年-1年半',   minDays: 365, maxDays: 548      },
    '1y-18m':  { label: '1年-1年半',   minDays: 365, maxDays: 548      },
    '1.5y-2y': { label: '1年半-2年',   minDays: 548, maxDays: 730      },
    '18m-2y':  { label: '1年半-2年',   minDays: 548, maxDays: 730      },
    '2y+':     { label: '2年以上',     minDays: 730, maxDays: Infinity  },
    'over-2y': { label: '2年以上',     minDays: 730, maxDays: Infinity  },
  };

  // bb-browser may pass null for optional args; don't rely on destructuring default for null
  const effectiveStrategy = strategy || 'best-price';

  if (!keyword) return { error: '请提供搜索关键词' };
  if (!range) return { error: '请提供有效期区间' };

  const rangeConfig = RANGE_MAP[String(range).trim()];
  if (!rangeConfig) {
    return { error: '不支持的有效期区间', supportedRanges: Object.keys(RANGE_MAP) };
  }

  if (effectiveStrategy !== 'best-price') {
    return { error: '当前仅支持 best-price 策略' };
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitFor(predicate, timeoutMs, intervalMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const result = predicate();
      if (result) return result;
      await delay(intervalMs);
    }
    return null;
  }

  function visible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity || 1) !== 0
      && rect.width > 0
      && rect.height > 0;
  }

  function parseHashQuery() {
    const hash = location.hash || '';
    const queryIndex = hash.indexOf('?');
    return new URLSearchParams(queryIndex === -1 ? '' : hash.slice(queryIndex + 1));
  }

  function currentKeywordFromPage() {
    return (parseHashQuery().get('searchkey') || '').trim();
  }

  function isResultPage() {
    return /#\/indexContent(?:$|\?)/.test(location.href) && !!document.querySelector('.drugListPage');
  }

  function parsePrice(text) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    const currencyMatch = normalized.match(/[¥￥]\s*([0-9]+(?:\.[0-9]+)?)/);
    if (currencyMatch) return Number(currencyMatch[1]);
    const genericMatch = normalized.match(/([0-9]+(?:\.[0-9]+)?)/);
    return genericMatch ? Number(genericMatch[1]) : null;
  }

  function parseExpriationDate(text) {
    const match = String(text || '').match(/有效期\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
    if (!match) return null;
    const date = new Date(match[1] + 'T00:00:00+08:00');
    return Number.isNaN(date.getTime()) ? null : match[1];
  }

  function daysUntil(dateText) {
    if (!dateText) return null;
    const today = new Date();
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const target = new Date(dateText + 'T00:00:00+08:00');
    return Math.floor((target.getTime() - current.getTime()) / (24 * 60 * 60 * 1000));
  }

  function extractSummary() {
    const bodyText = document.body?.innerText || '';
    const totalMatch = bodyText.match(/共\s*([0-9,]+)\s*个商品/);
    const pageMatch = bodyText.match(/([0-9]+)\s*\/\s*([0-9]+)/);
    const totalPagesMatch = bodyText.match(/共\s*([0-9,]+)\s*页/);
    return {
      totalMatchedProducts: totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : null,
      currentPage: pageMatch ? Number(pageMatch[1]) : 1,
      totalPages: totalPagesMatch
        ? Number(totalPagesMatch[1].replace(/,/g, ''))
        : (pageMatch ? Number(pageMatch[2]) : null)
    };
  }

  function extractProductFromCard(card, cardIndex) {
    const fullText = (card.textContent || '').replace(/\s+/g, ' ').trim();
    const vm = card.__vue__;
    const goodsInfo = vm?._props?.goodsInfo || vm?._setupState?.props?.goodsInfo || null;
    const name = card.querySelector('.goods-name span')?.textContent?.trim()
      || card.querySelector('.goods-name')?.textContent?.trim()
      || goodsInfo?.drugname
      || '';
    if (!name) return null;

    const priceText = ((card.querySelector('.goods-price-all') || card).textContent || '').replace(/\s+/g, ' ').trim();
    const expriationDate = parseExpriationDate(fullText);

    // Detect group-buy-only items: check if 加入购物车 button actually exists
    const hasAddButton = !!([...card.querySelectorAll('button, .cart-btn, .goods-operate, div, span')]
      .find(el => visible(el) && /加入购物车/.test((el.textContent || '').replace(/\s+/g, ' ').trim())));
    const isGroupBuyOnly = /拼\s*团/.test(fullText) && !hasAddButton;

    return {
      wholesaleId: goodsInfo?.wholesaleid || goodsInfo?.wholesaleId || null,
      drugId: goodsInfo?.drugid || goodsInfo?.drugId || null,
      name,
      spec: goodsInfo?.spec || '',
      manufacturer: goodsInfo?.factory || card.querySelector('.goods-manufacturer')?.textContent?.trim() || '',
      providerName: goodsInfo?.provider_name || goodsInfo?.providername || goodsInfo?.providerName || '',
      price: priceText,
      priceValue: parsePrice(priceText),
      expriationDate: goodsInfo?.valid_date || expriationDate,
      remainingDays: daysUntil(goodsInfo?.valid_date || expriationDate),
      minAmount: goodsInfo?.minamount || null,
      isGroupBuyOnly,
      cardIndex
    };
  }

  function extractRenderedProducts() {
    return [...document.querySelectorAll('.all-goods-wrapper')]
      .map((card, index) => extractProductFromCard(card, index))
      .filter(Boolean);
  }

  async function ensureSearchContext() {
    const onMatchingResultPage = isResultPage() && currentKeywordFromPage() === keyword;
    if (onMatchingResultPage) {
      await waitFor(() => extractRenderedProducts().length > 0, 20000, 300);
      return { sourceUsed: 'current-result-page' };
    }

    let searchInput = document.getElementById('searchKey');
    if (!searchInput) {
      if (!/dian2\.ysbang\.cn/.test(location.host) || !/#\/(?:home|indexContent)(?:$|\?)/.test(location.href)) {
        location.href = HOME_URL;
      }
      searchInput = await waitFor(() => document.getElementById('searchKey'), 8000, 200);
    }

    if (!searchInput) return { error: '找不到搜索框 (#searchKey)' };

    // Extract search term: remove trailing spec like "36片", "6s*2板", etc.
    // Keep brand + product name like "乐药师 三黄片", "复方氨酚烷胺胶囊"
    let searchTerm = keyword;
    const parts = keyword.trim().split(/\s+/);
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      // Check if last part looks like a spec: starts with digit or contains only quantity units
      const looksLikeSpec = /^\d/.test(last) || /^[箱片粒袋盒瓶丸]+$/.test(last) || /[*×sS]\d/.test(last);
      if (looksLikeSpec) {
        searchTerm = parts.slice(0, -1).join(' ');
      }
    }

    searchInput.focus();
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.value = searchTerm;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));

    const searchBtn = document.querySelector('.search-btn');
    if (!searchBtn) return { error: '找不到搜索按钮 (.search-btn)' };

    searchBtn.click();
    await waitFor(() => isResultPage(), 8000, 200);
    await delay(1000);
    await waitFor(() => extractRenderedProducts().length > 0, 25000, 200);
    await delay(1000);

    return { sourceUsed: 'search-result-page' };
  }

  function inRange(product) {
    if (product.isGroupBuyOnly) return false;
    if (product.remainingDays == null) return false;
    return product.remainingDays >= rangeConfig.minDays && product.remainingDays < rangeConfig.maxDays;
  }

  // Returns top-N sorted candidates (best-price first) for retry
  function selectBestList(products, maxN = 5) {
    return [...products]
      .filter((item) => item.priceValue != null)
      .sort((a, b) => {
        if (a.priceValue !== b.priceValue) return a.priceValue - b.priceValue;
        if ((a.remainingDays || 0) !== (b.remainingDays || 0)) return (b.remainingDays || 0) - (a.remainingDays || 0);
        return String(a.name).localeCompare(String(b.name), 'zh-CN');
      })
      .slice(0, maxN);
  }

  function findAddButton(card) {
    if (!card) return null;
    const direct = card.querySelector('button.cart-btn, .goods-operate .cart-btn, .goods-operate button');
    if (visible(direct)) return direct;

    return [...card.querySelectorAll('button, .cart-btn, .goods-operate, div, span')]
      .find((el) => visible(el) && /加入购物车/.test((el.textContent || '').replace(/\s+/g, ' ').trim())) || null;
  }

  async function addViaDom(cardIndex) {
    const card = document.querySelectorAll('.all-goods-wrapper')[cardIndex] || null;
    const addButton = findAddButton(card);
    if (!addButton) {
      return { error: '未找到加入购物车按钮' };
    }

    addButton.click();
    const confirmation = await waitFor(() => {
      const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
      const cardText = (card.textContent || '').replace(/\s+/g, ' ').trim();

      // Check for error messages first (拼团 / 加入失败 / etc)
      if (/拼\s*团|无法加入|加入失败|不支持|购物车失败/.test(bodyText)) {
        return {
          receiveState: 'error',
          message: bodyText.match(/拼\s*团商品[^。，]*|无法加入[^。，]*|加入失败[^。，]*|不支持[^。，]*/)?.[0] || '加入购物车失败'
        };
      }

      if (/加入购物车成功|成功加入购物车/.test(bodyText)) {
        return {
          receiveState: 'toast-success',
          message: bodyText.match(/加入购物车成功!?|成功加入购物车/)?.[0] || '加入购物车成功'
        };
      }

      if (!/加入购物车/.test(cardText)) {
        return {
          receiveState: 'card-updated',
          message: '点击后商品卡片已更新'
        };
      }

      return null;
    }, 4000, 100);

    if (!confirmation) {
      return { error: '点击加入购物车后未收到成功确认' };
    }

    // If DOM method detected an error, treat it as failure
    if (confirmation.receiveState === 'error') {
      return { error: confirmation.message };
    }

    return confirmation;
  }

  const context = await ensureSearchContext();
  if (context?.error) return context;

  const summary = extractSummary();
  const renderedProducts = extractRenderedProducts();

  // Detailed failure analysis
  const groupBuyCount = renderedProducts.filter(p => p.isGroupBuyOnly).length;
  const noExpiryCount = renderedProducts.filter(p => !p.isGroupBuyOnly && p.remainingDays == null).length;
  const expiryOutOfRange = renderedProducts.filter(p => {
    if (p.isGroupBuyOnly || p.remainingDays == null) return false;
    return p.remainingDays < rangeConfig.minDays || p.remainingDays >= rangeConfig.maxDays;
  }).length;

  const filteredProducts = renderedProducts.filter(inRange);
  const noPriceCount = filteredProducts.filter(p => p.priceValue == null).length;
  const candidates = selectBestList(filteredProducts);

  if (!candidates.length) {
    const analysis = {
      totalMatched: summary.totalMatchedProducts,
      rendered: renderedProducts.length,
      groupBuyOnly: groupBuyCount,
      noExpiryData: noExpiryCount,
      expiryOutOfRange: expiryOutOfRange,
      noPriceData: noPriceCount,
      candidates: candidates.length
    };

    // Build human-readable reason
    const reasons = [];
    if (renderedProducts.length === 0) {
      reasons.push(summary.totalMatchedProducts > 0 ? `搜索有${summary.totalMatchedProducts}条结果但无法渲染` : '搜索无结果');
    } else {
      if (groupBuyCount > 0) reasons.push(`${groupBuyCount}个拼团商品`);
      if (expiryOutOfRange > 0) reasons.push(`${expiryOutOfRange}个有效期不符(需${rangeConfig.label})`);
      if (noExpiryCount > 0) reasons.push(`${noExpiryCount}个缺少有效期数据`);
      if (noPriceCount > 0) reasons.push(`${noPriceCount}个缺少价格信息`);
    }
    const reasonStr = reasons.length > 0 ? reasons.join(' + ') : `渲染${renderedProducts.length}个商品但均无法加购`;

    return {
      success: false,
      reason: 'no-candidates',
      message: reasonStr,
      keyword,
      requestedRange: String(range).trim(),
      appliedRange: rangeConfig.label,
      analysis,
      sourceUsed: context.sourceUsed
    };
  }

  const safeQuantity = Math.max(1, Math.min(9999, parseInt(quantity, 10) || 1));
  let lastError = null;

  for (const selected of candidates) {
    let cart;
    let addMethod = 'dom-click';

    if (selected.wholesaleId) {
      addMethod = 'api';
      const resp = await fetch('https://dian2.ysbang.cn/shopping-cart/cart/joinShoppingCart/v4190', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*'
        },
        credentials: 'include',
        body: JSON.stringify({
          wholesaleId: Number(selected.wholesaleId),
          amount: safeQuantity,
          freeDeliveryTagId: 0,
          platform: 'pc',
          version: '6.0.0',
          ua: 'Chrome146',
          trafficType: 0
        })
      });

      if (!resp.ok) {
        lastError = 'HTTP ' + resp.status;
        continue;
      }

      const data = await resp.json();
      if (data.code !== 0 && data.code !== '0' && data.code !== 40001 && data.code !== '40001') {
        lastError = data.message || '加入购物车失败';
        continue;
      }

      // Check message for group-buy or other business errors even if code=0
      if (data.message && /拼\s*团|无法加入|加入失败|不支持/.test(data.message)) {
        lastError = data.message;
        continue;
      }

      cart = {
        message: data.message || '添加成功',
        cartId: data.data?.cartId || null
      };
    } else {
      const domResult = await addViaDom(selected.cardIndex);
      if (domResult?.error) {
        lastError = domResult.error;
        continue;
      }

      cart = {
        message: domResult.message,
        cartId: null,
        receiveState: domResult.receiveState
      };
    }

    return {
      success: true,
      keyword,
      requestedRange: String(range).trim(),
      appliedRange: rangeConfig.label,
      strategy: effectiveStrategy,
      quantity: safeQuantity,
      totalMatchedProducts: summary.totalMatchedProducts,
      renderedProductCount: renderedProducts.length,
      filteredRenderedProductCount: filteredProducts.length,
      candidatesCount: candidates.length,
      selected,
      cart,
      addMethod,
      sourceUsed: context.sourceUsed
    };
  }

  return {
    success: false,
    reason: 'all-candidates-failed',
    message: lastError || '所有候选商品均添加失败',
    keyword,
    requestedRange: String(range).trim(),
    appliedRange: rangeConfig.label,
    candidatesAttempted: candidates.length,
    sourceUsed: context.sourceUsed
  };
}
