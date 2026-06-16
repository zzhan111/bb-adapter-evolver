---
name: Pharma-Data Adapter Contract v1 — Design Spec
type: design-spec
date: 2026-06-16
status: draft (awaiting user review)
domain: pharma-data
applies_to:
  - db.yaozh.com (药智数据)
  - any other structured-query pharmaceutical / regulatory data station
companion_contract: docs/claude/contracts/pharma-data/v1.md
---

# Pharma-Data Adapter Contract v1 — Design Spec

## Purpose

This document is the **design spec** for a new contract domain: `pharma-data`. It
exists because the existing `ecommerce` contract (cart / order / checkout) is the
wrong shape for db.yaozh.com — a structured pharmaceutical data station where the
agent's primary intent is **"look up regulatory / market / quality data about a
drug or company"**, not buy one.

The spec captures **what** and **why**. The companion contract document
`docs/claude/contracts/pharma-data/v1.md` captures the **normative rules** that
`bb-eval` enforces.

Both files are committed; they will diverge in style on purpose. The spec is
narrative; the contract is rules.

## Why a new contract (not an extension of ecommerce)

Evidence from db.yaozh.com recon (2026-06-16, internal):

| ecommerce primitive | db.yaozh.com equivalent? |
|---|---|
| `search` (keyword + filter → products) | ✅ partially — `list(query)` works |
| `product` (sku-level detail) | ❌ — records are heterogeneous per database, not sku |
| `cart-add` / `cart-remove` | ❌ — site has no cart concept |
| `order-list` / `order-detail` | ❌ — site has no orders |
| `checkout-preview` | ❌ — site is read-only |
| `auth` (check login state) | ⚠️ — most listings are public; a few rows / detail values need VIP login |

Forcing ecommerce v1 onto pharma-data would either (a) FAIL almost every check
in `bb-eval` (no `cart-list` etc.) or (b) require weakening ecommerce v1 to fit
pharma-data, which would damage the existing ysbang / yaoex contract. A new
contract is the right move.

## Scope

In scope for v1:

- Public data stations: any site with a flat `/{slug}` → listing-page → detail-
  page pattern, where records are documents not products.
- Three document types observed at db.yaozh.com: **regulation** (policies),
  **price** (yaopinjiage, dijia), **quality compliance** (ypzl), **market
  performance** (ypxs, yaopinzhongbiao).
- Soft-VIP gating pattern: a listing page is public, but some cells or some
  detail values require logged-in session.
- Hard-login-wall pattern (observed at `/yaopinzhongbiao`): a dedicated
  interstitial page renders instead of the table.

Out of scope for v1 (will be revisited in a v2 spec):

- Predictive / BI tools (e.g. `/drugbi`, `/forecast_sale`) — SPA-style, not
  server-rendered HTML.
- Mobile/APP backends (`zy.yaozh.com`).
- Cross-domain data join (e.g. "find the company behind a policy" — needs a
  graph layer above the adapter level).
- The B2B commerce side of yaozh.com (`s.yaozh.com`, `mk.yaozh.com`) — those
  would fall back under ecommerce v1.

## Core model

```
Database (dbKey)  →  List page  →  Detail page
                       │                │
                       │                └─ one of:
                       │                    • numeric ID   (policies, yaopinjiage)
                       │                    • base64 ID    (ypzl, dijia, customs, ypxs)
                       │                    • click-handler (drugad, deferred to v2)
                       │
                       └─ Authorization tier:
                            • public                 (no auth)
                            • soft-VIP (cell-level)  (sales numbers in ypxs)
                            • hard-wall (page-level) (yaopinzhongbiao)
```

The detail-page ID encoding is **per-database and immutable** — agents must
discover it by reading the listing, not by guessing.

## The canonical adapter set

### P0 — required for every pharma-data database

| Adapter | Purpose | Read/Write |
|---|---|---|
| `auth` | Check login state. **Optional** — most public databases work without. | read |
| `list` | Database-key + filters → page of records. Returns the canonical `Record` shape. | read |
| `item` | Detail by ID. Auto-detects numeric vs base64 ID. | read |

### P1 — implement only when the database has the concept

| Adapter | Implement when |
|---|---|
| `search` | The site exposes a keyword-search box distinct from `list` filters (most do not — `list(keyword=...)` usually suffices) |
| `export` | The database has a CSV/Excel export button (typically VIP-gated; mirrors `export` rather than fabricating it) |
| `related` | The database exposes "related records" links (e.g. policy → covered drug) |

### Helper (cross-cutting, NOT per-database)

| Helper | Purpose |
|---|---|
| `yaozh-auth` | Cookie-injector. Reads a session cookie from environment / input, attaches it to every subsequent request. **Does not perform login itself** — login is the human's responsibility (AGENTS.md #5). |

### Forbidden (enforced by `bb-eval`)

