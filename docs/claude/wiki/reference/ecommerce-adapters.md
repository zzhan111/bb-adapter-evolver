---
title: Ecommerce adapter reference
type: wiki-reference
domain: ecommerce
last_updated: 2026-06-28
---

# Ecommerce adapter reference

The full set of canonical and forbidden adapter names for ecommerce. **Always check the canonical contract** at [`docs/claude/contracts/ecommerce/v1.md`](../../contracts/ecommerce/v1.md) — this page is the wiki summary.

## P0 — required (9)

| Adapter | Purpose | Read/Write | Min tier |
|---|---|---|---|
| `auth` | Check login state. No side effects. | read | tier-1 |
| `search` | Keyword + structured filters → product list with pagination. | read | tier-2 |
| `product` | Get product detail by id (sku-level if applicable). | read | tier-2 |
| `cart-list` | Current cart contents and totals. | read | tier-2 |
| `cart-add` | Add a sku to cart (quantity, optional sku variant). | write | tier-2 |
| `cart-remove` | Remove or zero out a cart line. | write | tier-2 |
| `checkout-preview` | Preview order: applied price, shipping, coupons. Does NOT submit. | read | tier-2 |
| `order-list` | Past orders with pagination and status filter. | read | tier-2 |
| `order-detail` | Single order detail by id. | read | tier-2 |

## P1 — implement only when the site has the concept

| Adapter | Implement when |
|---|---|
| `switch-store` | Site is multi-tenant (B2B pharmacy wholesale, marketplace seller console). |
| `coupon-list` | Site has user-claimable coupons separate from auto-applied promotions. |
| `coupon-claim` | Site exposes a "claim coupon" action. |
| `address-list` | Site requires explicit address selection at checkout. |
| `order-cancel` | Site supports user-initiated cancellation post-submit. |
| `logistics` | Site exposes tracking distinct from `order-detail`. |

## Forbidden (bb-eval FAILs)

| Pattern | Why forbidden | Correct approach |
|---|---|---|
| `search-by-<filter>` (`search-by-price`, `search-by-factory`, `search-by-provider`, `search-by-expiration`, ...) | Multiplies surface area for no agent benefit | Pass filters as `search` args |
| `cart-summary` (separate from `cart-list`) | Agent always wants both; `cart-list` returns totals + items | One adapter, both fields |
| `order-create`, `submit-order` | Side effects too large for autonomous agent without human handoff | `checkout-preview` + human submits |
| `auto-purchase`, `regular-buy` workflow adapters | Orchestration belongs to recipes | Compose P0 in a recipe |
| `<adapter>-debug`, `<adapter>-v2` | Dead code | Delete before merge |

## Worked `@meta` blocks

### `auth`

```jsonc
/* @meta
{
  "name": "<site>/auth",
  "description": "Check login state for <site>. No side effects.",
  "domain": "<hostname>",
  "args": [],
  "capabilities": ["dom", "cookie"],
  "readOnly": true,
  "example": "bb-browser site <site>/auth"
}
*/
```

### `search`

```jsonc
/* @meta
{
  "name": "<site>/search",
  "description": "Search <site> by keyword + filters (price, brand, etc.) with pagination.",
  "domain": "<hostname>",
  "args": [
    { "name": "keyword", "type": "string", "required": true },
    { "name": "page", "type": "int", "default": 1 },
    { "name": "pageSize", "type": "int", "default": 20 },
    { "name": "sort", "type": "enum", "values": ["default", "price-asc", "price-desc", "latest"] }
  ],
  "capabilities": ["network", "navigation"],
  "readOnly": true,
  "example": "bb-browser site <site>/search --keyword '阿莫西林'"
}
*/
```

### `cart-add`

```jsonc
/* @meta
{
  "name": "<site>/cart-add",
  "description": "Add a sku to cart. Returns updated cart summary.",
  "domain": "<hostname>",
  "args": [
    { "name": "skuId", "type": "string", "required": true },
    { "name": "quantity", "type": "int", "default": 1 }
  ],
  "capabilities": ["network"],
  "readOnly": false,
  "example": "bb-browser site <site>/cart-add --skuId 12345 --quantity 2"
}
*/
```

## Sites currently in production

| Site | Notes | Coverage |
|---|---|---|
| `ysbang` | Original reference site; 38 legacy adapters, most migrated to v1 names | 9 P0 + P1 |
| `yaoex` | B2B pharmaceutical wholesale; AES price decryption; gateway-b2b.fangkuaiyi.com backend | 9 P0 + P1 |

See [ecommerce domain](../domains/ecommerce.md) for the full domain overview.

## Related

- [Contract source](../../contracts/ecommerce/v1.md)
- [Product schema](ecommerce-product.md)
- [Order schema](ecommerce-order.md)
- [Cart schema](ecommerce-cart.md)
- [Error codes](error-codes.md)
- [Anti-patterns](anti-patterns.md)
