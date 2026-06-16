---
name: bb-eval Usage
type: methodology
last_updated: 2026-04-22
---

# bb-eval — static contract checker for bb-browser adapters

`tools/bb-eval` is a shell + jq script that scores any adapter file against the contract for its domain. It is intentionally **static** — it never executes the adapter. Run it as a fast sanity gate; pair it with `bb-browser` MCP for the runtime check.

## Quick start

```bash
./tools/bb-eval ~/.bb-browser/sites/ysbang/adapters/search.js
./tools/bb-eval --json ~/.bb-browser/sites/ysbang/adapters/search.js
./tools/bb-eval --domain ecommerce ~/.bb-browser/sites/<site>/adapters/<name>.js
```

Exit code is 0 if no FAIL, 1 if any FAIL. WARNs do not change the exit code.

## Checks performed (v1, ecommerce domain)

| Check | Level | What it verifies |
|---|---|---|
| `meta-block-valid` | FAIL | The `/* @meta { ... } */` block exists and parses as JSON. |
| `url-declared` | FAIL / WARN | First 50 lines contain `const FOO_URL = 'https://...'`. WARN if a URL exists but not as a named constant. |
| `meta-field-*` | FAIL | Each required field (`name`, `description`, `domain`, `args`, `capabilities`, `readOnly`, `example`) is present. |
| `meta-name-format` | FAIL | `@meta.name` is `<site>/<adapter>`. |
| `meta-example-format` | WARN | `@meta.example` looks like a `bb-browser site ...` command. |
| `forbidden-name` | FAIL | Adapter name is on the contract's banned list (`search-by-*`, `cart-summary`, `order-create`, `auto-purchase`, `*-debug`, etc.). |
| `canonical-name` | PASS | Adapter name is in P0/P1 set for the domain. |
| `unknown-name` | WARN | Adapter name is neither canonical nor forbidden — needs justification. |
| `readonly-mismatch` | FAIL | Mutating adapter (`cart-add`, `cart-remove`, ...) declares `readOnly: true`. |
| `error-envelope` | WARN | If the adapter returns errors, it should consistently include `hint` and `action` fields. |
| `constraint-tracking` | WARN | List adapters (`search`, `cart-list`, `order-list`) populate the requested/executed/deferred trio. |
| `next-actions` | WARN | Adapter populates `recommendedNextActions` so agents can chain calls. |
| `pagination` | WARN | List adapters surface a `pagination` object. |

## What `bb-eval` does NOT check (yet)

These are runtime concerns. Use `bb-browser` MCP to verify them by running the adapter's `@meta.example`:

- The endpoint actually exists and returns the documented schema
- Pagination cursor round-trips correctly
- Auth is honored (the adapter doesn't silently fail open without login)
- Side effects are bounded (cart-add adds exactly the requested quantity, not more)

For runtime checks during authoring:

```bash
# Run the example
eval "$(jq -r '.example' <<< "$(grep -A100 '@meta' adapter.js | sed -n '/{/,/}/p')")"
# (or just read the example string and run it manually)
```

## Adding new checks

Edit `tools/bb-eval`. The structure is:

1. Source + `@meta` are read into shell variables.
2. `record LEVEL check-name "message"` accumulates results.
3. The output block at the bottom prints text or JSON.

A new check is one block of shell that calls `record`. Keep checks fast (no network, no sub-shell loops over large files).

## Domain detection: ecommerce vs pharma-data

`bb-eval` recognizes two contract domains and routes the checker set accordingly:

| Heuristic match | Domain |
|---|---|
| `*yaozh.com*`, `*data.yaozh.com*` | `pharma-data` |
| `*ysbang*`, `*jd.com*`, `*pdd.com*`, `*taobao.com*`, `*111.com.cn*`, `*1yaocheng*`, `*tmall*`, `*yaoex*`, `*fangkuaiyi*` | `ecommerce` |

Pass `--domain pharma-data` to force. If neither heuristic matches and no flag is given, `domain = "unknown"` and most checks are skipped.

### pharma-data checks (PHR-* prefix)

Added 2026-06-16 for `db.yaozh.com` work. Twelve checks:

| Check | Level | What it verifies |
|---|---|---|
| `PHR-1 domain-set` | FAIL | `@meta.domain` is `'pharma-data'`. |
| `PHR-2 dbkey-declared` | FAIL | `@meta.dbKey` is present and non-null. |
| `PHR-3 url-constant` | FAIL | First 50 lines contain a URL with the `/<dbKey>` slug. |
| `PHR-4 list-function` / `PHR-4 item-function` | FAIL | Adapter exports `async function list` and `async function item`. Skipped if `kind: helper`. |
| `PHR-5 record-shape` | FAIL | Return shape includes `dbKey`, `id`, `url`, `fields` keys. Accepts shorthand properties (`id,` not `id:`). Skipped for helpers. |
| `PHR-6 id-detect` | WARN | `item()` contains ID-type discriminator (numeric vs base64). Static check — may WARN if logic is dynamic. |
| `PHR-7 auth-status` | FAIL | Return includes `authStatus` field. |
| `PHR-8 canonical-name` | FAIL / WARN | Adapter name must be in P0/P1 set (`auth`, `list`, `item`, `search`, `export`, `related`) — never `*-list` or `*-detail`. Helper `yaozh-auth` is allowed. WARN for dbKey names not in the canonical set. |
| `PHR-9 helper-name` | FAIL | `yaozh-auth` must set `@meta.kind = "helper"`. |
| `PHR-10 no-creds` | FAIL | No hardcoded `password=`, `api_key=`, `Bearer <token>`. |
| `PHR-readonly` | FAIL | `readOnly: true` is required for pharma-data. |
| `meta-field-dbKey` / `meta-field-authStatus` | FAIL | Pharma-data requires these `@meta` fields. |

**Helpers** (`kind: helper`) automatically skip PHR-4, PHR-5, PHR-6, PHR-7 — these checks assume a per-database adapter with `list`/`item` shape.

## When `bb-eval` rejects an adapter you believe is correct

The contract is wrong, the check is wrong, or the adapter is wrong — diagnose in that order:

1. Read `docs/claude/contracts/<domain>/v1.md`. Does the contract really require what `bb-eval` enforces?
2. If yes, the check is right; fix the adapter.
3. If no, file a contract change. Do not weaken `bb-eval` to match a single adapter.