| Pattern | Why forbidden |
|---|---|
| `<dbKey>-list` and `<dbKey>-detail` as separate adapter files | One adapter, two methods |
| `*` adapter names that re-implement `list` for one filter dimension | Pass filter as argument |
| `*` adapters that scrape HTML to compute what the server already returned | If a JSON endpoint exists, use it; if not, use the HTML, but never parse-recompute |
| Auto-login workflows in any adapter | AGENTS.md #5 |
| Hardcoded credentials, session tokens, or API keys in adapter source | Security; rotates frequently |

## Output schema (mandatory across all pharma-data adapters)

Reuses the top-level envelope from ecommerce v1 (success / error / hint /
action / input / url / requestedConstraints / executedConstraints /
deferredConstraints / data / pagination / recommendedNextActions / hints)
**unchanged** for cross-domain consistency. The new content is the `data` and
`detail` payload shapes.

### `Record` object (used by `list`, returned in `data.records[]`)

```jsonc
{
  "dbKey": "yaopinjiage",                     // canonical database slug
  "id": "667063",                              // primary key, in the form the detail URL uses
  "title": "依替米星注射液 2ml:100mg",         // display title for the record
  "url": "https://db.yaozh.com/yaopinjiage/667063.html",  // direct detail URL
  "fields": {                                  // free key-value, keys are the table column names verbatim
    "通用名": "依替米星",
    "剂型": "注射液",
    "规格": "2ml:100mg",
    "最高零售价": "21.30元",
    "执行日期": "2010-04-15"
  },
  "authStatus": "public" | "soft_vip" | "hard_wall",
  "vipGatedFields": [],                        // for soft_vip: names of fields whose values were redacted
  "scrapedAt": "2026-06-16T10:30:00.000Z"
}
```

### `Detail` object (used by `item`, returned in `data`)

```jsonc
{
  "dbKey": "yaopinjiage",
  "id": "667063",
  "url": "https://db.yaozh.com/yaopinjiage/667063.html",
  "title": "依替米星注射液 2ml:100mg",
  "fields": { /* same key-value shape as Record.fields, plus any detail-only columns */ },
  "body": "free-text body of the detail page, trimmed",  // optional, omit for purely tabular databases
  "attachments": [                              // optional, for download links found on detail page
    { "label": "原文PDF", "url": "https://..." }
  ],
  "authStatus": "public" | "soft_vip" | "hard_wall",
  "vipGatedFields": [],
  "scrapedAt": "2026-06-16T10:30:00.000Z"
}
```

### Authorization tiers (canonical)

| `authStatus` | Meaning | Adapter behavior |
|---|---|---|
| `public` | No auth required | Return all fields |
| `soft_vip` | Some cells redacted to "查看" placeholder | Return the record; list the redacted field names in `vipGatedFields`; do NOT fabricate values |
| `hard_wall` | The page never renders; server returns an interstitial / login redirect | Return `success: false` with `error: "HARD_LOGIN_WALL"`, `hint: <human-readable>`, `action: "yaozh-auth ..."` |

### `auth` adapter response

```jsonc
{
  "success": true,
  "data": {
    "isLoggedIn": false,
    "username": null,
    "tier": "anonymous" | "free" | "vip" | "enterprise",
    "tierExpiresAt": null,  // ISO date if known
    "sessionCookieName": "PHPSESSID",  // name only; value never returned
    "sessionCookiePresent": false      // boolean: do we have a cookie right now?
  },
  "url": "https://www.yaozh.com/login"
}
```

