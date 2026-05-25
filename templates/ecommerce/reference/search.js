/* @meta
{
  "name": "ysbang/search",
  "description": "Keyword + structured filters → product list with pagination",
  "domain": "dian2.ysbang.cn",
  "args": {
    "keyword": {
      "required": true,
      "description": "Search keyword. Can be a product name, generic name, or UPC (69...)."
    },
    "factory": {
      "required": false,
      "description": "Manufacturer / factory filter"
    },
    "provider": {
      "required": false,
      "description": "Supplier / provider filter"
    },
    "minPrice": {
      "required": false,
      "description": "Minimum price (numeric, without currency symbol)"
    },
    "maxPrice": {
      "required": false,
      "description": "Maximum price (numeric, without currency symbol)"
    },
    "range": {
      "required": false,
      "description": "Expiration date range (e.g. '1y+', '6m-1y', '1.5y-2y')"
    },
    "freeShipping": {
      "required": false,
      "description": "Filter for free shipping (group buy) items"
    },
    "page": {
      "required": false,
      "description": "Page number, default 1"
    }
  },
  "capabilities": ["dom", "network"],
  "readOnly": true,
  "example": "bb-browser site ysbang/search --keyword \"阿莫西林\" --json"
}
*/

async function(args) {
  // === URL constants (must be within first 50 lines) ===
  const HOME_URL = 'https://dian2.ysbang.cn/#/home';
  const API_BASE = (typeof location !== 'undefined' && location && location.origin && location.origin !== 'null')
    ? location.origin
    : 'https://dian2.ysbang.cn';
  const AUTO_COMPLETE_ENDPOINT = `${API_BASE}/wholesale-drug/sales/autoComplete/v5185`;

  // === Helper functions ===
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitFor(predicate, timeoutMs, intervalMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const result = predicate();
      if (result) {
        return result;
      }
      await delay(intervalMs);
    }
    return null;
  }

  function normalize(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compact(text) {
    return normalize(text).replace(/\s+/g, '');
  }

  function uniqueStrings(items) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
      const value = normalize(item);
      if (!value || seen.has(value)) {
        continue;
      }
      seen.add(value);
      result.push(value);
    }
    return result;
  }

  function parseUpc(text) {
    const normalized = compact(text);
    return /^69\d+$/.test(normalized) ? normalized : '';
  }

  function parsePrice(text) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    const currencyMatch = normalized.match(/[¥￥]\s*([0-9]+(?:\.[0-9]+)?)/);
    if (currencyMatch) {
      return Number(currencyMatch[1]);
    }
    const genericMatch = normalized.match(/([0-9]+(?:\.[0-9]+)?)/);
    return genericMatch ? Number(genericMatch[1]) : null;
  }

  function visible(el) {
    if (!el) {
      return false;
    }
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity || 1) !== 0
      && rect.width > 0
      && rect.height > 0;
  }

  // === Input validation ===
  const keyword = args?.keyword ?? '';
  const factory = args?.factory ?? '';
  const provider = args?.provider ?? '';
  const minPrice = args?.minPrice ?? '';
  const maxPrice = args?.maxPrice ?? '';
  const range = args?.range ?? '';
  const freeShipping = args?.freeShipping ?? '';
  const page = args?.page ?? 1;

  if (!keyword) {
    return {
      success: false,
      error: 'Missing required argument: keyword',
      hint: 'Please provide a search keyword (product name, generic name, or UPC).',
      action: '',
      input: args,
      data: null,
      pagination: null,
      recommendedNextActions: []
    };
  }

  // === Parse keyword ===
  const parsedUpc = parseUpc(keyword);
  const searchKeyword = parsedUpc ? parsedUpc : normalize(keyword);

  // === Auto-complete suggestions (network) ===
  let suggestions = [];
  try {
    const response = await fetch(AUTO_COMPLETE_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*'
      },
      body: JSON.stringify({
        platform: 'pc',
        version: '6.0.0',
        ua: 'Chrome146',
        trafficType: 0,
        timestamp: Date.now(),
        searchkey: searchKeyword,
        provider_id: '',
        page: 1,
        operationtype: 1
      })
    });
    if (response.ok) {
      const payload = await response.json();
      suggestions = uniqueStrings(Array.isArray(payload?.data?.keys) ? payload.data.keys : []);
    }
  } catch (error) {
    // silent fail on suggestion errors
  }

  // === DOM interaction: perform search ===
  let searchInput = document.getElementById('searchKey');
  if (!searchInput) {
    if (!/dian2\.ysbang\.cn/.test(location.host) || !/#\/home(?:$|\?)/.test(location.href)) {
      location.href = HOME_URL;
    }
    searchInput = await waitFor(() => document.getElementById('searchKey'), 8000, 200);
  }
  if (!searchInput) {
    return {
      success: false,
      error: 'Search input not found (#searchKey)',
      hint: 'Make sure you are on the ysbang home page.',
      action: `bb-browser open ${HOME_URL}`,
      input: args,
      data: null,
      pagination: null,
      recommendedNextActions: []
    };
  }

  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  searchInput.value = searchKeyword;
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  searchInput.dispatchEvent(new Event('change', { bubbles: true }));

  const searchBtn = document.querySelector('.search-btn');
  if (!searchBtn) {
    return {
      success: false,
      error: 'Search button not found (.search-btn)',
      hint: 'The page may have changed.',
      action: '',
      input: args,
      data: null,
      pagination: null,
      recommendedNextActions: []
    };
  }
  searchBtn.click();
  // Phase 1: Wait for old home-page cards (no .goods-name span) to disappear
  await waitFor(() => {
    const cards = document.querySelectorAll('.all-goods-wrapper');
    return cards.length === 0;
  }, 5000, 100);
  // Phase 2: Wait for search result cards to appear (cards with .goods-name span)
  await waitFor(() => {
    const cards = document.querySelectorAll('.all-goods-wrapper');
    if (cards.length === 0) return false;
    return !!cards[0].querySelector('.goods-name span');
  }, 10000, 200);
  // Phase 3: Wait for card count to stabilize (no new cards for 500ms)
  let stableCount = 0;
  let lastCardCount = -1;
  while (stableCount < 3) {
    await delay(500);
    const currentCount = document.querySelectorAll('.all-goods-wrapper').length;
    if (currentCount === lastCardCount && currentCount > 0) {
      stableCount++;
    } else {
      stableCount = 0;
    }
    lastCardCount = currentCount;
  }

  // === Extract products from DOM ===
  const productCards = [...document.querySelectorAll('.all-goods-wrapper')];
  const visibleProductCards = productCards.filter(visible);
  const allProducts = [];

  productCards.forEach((card) => {
    const vm = card.__vue__;
    const goodsInfo = vm?._props?.goodsInfo || vm?._setupState?.props?.goodsInfo || null;
    const nameEl = card.querySelector('.goods-name span');
    const name = nameEl ? nameEl.textContent.trim() : '';
    if (!name) {
      return;
    }

    const priceText = ((card.querySelector('.goods-price-all') || card).textContent || '').replace(/\s+/g, ' ').trim();
    const manufacturerEl = card.querySelector('.goods-manufacturer');
    const manufacturer = manufacturerEl ? manufacturerEl.textContent.trim() : '';
    const imgEl = card.querySelector('img');
    const image = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';
    const wholesaleId = goodsInfo?.wholesaleid || goodsInfo?.wholesaleId || card.getAttribute('data-id') || null;
    const drugId = goodsInfo?.drugid || goodsInfo?.drugId || goodsInfo?.DrugID || null;

    // Map to contract product object
    const product = {
      id: wholesaleId || drugId || null,
      skuId: drugId || null,
      spuId: null,
      name,
      brand: goodsInfo?.brand || '',
      spec: goodsInfo?.specification || goodsInfo?.spec || '',
      manufacturer: goodsInfo?.manufacturer || goodsInfo?.factory || manufacturer,
      providerName: goodsInfo?.provider_name || goodsInfo?.providername || goodsInfo?.providerName || '',
      price: priceText,
      priceValue: parsePrice(priceText),
      originalPrice: '',
      priceUnit: goodsInfo?.unit || '',
      image,
      url: `https://dian2.ysbang.cn/#/product/${wholesaleId || drugId || ''}`,
      stockStatus: 'available',
      stockQuantity: null,
      minOrderQuantity: goodsInfo?.minamount || goodsInfo?.minbuy || 1
    };
    allProducts.push(product);
  });

  // === Apply client-side filters (best effort) ===
  let filteredProducts = allProducts;
  const requestedConstraints = [];
  const executedConstraints = [];
  const deferredConstraints = [];

  // Factory filter
  if (factory) {
    requestedConstraints.push({ key: 'factory', value: factory, source: 'arg' });
    const f = normalize(factory);
    filteredProducts = filteredProducts.filter(p =>
      normalize(p.manufacturer).includes(f) || normalize(p.providerName).includes(f)
    );
    executedConstraints.push({ key: 'factory', value: factory, source: 'arg' });
  }

  // Provider filter
  if (provider) {
    requestedConstraints.push({ key: 'provider', value: provider, source: 'arg' });
    const p = normalize(provider);
    filteredProducts = filteredProducts.filter(pObj =>
      normalize(pObj.providerName).includes(p)
    );
    executedConstraints.push({ key: 'provider', value: provider, source: 'arg' });
  }

  // Price filters (numeric)
  const minPriceNum = minPrice === '' ? null : Number(minPrice);
  const maxPriceNum = maxPrice === '' ? null : Number(maxPrice);
  if (minPrice !== '' || maxPrice !== '') {
    requestedConstraints.push({ key: 'price', value: { minPrice, maxPrice }, source: 'arg' });
    filteredProducts = filteredProducts.filter(p => {
      const price = p.priceValue;
      if (price === null) return true;
      if (minPriceNum !== null && price < minPriceNum) return false;
      if (maxPriceNum !== null && price > maxPriceNum) return false;
      return true;
    });
    executedConstraints.push({ key: 'price', value: { minPrice, maxPrice }, source: 'arg' });
  }

  // Range filter (expiration) - cannot be applied client-side without data
  if (range) {
    requestedConstraints.push({ key: 'range', value: range, source: 'arg' });
    deferredConstraints.push({
      key: 'range',
      value: range,
      reason: 'Expiration date not available in DOM; need backend API',
      recommendedAdapter: 'search'
    });
  }

  // Free shipping filter - cannot be applied client-side without data
  if (freeShipping !== '' && freeShipping !== null && freeShipping !== undefined) {
    requestedConstraints.push({ key: 'freeShipping', value: freeShipping, source: 'arg' });
    deferredConstraints.push({
      key: 'freeShipping',
      value: freeShipping,
      reason: 'Free shipping flag not available in DOM; need backend API',
      recommendedAdapter: 'search'
    });
  }

  // === Pagination (client-side) ===
  const pageSize = 20;
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const pageProducts = filteredProducts.slice(startIdx, endIdx);
  const hasMore = currentPage < totalPages;

  const pagination = {
    page: currentPage,
    pageSize,
    totalItems,
    totalPages,
    hasMore,
    nextCursor: hasMore ? String(currentPage + 1) : null
  };

  // === Build recommended next actions ===
  const recommendedNextActions = [];

  // Add cart actions if products found
  if (pageProducts.length > 0) {
    recommendedNextActions.push({
      type: 'action',
      adapter: 'cart-add',
      args: { /* placeholder */ },
      reason: 'You can add products to cart using their wholesaleId or drugId.'
    });
    recommendedNextActions.push({
      type: 'action',
      adapter: 'checkout-preview',
      args: {},
      reason: 'Preview checkout with selected items.'
    });
  }

  // Suggest refining if filters were deferred
  deferredConstraints.forEach(def => {
    recommendedNextActions.push({
      type: 'filter',
      adapter: def.recommendedAdapter,
      args: { [def.key]: def.value },
      reason: def.reason
    });
  });

  // === Hints ===
  const hints = [];
  if (pageProducts.length === 0) {
    hints.push('No products found matching the given filters.');
  }
  if (deferredConstraints.length > 0) {
    hints.push('Some filters could not be applied client-side; consider refining your search.');
  }
  if (suggestions.length > 0) {
    hints.push(`Did you mean: ${suggestions.slice(0, 3).join(', ')}?`);
  }

  // === Success response ===
  return {
    success: true,
    input: {
      keyword,
      factory,
      provider,
      minPrice,
      maxPrice,
      range,
      freeShipping,
      page: currentPage
    },
    parsed: {
      upc: parsedUpc || '',
      searchKeyword
    },
    requestedConstraints,
    executedConstraints,
    deferredConstraints,
    data: pageProducts,
    pagination,
    recommendedNextActions,
    hints,
    suggestions
  };
}