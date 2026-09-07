---
title: bb-eval
type: wiki-workflow
last_updated: 2026-06-28
---

# bb-eval

`tools/bb-eval` is the **static contract checker** for bb-browser adapters. It is intentionally fast (under 1 second per adapter) and never executes the adapter. Run it as a fast sanity gate; pair it with [`verify-adapter-runtime-shape.js`](runtime-verification.md) for runtime confidence.

## Quick start

```bash
./tools/bb-eval ~/.bb-browser/sites/ysbang/adapters/search.js
./tools/bb-eval --json ~/.bb-browser/sites/ysbang/adapters/search.js
./tools/bb-eval --domain ecommerce ~/.bb-browser/sites/<site>/adapters/<name>.js
./tools/bb-eval --domain pharma-data ~/.bb-browser/sites/yaozh/adapters/yaopinjiage.js
./tools/bb-eval --domain social-media ~/.bb-browser/sites/xiaohongshu/adapters/search.js
```

Exit code is **0** if no FAIL, **1** if any FAIL. WARNs do not change the exit code.

## Check families

### Cross-domain (universal)

Every adapter, regardless of domain, runs these:

| Check | Level | What it verifies |
|---|---|---|
| `meta-block-valid` | FAIL | The `/* @meta { ... } */` block exists and parses as JSON. |
| `url-declared` | FAIL | First 50 lines contain `const FOO_URL = 'https://...'` (the most-violated rule). |
| `meta-name-format` | FAIL | `@meta.name` is `<site>/<adapter>`. |
| `meta-field-*` | FAIL | Required `@meta` fields are present. |
| `meta-example-format` | WARN | `@meta.example` looks like a `bb-browser site ...` command. |
| `forbidden-name` | FAIL | Local adapter name is on the contract's banned list. |
| `canonical-name` | PASS | Local adapter name is in P0/P1. |
| `unknown-name` | WARN | Local adapter name is neither canonical nor forbidden — needs justification. |
| `readonly-mismatch` | FAIL | Mutating adapter (`cart-add`, `like`, ...) declares `readOnly: true`. |
| `error-envelope` | WARN | If the source contains `error:`, it also contains `hint:` and `action:`. |
| `constraint-tracking` | WARN | List adapters populate the trio honestly. |
| `next-actions` | WARN | Adapter populates `recommendedNextActions`. |
| `pagination` | WARN | List adapters surface a `pagination` object. |

### Ecommerce-specific (PHR-* / SOC-* prefixes are reserved)

Ecommerce uses the cross-domain checks plus the forbidden-name list. No domain-specific check family beyond the universal ones (as of 2026-06-28).

### Pharma-data-specific (PHR-* prefix)

12 checks. **Helpers** (`kind: helper`) skip PHR-4, PHR-5, PHR-6, PHR-7 — those checks assume a per-database adapter with `list`/`item` shape.

| Check | Level | What it verifies |
|---|---|---|
| `PHR-1 domain-set` | FAIL | `@meta.domain == 'pharma-data'`. |
| `PHR-2 dbkey-declared` | FAIL | `@meta.dbKey` is present and non-null. |
| `PHR-3 url-constant` | FAIL | First 50 lines contain a URL with `/<dbKey>` slug. |
| `PHR-4 list-function` | FAIL | Adapter exports `async function list`. (Helpers skip.) |
| `PHR-4 item-function` | FAIL | Adapter exports `async function item`. (Helpers skip.) |
| `PHR-5 record-shape` | FAIL | Return shape includes `dbKey`, `id`, `url`, `fields`. Accepts shorthand `id,` not `id:`. (Helpers skip.) |
| `PHR-6 id-detect` | WARN | `item()` contains ID-type discriminator (numeric vs base64). Static check — may WARN if logic is dynamic. (Helpers skip.) |
| `PHR-7 auth-status` | FAIL | Return includes `authStatus` field. (Helpers skip.) |
| `PHR-8 canonical-name` | FAIL / WARN | Adapter name in canonical set (`auth`, `list`, `item`, `search`, `export`, `related`); helper names allowed. |
| `PHR-9 helper-name` | FAIL | `yaozh-auth` must set `@meta.kind = "helper"`. |
| `PHR-10 no-creds` | FAIL | No hardcoded `password=`, `api_key=`, `Bearer <token>`. |
| `PHR-readonly` | FAIL | `readOnly: true` required. |

### Social-media-specific (SOC-* prefix)

13 checks. SOC-13 is WARN because grep can't verify runtime token propagation (same reasoning as PHR-6). SOC-7/8/9 are WARN because grep-based shape detection is coarse. **All FAILs must be resolved before merge.**

