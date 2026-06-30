---
title: Ecommerce Product object
type: wiki-reference
domain: ecommerce
last_updated: 2026-06-28
---

# Ecommerce Product object

The canonical `Product` shape returned by `search`, `product`, `cart-list`, and `order-detail`. **Always check the canonical contract** at [`docs/claude/contracts/ecommerce/v1.md`](../../contracts/ecommerce/v1.md#product-object-used-by-search-product-cart-list-order-detail) — this page is the wiki summary.

## Shape

```jsonc
{
  "id": "wholesaleId or skuId, whichever is the canonical handle",
  "skuId": "if site distinguishes spu/sku",
  "spuId": "if site distinguishes spu/sku",
  "name": "full product name as displayed",
  "brand": "extracted brand or empty",
  "spec": "100mg*48 grain",                   // packaging spec
  "manufacturer": "factory / vendor name",
  "providerName": "merchant for marketplaces, empty for first-party",
  "price": "¥123.45",                         // string with currency symbol
  "priceValue": 123.45,                       // numeric for comparisons
  "originalPrice": "¥150.00",                 // optional, before promotion
  "priceUnit": "盒",                          // optional
  "image": "https://cdn.example.com/...",     // direct CDN url
  "url": "https://www.example.com/p/123",     // direct product page
  "stockStatus": "available" | "out_of_stock" | "limited" | "preorder",
  "stockQuantity": 47,                        // optional
  "minOrderQuantity": 1
}
```

## Field-by-field

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | The canonical handle. If the site has spu/sku distinction, prefer spu unless the adapter operates at sku level (e.g. cart-add). |
| `skuId` | string | optional | Only present if the site distinguishes spu/sku. |
| `spuId` | string | optional | Only present if the site distinguishes spu/sku. |
| `name` | string | yes | Full product name as the site displays it. Do not abbreviate. |
| `brand` | string | optional | Extracted brand. Empty string if the site doesn't surface it. |
| `spec` | string | optional | Packaging spec (e.g. "100mg*48 grain"). Important for pharmaceutical / industrial B2B. |
| `manufacturer` | string | optional | Factory or vendor name. |
| `providerName` | string | optional | Marketplace merchant name. Empty for first-party. |
| `price` | string | yes | Display string with currency symbol. **Always include the symbol** (¥, $, €, etc.). |
| `priceValue` | number | yes | Numeric value for comparisons and arithmetic. **Pair with `price`** — never just one. |
| `originalPrice` | string | optional | Before-promotion price. |
| `priceUnit` | string | optional | Unit shown next to price (e.g. "盒", "件"). |
| `image` | string | optional | Direct CDN URL. |
| `url` | string | yes | Direct product page URL. **Every product carries a URL.** |
| `stockStatus` | enum | yes | One of `available`, `out_of_stock`, `limited`, `preorder`. |
| `stockQuantity` | number | optional | Actual quantity, when the site exposes it. |
| `minOrderQuantity` | number | optional | Wholesale MOQ; important for B2B. |

## Why both `price` and `priceValue`?

Agents compare prices. Humans read strings. The string preserves the currency symbol and locale formatting; the number enables arithmetic. **Always both**. An adapter that returns only one will fail downstream comparisons or display.

## Why every product has a URL?

Agents navigate by URL. A product object without `url` is a dead end — the agent has nothing to open. `bb-eval` does not currently enforce `url` on every product (only on the adapter envelope), but reviewers will reject products without it.

## Worked examples

### ysbang search result (simplified)

```jsonc
{
  "id": "ysbang-wholesale-12345",
  "name": "阿莫西林胶囊 0.25g*24粒",
  "brand": "石药",
  "spec": "0.25g*24粒",
  "manufacturer": "石药集团",
  "providerName": "天津市某药房",
  "price": "¥12.50",
  "priceValue": 12.50,
  "originalPrice": "¥15.00",
  "priceUnit": "盒",
  "image": "https://cdn.ysbang.cn/p/12345.jpg",
  "url": "https://dian2.ysbang.cn/#/goodsDetail/12345",
  "stockStatus": "available",
  "stockQuantity": 480,
  "minOrderQuantity": 1
}
```

### yaoex cart item (with AES-decrypted price)

```jsonc
{
  "id": "yaoex-spu-98765",
  "spuId": "yaoex-spu-98765",
  "name": "阿莫西林克拉维酸钾分散片",
  "spec": "156.25mg*12片",
  "manufacturer": "鲁南贝特",
  "providerName": "鲁南贝特制药",
  "price": "¥5.65",
  "priceValue": 5.65,
  "url": "https://mall.yaoex.com/goods/98765",
  "stockStatus": "available",
  "minOrderQuantity": 1
}
```

## Stock status enum

| Value | Meaning |
|---|---|
| `available` | In stock, can be added. |
| `out_of_stock` | Out of stock, cannot be added. |
| `limited` | In stock but low (site-specific threshold). |
| `preorder` | Not yet released; can be reserved. |

`bb-eval` does not currently validate stock status values. The contract specifies the enum; reviewers enforce.

## See also

- [Order object](ecommerce-order.md) — for `order-detail` items.
- [Cart object](ecommerce-cart.md) — for `cart-list` items (same Product + cartLineId + quantity).
- [Ecommerce contract](../../contracts/ecommerce/v1.md)
