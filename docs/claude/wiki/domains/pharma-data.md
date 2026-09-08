---
title: Pharma-data domain
type: wiki-domain
domain: pharma-data
last_updated: 2026-06-28
canonical_contract: docs/claude/contracts/pharma-data/v1.md
---

# Pharma-data domain

Covers sites where the agent's primary intent is to look up **records** (regulations, prices, quality notices, market data) about drugs, companies, or policies. These sites have **no cart, no checkout, no orders**.

## Why this is a separate domain (not an extension of ecommerce)

The decision record at [`docs/claude/decisions/2026-06-16-why-pharma-data-contract.md`](../../decisions/2026-06-16-why-pharma-data-contract.md) walks through this in detail. Short version:

- Ecommerce's P0 set (`cart-add`, `checkout-preview`, `order-list`, ...) doesn't apply — these sites don't sell anything.
- Forcing ecommerce v1 onto `db.yaozh.com` failed every P0 check that referenced cart/order/checkout.
- The site has its own access model (`public` / `soft_vip` / `hard_wall`) that ecommerce doesn't model.
- ID encoding differs (numeric vs base64) — a real wrinkle that ecommerce doesn't need to handle.

The contract is intentionally narrow.

## Scope

In scope:

- `db.yaozh.com` (药智数据) and any flat `/{slug}` → list → detail data station.
- Other pharmaceutical / regulatory / market data sites whose records are **documents**, not products.

Out of scope:

- Sites that sell pharmaceuticals. Use [ecommerce](ecommerce.md).
- Sites whose primary intent is UGC. Use [social-media](social-media.md).

## Adapter set

### P0 (3 required per database)

| Adapter | Read/Write | Purpose |
|---|---|---|
| `auth` | read | Check login state. **Optional** — most public databases work without. |
| `list` | read | Database-key + filters → page of records. |
| `item` | read | Detail by ID. Auto-detects numeric vs base64 ID. |

### P1 (implement only when the database has the concept)

`search`, `export`, `related`. See the [P1 table in the contract](../../contracts/pharma-data/v1.md).

### Helper (cross-cutting, NOT per-database)

| Helper | Purpose |
|---|---|
| `yaozh-auth` (or generic `<site>-auth`) | Cookie-injector. Reads a session cookie, attaches it to every subsequent request. **Does not perform login itself.** |

`yaozh-auth` is declared with `kind: helper`. `bb-eval` PHR-4/5/6/7 skip helpers automatically.

## Forbidden names (PHR-8 FAILs)

| Pattern | Why | Correct approach |
|---|---|---|
| `<dbKey>-list` and `<dbKey>-detail` as separate adapter files | One adapter, two methods | Single adapter exporting `list` and `item` |
| `<filter>-list`, `<filter>-detail` | Multiplies surface area | Pass filter as `list` argument |
| `<dbKey>-debug`, `<dbKey>-v2` | Dead code | Delete before merge |
| Auto-login workflow in any adapter | AGENTS.md #5 | `auth` adapter reports state only |
| Hardcoded credentials | Security; rotates frequently | Read from env / input at runtime |
| Adapter name not in canonical set | Sprawl | Use a canonical name; if it doesn't fit, the contract is wrong |

## Object schema

See [reference/pharma-data-record.md](../reference/pharma-data-record.md).

## Auth model

`public` / `soft_vip` / `hard_wall` (data-access based):

| Level | Meaning | Adapter behavior |
|---|---|---|
| `public` | Anyone can read. No login. | Adapter reads and returns full data. |
| `soft_vip` | Record shows up in the list, but detail fields are gated. | Adapter returns `vipGatedFields: [...field names...]`, **clears** the field values, tells the agent how to upgrade. Never invents values. |
| `hard_wall` | Whole database behind login; nothing renders. | Adapter returns `authStatus: hard_wall` with hint pointing to `yaozh-auth`. No data is fabricated. |

## Real databases currently in production (db.yaozh.com)

| dbKey | Records | Tier | Notes |
|---|---|---|---|
| `yaopinjiage` | 660,613 | public | keyword: `name` |
| `policies` | 27,203 | public | keyword: `policies_title` |
| `ypzl` | ~10 | public | keyword: `name`; IDs are base64 |
| `ypxs` | 35 | soft_vip | keyword: `cname` / `brandname` / `name` / `brandnamecn` |
| `dijia` | 32 | public | keyword: `name`; IDs are base64 |
| `yaopinzhongbiao` | 1,986,638 | hard_wall | keyword: `comprehensivesearchcontent`; detail links go to external government sites |
| `yaozh-auth` | — | helper | Cookie-injector; not a database |

Total: **6 databases + 1 helper = 7 adapters**, **152 bb-eval checks / 0 fail**.

## Field-extraction algorithm (v7 stable)

For all 6 databases:

```
selector:    table.table.zjlsearFromVal tbody tr
cells:       th, td  (both — includes header column)
titleCellIdx:  cell containing a[href*=".html"]
titleHeaderIdx: header matching one of titleHeaderNames
offset:        linkCellIdx - titleHeaderIdx
```

The remaining cells are mapped to headers by position. **Read the listing page's `<form>` to discover the actual keyword field name** — every database uses a different one. The template's `scrme_name` default is wrong on every adapter.

## ID encoding

Two flavors:

| Flavor | Example dbKey | Detection |
|---|---|---|
| Numeric | `yaopinjiage`, `policies` | `/^\d+$/.test(id)` |
| Base64 | `ypzl`, `dijia`, `ypxs` | `btoa`-shaped; longer than typical numeric ids |

The `item()` adapter auto-detects. `bb-eval PHR-6` is a WARN — static check can't verify dynamic ID-type logic.

## bb-eval PHR-* checks

| ID | Check | Level |
|---|---|---|
| PHR-1 | `@meta.domain == 'pharma-data'` | FAIL |
| PHR-2 | `@meta.dbKey` present and non-null | FAIL |
| PHR-3 | First 50 lines contain a URL with `/<dbKey>` slug | FAIL |
| PHR-4 | Exports `async function list` and `async function item` (helpers skip) | FAIL |
| PHR-5 | Return shape has `dbKey`, `id`, `url`, `fields` (accepts shorthand `id,`) | FAIL |
| PHR-6 | `item()` has ID-type discriminator | WARN |
| PHR-7 | Returns `authStatus` | FAIL |
| PHR-8 | Adapter name in canonical set (`auth`, `list`, `item`, `search`, `export`, `related`); helper allowed | FAIL / WARN |
| PHR-9 | `yaozh-auth` declares `kind: helper` | FAIL |
| PHR-10 | No hardcoded credentials | FAIL |
| PHR-readonly | `readOnly: true` required | FAIL |

## Related

- [Contract source](../../contracts/pharma-data/v1.md)
- [Decision record](../../decisions/2026-06-16-why-pharma-data-contract.md)
- [Design spec](../../../superpowers/specs/2026-06-16-pharma-data-design.md)
- [Domain overview](choosing-a-domain.md)
