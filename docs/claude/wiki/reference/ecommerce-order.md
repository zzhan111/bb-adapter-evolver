---
title: Ecommerce Order object
type: wiki-reference
domain: ecommerce
last_updated: 2026-06-28
---

# Ecommerce Order object

The canonical `Order` shape returned by `order-list` (one per result) and `order-detail` (single, full). **Always check the canonical contract** at [`docs/claude/contracts/ecommerce/v1.md`](../../contracts/ecommerce/v1.md#order-object-used-by-order-list-order-detail) — this page is the wiki summary.

## Shape

```jsonc
{
  "id": "platform order id",
  "status": "pending_payment" | "paid" | "shipped" | "delivered" | "cancelled" | "refunded",
  "statusLabel": "待付款",                    // raw site label
  "createdAt": "2026-04-22T10:30:00.000Z",    // ISO 8601 UTC
  "totalPrice": "¥456.78",
  "totalPriceValue": 456.78,
  "itemCount": 3,
  "items": [/* product objects */],
  "shippingAddress": "string",
  "url": "https://www.example.com/order/123"
}
```

## Field-by-field

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Platform order id. Same value across `order-list` and `order-detail`. |
| `status` | enum | yes | One of `pending_payment`, `paid`, `shipped`, `delivered`, `cancelled`, `refunded`. |
| `statusLabel` | string | yes | Raw site label (e.g. "待付款", "已发货"). Preserved for human readers. |
| `createdAt` | string | yes | ISO 8601 UTC timestamp. Convert local times to UTC before emitting. |
| `totalPrice` | string | yes | Display string with currency symbol. |
| `totalPriceValue` | number | yes | Numeric for comparisons. **Pair with `totalPrice`.** |
| `itemCount` | number | yes | Number of line items, not total piece count. |
| `items` | array | yes (detail) / optional (list) | Product objects. `order-list` may omit to save bandwidth; `order-detail` MUST include. |
| `shippingAddress` | string | optional | Concatenated address string. |
| `url` | string | yes | Direct order page URL. |

## Status enum

| Value | Meaning |
|---|---|
| `pending_payment` | Awaiting payment; can be cancelled. |
| `paid` | Paid but not yet shipped. |
| `shipped` | In transit. |
| `delivered` | Received; may still be returnable. |
| `cancelled` | Cancelled before fulfillment. |
| `refunded` | Returned and refunded post-shipment. |

Site-specific statuses (e.g. `partially_shipped` for split orders) should be mapped to the closest enum value, with the raw label preserved in `statusLabel`. **Do not invent new enum values** — the contract is fixed.

## Worked examples

### ysbang order-detail

```jsonc
{
  "id": "ysbang-order-20260422001",
  "status": "shipped",
  "statusLabel": "已发货",
  "createdAt": "2026-04-22T10:30:00.000Z",
  "totalPrice": "¥456.78",
  "totalPriceValue": 456.78,
  "itemCount": 3,
  "items": [
    { "id": "wholesale-12345", "name": "阿莫西林胶囊 0.25g*24粒", "price": "¥12.50", "priceValue": 12.50, "quantity": 10 },
    { "id": "wholesale-67890", "name": "头孢克肟分散片 0.1g*12片", "price": "¥28.00", "priceValue": 28.00, "quantity": 5 },
    { "id": "wholesale-11111", "name": "布洛芬缓释胶囊 0.3g*20粒", "price": "¥18.50", "priceValue": 18.50, "quantity": 8 }
  ],
  "shippingAddress": "天津市和平区某街道123号",
  "url": "https://dian2.ysbang.cn/#/orderDetail/20260422001"
}
```

### yaoex order-list item (no items array)

```jsonc
{
  "id": "yaoex-order-20260518001",
  "status": "pending_payment",
  "statusLabel": "待付款",
  "createdAt": "2026-05-18T08:15:00.000Z",
  "totalPrice": "¥1234.56",
  "totalPriceValue": 1234.56,
  "itemCount": 5,
  "url": "https://mall.yaoex.com/order/detail?id=20260518001"
}
```

## Order status filter (order-list)

`order-list` typically accepts a `status` argument to filter. The contract recommends that **filter values match the enum** (`pending_payment`, `paid`, `shipped`, `delivered`, `cancelled`, `refunded`) rather than site-specific strings. If the site uses different values, map them in the adapter.

`bb-eval constraint-tracking` checks that the filter is reported honestly in `executedConstraints`.

## See also

- [Product object](ecommerce-product.md) — for `order-detail` items.
- [Cart object](ecommerce-cart.md) — pre-order version of the same data.
- [Ecommerce contract](../../contracts/ecommerce/v1.md)
