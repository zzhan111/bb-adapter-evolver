---
title: Error code reference
type: wiki-reference
last_updated: 2026-06-28
---

# Error code reference

The fixed enum of `error` codes per domain and the bound `action` for each. **Always check the canonical contracts** — this page is the wiki summary.

## Why a fixed enum?

If adapters invented `error` strings, every downstream agent would maintain a per-adapter error dictionary. With a fixed enum, the agent's error handling is **one switch on `error` × `action`** across all adapters and domains.

New errors go through the contract (a new ADR + version bump), not through the adapter. Adapters MUST NOT invent new action values for existing codes.

## Universal codes (any domain)

| `error` | When | `action` | Domain-specific notes |
|---|---|---|---|
| `LOGIN_REQUIRED` | Site requires login to read. | `stop_and_wait_for_human` | All domains |
| `CAPTCHA_REQUIRED` | Site popped a captcha. | `stop_and_wait_for_human` | All domains (especially social-media writes) |
| `RATE_LIMITED` | Frequency cap hit. | `backoff_and_retry` | All domains; 60–300s delay |
| `IP_BLOCKED` | IP banned / region-restricted. | `stop_and_wait_for_human` | All domains |
| `NOT_FOUND` | Object doesn't exist or was deleted. | `abort` | All domains |
| `PERMISSION_DENIED` | No access (private / blocked). | `abort` | All domains |
| `AUTH_EXPIRED` | Cookie / token expired. | `stop_and_wait_for_human` | All domains |

## Ecommerce-only

| `error` | When | `action` |
|---|---|---|
| `OUT_OF_STOCK` | Add-to-cart on unavailable SKU. | `abort` |
| `MIN_ORDER_NOT_MET` | Wholesale MOQ not reached. | `abort` |
| `STORE_MISMATCH` | Adding from a different store than the active cart. | `retry_or_abort` |
| `WRITE_FAILED` | Generic write failure. | `retry_or_abort` |

## Pharma-data-only

| `error` | When | `action` |
|---|---|---|
| `VIP_GATED` | Record is soft_vip; values cleared. | `abort` |
| `HARD_LOGIN_WALL` | Whole database behind login. | `stop_and_wait_for_human` |
| `EXPORT_DENIED` | Export not allowed at current tier. | `abort` |

## Social-media-only

| `error` | When | `action` |
|---|---|---|
| `SIGNATURE_FAILED` | Request signature rejected (e.g. XHS `x-s`/`x-t` stale). | `refresh_and_retry` |
| `CONTENT_REJECTED` | Write content rejected (banned words). | `abort` |

## Action enum

The full set of action values:

| Action | Meaning |
|---|---|
| `stop_and_wait_for_human` | Stop the agent loop; ask the human to intervene. |
| `backoff_and_retry` | Back off 60–300s; retry the same call. |
| `refresh_and_retry` | Re-capture token / signature; retry. |
| `retry_or_abort` | Try once more; abort if still failing. |
| `abort` | Skip the current object; do not retry. |

## Binding rule

Each `error` code maps to **exactly one** `action`. Adapters MUST NOT:

- Invent new action values.
- Return one of the bound actions for a non-bound error (e.g. returning `stop_and_wait_for_human` for `OUT_OF_STOCK` is wrong; `OUT_OF_STOCK` is `abort`).
- Return an `error` code not in the enum (use the closest enum value; if nothing fits, file a contract change).

## Honesty caveat

The `error-envelope` check uses a coarse grep. An adapter that returns errors via `throw` instead of `return { error: ... }` will silently pass `bb-eval`. Use `tools/verify-adapter-runtime-shape.js` to catch this.

## See also

- [Envelope](../concepts/envelope.md)
- [Ecommerce contract](../../contracts/ecommerce/v1.md)
- [Pharma-data contract](../../contracts/pharma-data/v1.md)
- [Social-media contract](../../contracts/social-media/v1.md)
- [When to stop and ask the human](../workflow/when-to-stop-and-ask-the-human.md)
