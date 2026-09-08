---
title: Ecommerce Cart object
type: wiki-reference
domain: ecommerce
last_updated: 2026-06-28
---

# Ecommerce Cart object

The canonical `Cart` shape returned by `cart-list`. **Always check the canonical contract** at [`docs/claude/contracts/ecommerce/v1.md`](../../contracts/ecommerce/v1.md#cart-object-used-by-cart-list) — this page is the wiki summary.

## Shape

```jsonc
{
  "summary": {
    "totalKind": 12,        // distinct sku count
    "totalQuantity": 47,    // total piece count
    "totalPrice": "¥1234.56",
    "totalPriceValue": 1234.56
  },
  "items": [/* product objects + cartLineId + quantity */],
  "url": "https://www.example.com/cart"
}
```

## Field-by-field

### `summary`

| Field | Type | Required | Notes |
|---|---|---|---|
| `totalKind` | number | yes | Distinct SKU count. Different from total quantity. |
| `totalQuantity` | number | yes | Total piece count across all lines. |
| `totalPrice` | string | yes | Display string with currency symbol. |
| `totalPriceValue` | number | yes | Numeric for arithmetic. **Pair with `totalPrice`.** |

### `items`

Each item is a [Product object](ecommerce-product.md) **plus** cart-specific fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `cartLineId` | string | yes | Site-specific cart line id. Used by `cart-remove` and `cart-update`. |
| `quantity` | number | yes | Current quantity in cart. |
| ... | | | All Product fields. |

### `url`

| Field | Type | Required | Notes |
|---|---|---|---|
| `url` | string | yes | Direct cart page URL. |

## Why one adapter (cart-list) returns both summary and items?

The forbidden pattern `cart-summary` would return only totals; agents would have to call `cart-list` for items anyway. The contract collapses them: `cart-list` returns both. Agents get the full picture in one call.

## Worked example

### yaoex cart-list

```jsonc
{
  "summary": {
    "totalKind": 4,
    "totalQuantity": 22,
    "totalPrice": "¥234.50",
    "totalPriceValue": 234.50
  },
  "items": [
    {
      "cartLineId": "yaoex-cart-1001",
      "quantity": 10,
      "id": "yaoex-spu-98765",
      "name": "阿莫西林克拉维酸钾分散片",
      "spec": "156.25mg*12片",
      "manufacturer": "鲁南贝特",
      "price": "¥5.65",
      "priceValue": 5.65,
      "url": "https://mall.yaoex.com/goods/98765",
      "stockStatus": "available"
    },
    {
      "cartLineId": "yaoex-cart-1002",
      "quantity": 5,
      "id": "yaoex-spu-11111",
      "name": "布洛芬缓释胶囊",
      "spec": "0.3g*20粒",
      "manufacturer": "中美天津史克",
      "price": "¥18.50",
      "priceValue": 18.50,
      "url": "https://mall.yaoex.com/goods/11111",
      "stockStatus": "available"
    }
  ],
  "url": "https://mall.yaoex.com/cart"
}
```

## Cart data path caveat (yaoex)

yaoex's cart API returns:

```
data.supplyCartList[].productGroupList[].groupItemList[]
```

**Not** `data.productList`. The `productList` field is empty; the actual products live three levels deep in the nested groups. Adapters that take a shortcut and read `productList` will return an empty cart. See the ysbang lesson: **always capture, never guess the data path.**

## Multiple supply stores (B2B)

For B2B sites, a single cart may contain items from multiple supply stores. yaoex's `supplyCartList[]` reflects this — each supply store has its own group. The adapter should flatten them into a single `items[]` array (with `providerName` distinguishing) unless the caller needs to know the supply breakdown. Preserve the breakdown in `recommendedNextActions` if it's load-bearing for the next call.

## See also

- [Product object](ecommerce-product.md) — cart item schema is Product + cartLineId + quantity.
- [Order object](ecommerce-order.md) — post-checkout version.
- [Ecommerce contract](../../contracts/ecommerce/v1.md)