| ID | Check | Level |
|---|---|---|
| SOC-1 | `@meta.domain == 'social-media'` | FAIL |
| SOC-2 | `@meta.accessTier` ∈ {anonymous, auth_read, auth_write} | FAIL |
| SOC-3 | `@meta.intent` ∈ {discover, consume, engage, create, manage} | FAIL |
| SOC-4 | adapter-name ↔ intent consistency (`feed` / `search` accept `discover` OR `consume`) | FAIL |
| SOC-5 | write adapters declare `readOnly: false`; read adapters declare `readOnly: true` | FAIL |
| SOC-6 | local name in P0/P1; forbidden patterns FAIL | FAIL |
| SOC-7 | when source contains `error:`, it also contains `hint:` and `action:` | WARN |
| SOC-8 | `recommendedNextActions` present (except `auth`) | WARN |
| SOC-9 | list adapters (`search`, `feed`, `user-notes`, `comments`, `notifications`) contain `pagination` literal | WARN |
| SOC-10 | `authStatus` literal appears in source | FAIL |
| SOC-11 | first 50 lines declare `const HOME_URL = 'https://...'` | FAIL |
| SOC-12 | no hardcoded credentials | FAIL |
| SOC-13 | token-cache logic evidence (`xsecToken` / `noteContext` / similar) | WARN |

## Domain detection

`bb-eval` recognizes three contract domains:

| Heuristic match | Domain |
|---|---|
| `@meta.domain` is `ecommerce` / `pharma-data` / `social-media` (explicit) | that domain |
| `@meta.domain` or `@meta.name` matches `yaozh.com`, `data.yaozh.com` | `pharma-data` |
| `@meta.domain` or `@meta.name` matches `ysbang`, `jd.com`, `pdd.com`, `taobao.com`, `111.com.cn`, `tmall`, `yaoex`, `fangkuaiyi`, `1688` | `ecommerce` |
| `@meta.domain` or `@meta.name` matches `xiaohongshu`, `xhs`, `twitter`, `bilibili`, `discord`, `telegram` | `social-media` |
| Neither matches and no `--domain` flag | `unknown` (most checks skipped) |

> **Bug fix 2026-06-18:** the previous domain-detection heuristic only ran against `@meta.domain`, but ecommerce stores hostname there while pharma-data stores the contract name. Both heuristics now run against both fields.

Pass `--domain <name>` to force.

## What bb-eval does NOT check

These are runtime concerns:

- The endpoint actually exists and returns the documented schema.
- Pagination cursor round-trips correctly.
- Auth is honored (the adapter doesn't silently fail open without login).
- Side effects are bounded (cart-add adds exactly the requested quantity, not more).
- Envelope branches that only fail at runtime (the sandbox verifier covers this). Note: the earlier claim that "anonymous-function syntax errors slipped past bb-eval" was **inverted** by the 2026-09-07 runtime audit — the bare single-function format is what the runtime expects; multi-statement files are what break it, and Check 0 now compiles the body runtime-identically. See [runtime verification](runtime-verification.md).

Use `tools/verify-adapter-runtime-shape.js` for envelope-shape confidence, and bb-browser MCP for end-to-end runtime verification.

## Adding a new check

Edit `tools/bb-eval`. The structure:

1. Source + `@meta` are read into shell variables.
2. `record LEVEL check-name "message"` accumulates results.
3. The output block at the bottom prints text or JSON.

A new check is one block of shell that calls `record`. Keep checks fast (no network, no sub-shell loops over large files).

## When bb-eval rejects an adapter you believe is correct

The contract is wrong, the check is wrong, or the adapter is wrong — diagnose in that order:

1. Read `docs/claude/contracts/<domain>/v1.md`. Does the contract really require what `bb-eval` enforces?
2. If yes, the check is right; fix the adapter.
3. If no, file a contract change. Do not weaken `bb-eval` to match a single adapter.

## Historical bugs and fixes

| Date | Bug | Fix |
|---|---|---|
| 2026-04-22 | `meta-example-format` accepted `bb-browser open` only | Now accepts any `bb-browser ...` command |
| 2026-04-22 | Boolean detection used `jq '// empty'` | Replaced with `has($k) and (.[$k] != null)` |
| 2026-06-16 | `PHR-5 record-shape` only matched `id:`, not shorthand `id,` | Now accepts both |
| 2026-06-16 | `PHR-3 url-constant` ran before `$HEADER` was defined | Reordered to run after Check 1 |
| 2026-06-18 | Domain-detection heuristic only ran against `@meta.domain`, missing ecommerce hostname-only adapters | Now runs against both `@meta.domain` and `@meta.name` |
| 2026-06-19 | Static check did not catch anonymous-function syntax errors in 1688/yaozh adapters | Surfaced in [runtime verification](runtime-verification.md); `node --check` recommended for future bb-eval extension |
| 2026-09-07 | **The 2026-06-19 conclusion was inverted.** The runtime (`site.ts`) evals the body as one expression `(body)(args)`: the bare single-function format is valid, and the June-29 multi-statement rewrite is what broke 43 adapters. `node --check` parses files as standalone modules and reports the opposite verdict. | Check 0 replaced: it now wraps the body as `(body)` and compiles it with `vm.Script` (runtime-identical). Also added `ybm100.com` to the ecommerce hostname heuristics |

## Related

- [Author loop](author-loop.md)
- [Runtime verification](runtime-verification.md)
- [bb-eval usage (canonical)](../../methodology/evaluation/bb-eval-usage.md)
- [Ecommerce contract](../../contracts/ecommerce/v1.md)
- [Pharma-data contract](../../contracts/pharma-data/v1.md)
- [Social-media contract](../../contracts/social-media/v1.md)
