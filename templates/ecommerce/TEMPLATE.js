/**
 * bb-browser Ecommerce Adapter Template
 * 
 * This template shows the REQUIRED structure for any ecommerce domain adapter.
 * Derived from ysbang/search (13/13 pass on bb-eval) and the ecommerce contract v1.
 *
 * Run bb-eval to verify:  tools/bb-eval <your-adapter.js>
 * 
 * Required @meta fields:
 *   name        - "<site>/<adapter>" format
 *   description - what this adapter does
 *   domain      - the site domain
 *   args        - parameter definitions with required/description
 *   capabilities - array, usually ["network"]
 *   readOnly    - true for read-only, false for mutations
 *   example     - "bb-browser site <site>/<adapter> --arg1 val1 ..."
 *
 * Required code patterns:
 *   1. const HOME_URL = 'https://...' in first 15 lines
 *   2. error/hint/action triple on ALL error returns
 *   3. recommendedNextActions for happy-path chaining
 *   4. pagination object for list adapters
 *   5. constraint tracking trio for filtered lists
 */

/* @meta
{
  "name": "EXAMPLE_SITE/search",
  "description": "Search products on Example Site",
  "domain": "example.com",
  "args": {
    "keyword": {"required": true, "description": "Search keyword"},
    "page": {"required": false, "description": "Page number (default 1)"},
    "pageSize": {"required": false, "description": "Items per page (default 20)"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site EXAMPLE_SITE/search --keyword aspirin --page 1 --json"
}
*/

const HOME_URL = 'https://example.com';

async function(args) {
  const { keyword, page = 1, pageSize = 20 } = args;

  // ── Error: missing required args ──
  if (!keyword) {
    return {
      success: false,
      error: 'keyword is required',
      hint: 'Provide a product name or drug name to search',
      action: 'bb-browser site EXAMPLE_SITE/search --keyword <your-keyword>'
    };
  }

  // ── Navigate to search page ──
  const url = `${HOME_URL}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
  await bb.goto(url, { waitUntil: 'networkidle' });

  // ── Extract products ──
  const products = await bb.$$eval('.product-card', (cards, pgSize) => {
    return cards.slice(0, pgSize).map((card, i) => ({
      // All fields from ecommerce contract v1 product schema:
      id: card.dataset.id || '',
      name: card.querySelector('.product-name')?.textContent?.trim() || '',
      price: {
        amount: parseFloat(card.querySelector('.price')?.textContent?.replace(/[^0-9.]/g, '')) || 0,
        currency: 'CNY',
        unit: ''
      },
      image: card.querySelector('img')?.src || '',
      url: card.querySelector('a')?.href || '',
      vendor: card.querySelector('.vendor')?.textContent?.trim() || '',
      brand: card.querySelector('.brand')?.textContent?.trim() || '',
      manufacturer: card.querySelector('.manufacturer')?.textContent?.trim() || '',
      spec: card.querySelector('.spec')?.textContent?.trim() || '',
      stock: { available: true, quantity: null },
      minOrderQuantity: parseInt(card.querySelector('.min-order')?.textContent) || 1
    }));
  }, pageSize);

  // ── Pagination ──
  const totalText = await bb.$eval('.total-count', el => el.textContent).catch(() => '0');
  const total = parseInt(totalText.replace(/[^0-9]/g, '')) || 0;

  // ── Success response with all required contract fields ──
  return {
    success: true,
    products,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    },
    // Constraint tracking for filtered lists
    requestedConstraints: { keyword, page, pageSize },
    executedConstraints: { keyword, page, pageSize },
    deferredConstraints: {},
    // Agent chaining
    recommendedNextActions: [
      {
        adapter: 'EXAMPLE_SITE/product-detail',
        args: { drugId: '<from products[].id>' },
        description: 'View full product details and pricing'
      },
      {
        adapter: 'EXAMPLE_SITE/add-to-cart',
        args: { wholesaleId: '<from products[].id>', quantity: 1 },
        description: 'Add a product to cart'
      }
    ]
  };
}
