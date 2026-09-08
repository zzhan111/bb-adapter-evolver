---
title: Ecommerce domain
type: wiki-domain
domain: ecommerce
last_updated: 2026-06-28
canonical_contract: docs/claude/contracts/ecommerce/v1.md
---

# Ecommerce domain

The original domain. Covers sites whose primary user intent is **transact** (search → cart → checkout → order). Use this contract for B2C marketplaces, B2B pharmaceutical wholesale, and any vertical retail with cart + checkout.

## Scope

In scope:

- B2C marketplaces (`jd.com`, `pdd.com`, `taobao.com`, `tmall.com`).
- B2B pharmaceutical wholesale (`dian2.ysbang.cn`, `mall.yaoex.com`, `111.com.cn`).
- Vertical retail with cart + checkout flow.

Out of scope:

- Sites that have **no cart, no checkout, no orders**. Use [pharma-data](pharma-data.md) (data lookup) or [social-media](social-media.md) (UGC).
- Sites whose primary intent is **browse + read + engage + create**. Use [social-media](social-media.md).

## P0 adapter set (9 required)

| Adapter | Read/Write | Purpose |
|---|---|---|
| `auth` | read | Check login state. No side effects. |
| `search` | read | Keyword + structured filters → product list with pagination. |
| `product` | read | Get product detail by id (sku-level if applicable). |
| `cart-list` | read | Current cart contents and totals. |
| `cart-add` | write | Add a sku to cart (quantity, optional sku variant). |
| `cart-remove` | write | Remove or zero out a cart line. |
| `checkout-preview` | read | Preview order: applied price, shipping, coupons. Does NOT submit. |
| `order-list` | read | Past orders with pagination and status filter. |
| `order-detail` | read | Single order detail by id. |

## P1 (implement only when the site has the concept)

`switch-store`, `coupon-list`, `coupon-claim`, `address-list`, `order-cancel`, `logistics`. See the [P1 table in the contract](../../contracts/ecommerce/v1.md).

## Forbidden names (bb-eval FAILs)

| Forbidden pattern | Why | Correct approach |
|---|---|---|
| `search-by-<filter>` | Multiplies surface area for no agent benefit | Pass filters as `search` args |
| `cart-summary` | `cart-list` returns totals + items | One adapter, both fields |
| `order-create` / `submit-order` | Side effects too large for autonomous agent | `checkout-preview` + human submit |
| `auto-purchase` / `regular-buy` | Orchestration, not adapter | Compose P0 in a recipe |
| `<adapter>-debug` | Dead code | Delete before merge |

## Object schemas

- Product: [reference/ecommerce-product.md](../reference/ecommerce-product.md)
- Order: [reference/ecommerce-order.md](../reference/ecommerce-order.md)
- Cart: [reference/ecommerce-cart.md](../reference/ecommerce-cart.md)

## bb-eval checks

The full list is in [`docs/claude/contracts/ecommerce/v1.md`](../../contracts/ecommerce/v1.md) and [`docs/claude/methodology/evaluation/bb-eval-usage.md`](../../methodology/evaluation/bb-eval-usage.md). Highlights:

| Check | Level | What it verifies |
|---|---|---|
| `meta-block-valid` | FAIL | `@meta` block exists and parses as JSON. |
| `url-declared` | FAIL | First 50 lines declare `const FOO_URL = 'https://...'`. |
| `meta-name-format` | FAIL | `@meta.name` is `<site>/<adapter>`. |
| `forbidden-name` | FAIL | Local adapter name is not on the forbidden list. |
| `canonical-name` | PASS | Local adapter name is in P0/P1. |
| `readonly-mismatch` | FAIL | Mutating adapter declares `readOnly: true` (or omits it). |
| `constraint-tracking` | WARN | List adapters populate the trio honestly. |
| `pagination` | WARN | List adapters surface a `pagination` object. |

## Auth model

Tier-1 / tier-2 / tier-3 (effort-based — see [concepts/auth-tiers.md](../concepts/auth-tiers.md)). Default assumption is tier-2 or tier-3. Tier-1 only for genuinely anonymous pages.

## Reference adapters

- `templates/ecommerce/TEMPLATE.js`
- `templates/ecommerce/fixed/auth.js`, `search.js`, `product-detail.js`, `cart-*.js`, `checkout.js`, `select-best-add.js`, `switch-store.js`, `store-select.js`

## Worked examples

A successful `search` returns:

```jsonc
{
  "ok": true,
  "authStatus": "auth_read",
  "data": [{ /* Product[] */ }],
  "constraints": { "requestedConstraints": {...}, "executedConstraints": {...}, "deferredConstraints": {...} },
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 137, "totalPages": 7, "hasMore": true, "nextCursor": "..." },
  "recommendedNextActions": [{ "adapter": "product", "args": { "id": "..." }, "why": "Open the top result." }]
}
```

A failing `cart-add` returns:

```jsonc
{
  "ok": false,
  "authStatus": "auth_read",
  "data": null,
  "error": "OUT_OF_STOCK",
  "hint": "SKU 12345 is out of stock; try a different seller or wait for restock.",
  "action": "abort",
  "recommendedNextActions": [{ "adapter": "search", "args": { "keyword": "..." }, "why": "Find alternatives." }]
}
```

## Real sites currently in production

| Site | P0 coverage | bb-eval result | Notes |
|---|---|---|---|
| `ysbang` | 9/9 P0 + P1 (search-by-* removed in v2 rewrite) | mixed | Original reference; many legacy adapters migrated to v1 |
| `yaoex` | 9/9 P0 | all 0 FAIL | Phase 3 cross-site validation |

## Related

- [Contract source](../../contracts/ecommerce/v1.md)
- [Domain overview](choosing-a-domain.md)
- [Anti-patterns reference](../reference/anti-patterns.md)