The `auth` adapter **does not log in**. It reports state. Login is the human's
job (AGENTS.md #5). It may suggest `action: "open https://www.yaozh.com/login"`
so an agent can prompt the human.

## Error model (additions to the standard `error/hint/action` triple)

New standard error codes (PHR-eval will verify these are used instead of free-
form strings):

| Code | When | `action` shape |
|---|---|---|
| `LOGIN_REQUIRED` | A record / cell requires auth we don't have | `"yaozh-auth"` (the helper adapter name) |
| `HARD_LOGIN_WALL` | The page itself never renders for anonymous users | `"yaozh-auth"` |
| `ENCRYPTED_ID_DECODE_FAILED` | A base64 ID could not be decoded to a numeric ID (rare; happens on stale fixtures) | `""` — agent must re-list |
| `RATE_LIMITED` | The server returned a rate-limit / captcha page | `"wait <seconds>"` |
| `SCHEMA_DRIFT` | The page rendered but the table no longer has the expected columns | `""` — needs human investigation |
| `DBKEY_UNKNOWN` | Caller asked for a dbKey this adapter doesn't know | `""` — fix the call |

## bb-eval additions

`bb-eval` gains a `--contract=pharma-data` flag (or auto-detects from
`@meta.domain == "pharma-data"`). New checks (PHR- prefix to avoid collision
with existing ECOM- prefix):

| Check | Severity | Description |
|---|---|---|
| `PHR-1 domain-set` | FAIL | `@meta.domain` must be `"pharma-data"` |
| `PHR-2 dbkey-declared` | FAIL | `@meta.dbKey` (e.g. `"yaopinjiage"`) must be present and match the HOME_URL slug |
| `PHR-3 url-constant` | FAIL | `const <DBKEY>_URL = 'https://...'` (or `HOME_URL`) in first 50 lines, and the URL must contain `/<dbKey>` (e.g. `/yaopinjiage`) |
| `PHR-4 list-and-item` | FAIL | Adapter must export at least `list` and `item` |
| `PHR-5 record-shape` | FAIL (list) | Static grep for `dbKey:`, `id:`, `url:`, `fields:` in the return statement |
| `PHR-6 id-detect` | WARN (item) | The `item` function must contain a numeric-vs-base64 discriminator (regex `/^\d+$/` vs base64 pattern) |
| `PHR-7 auth-status` | FAIL | Every Record / Detail returned must include an `authStatus` field |
| `PHR-8 canonical-names` | FAIL | Adapter name must be one of: `auth`, `list`, `item`, `search`, `export`, `related`. No `*-list`, `*-detail`, `<dbKey>-*` variants. |
| `PHR-9 helper-name` | FAIL | Cross-cutting helpers (the auth helper) must declare `kind: "helper"` in @meta |
| `PHR-10 no-creds` | FAIL | No hardcoded passwords / API keys / `Bearer ` literals in source |

`bb-eval` will keep the existing ecommerce checks intact; the new checks are
additive and keyed by domain.

## The 7 adapters (file plan)

Each database is **one adapter file** (exports `list` + `item` together,
per the contract's forbidden-patterns rule). The file name is the dbKey itself,
not a `*-list` variant.

| File (relative to `~/.bb-browser/sites/db.yaozh.com/adapters/`) | dbKey | Auth tier | Detail ID type | Difficulty |
|---|---|---|---|---|
| `yaopinjiage.js` | `yaopinjiage` | public | numeric | easy — 7370 records, richest data — start here |
| `policies.js` | `policies` | public | numeric | easy |
| `ypzl.js` | `ypzl` | public | base64 | medium — ID discriminator needed |
| `ypxs.js` | `ypxs` | soft_vip (sales values) | base64 | medium — `soft_vip` field-tag logic |
| `dijia.js` | `dijia` | public | base64 | easy — only 4 records |
| `yaopinzhongbiao.js` | `yaopinzhongbiao` | **hard_wall** | unknown | hard — gated on user providing sample logged-in response |
| `yaozh-auth.js` (helper, `kind: "helper"`) | — | — | — | easy — pure cookie-injector |

**Build order** (public-first, as the user requested):
1. `yaopinjiage.js` — public, richest dataset
2. `policies.js` — public, second-richest
3. `ypzl.js` — public, base64 IDs (first time we exercise the ID discriminator)
4. `ypxs.js` — soft_vip, exercises the redacted-field tagging
5. `dijia.js` — public, small dataset
6. `yaozh-auth.js` — helper, must exist before yaopinzhongbiao can be tested
7. `yaopinzhongbiao.js` — **gated on user providing sample logged-in response**
   (AGENTS.md #5; we cannot proceed without it). If the user never provides
   one, this adapter is **deferred indefinitely** and the other 6 still ship.
   The contract does not require `yaopinzhongbiao.js` to exist for v1 to be
   considered complete.

The auth helper is **built after the first public adapter works**, so the
pattern is established before we hit the wall.

## Open questions for v2

- **Cross-database joins** (e.g. find all policies mentioning a drug). This is
  not really adapter work — it's a query layer on top. Deferred.
- **Pagination strategy**: db.yaozh.com uses `?page=N` query strings. For
  agents, this is fine for small databases (<10k rows). For larger ones, an
  internal XHR endpoint would be better. We will discover the XHR endpoint
  opportunistically; if it's protected differently, the HTML path stays.
- **The `drugad` database** has `#` placeholders for "查看" — we don't yet know
  if that's a click-handler (modal), a soft-VIP gate, or a dead link. Deferred
  until at least one other base64-ID adapter is working.
- **English version** at `data.yaozh.com` — same backend, different skin.
  Worth supporting in v2 so non-Chinese-speaking agents can use it.

## Self-review checklist (per brainstorming skill)

- **Placeholders**: no `TBD` / `TODO` left unresolved. All 7 adapters have
  fixed scope. ✅
- **Internal consistency**: section 5 (canonical adapter set) and section 9
  (file plan) agree on the 7 files. Auth helper is consistently described as
  cookie-injector, not auto-login. ✅
- **Scope**: focused on the 6+1 db.yaozh.com adapters. Cross-database join,
  predictive BI, mobile app backends explicitly deferred. ✅
- **Ambiguity**: `authStatus` enum is closed; error codes are closed; tier
  encoding is closed. PHR checks have specific grep patterns. ✅

## Implementation plan

The implementation plan will be produced by the `writing-plans` skill in the
next phase. The plan must include:

- One TDD task per adapter: write a fixture, write the contract check, then
  implement.
- The contract document (`docs/claude/contracts/pharma-data/v1.md`) and
  `bb-eval` PHR-check additions as a separate task at the top of the plan
  (must land before the first adapter is written).
- A verification task at the end that runs every adapter through `bb-eval`
  AND every adapter's `example` via bb-browser MCP (using fixtures for the
  login-walled ones).
