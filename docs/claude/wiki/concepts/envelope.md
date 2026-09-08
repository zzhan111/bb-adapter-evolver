---
title: Response envelope
type: wiki-concept
last_updated: 2026-06-28
---

# Response envelope

Every adapter returns the **same top-level envelope**, regardless of domain. The envelope is what makes adapter outputs chainable.

## Universal shape

```jsonc
{
  "ok": true,                              // false ⇒ error/hint/action MUST be set
  "authStatus": "anonymous|auth_read|auth_write|public|soft_vip|hard_wall",
  "data": <domain-specific payload | null>,
  "constraints": { /* list adapters only */ },
  "pagination": { /* list adapters only */ },
  "recommendedNextActions": [ /* always except `auth` */ ],
  "error": "LOGIN_REQUIRED",               // present only when ok=false
  "hint":  "human-readable explanation",
  "action": "stop_and_wait_for_human"
}
```

The **domain-specific payload** (`data`) follows the contract for the domain. See:

- Ecommerce: [reference/ecommerce-product.md](../reference/ecommerce-product.md), [reference/ecommerce-order.md](../reference/ecommerce-order.md), [reference/ecommerce-cart.md](../reference/ecommerce-cart.md).
- Pharma-data: [reference/pharma-data-record.md](../reference/pharma-data-record.md).
- Social-media: [reference/social-media-note.md](../reference/social-media-note.md).

## Why an envelope?

Three reasons:

1. **Agent chaining.** The agent doesn't have to learn the shape of each adapter's return; it learns the envelope once and follows `recommendedNextActions`.
2. **Uniform error handling.** `error` + `hint` + `action` is the same triple across domains. The agent's "what to do next" code is one switch statement on `action`.
3. **Honest constraints.** `requestedConstraints` / `executedConstraints` / `deferredConstraints` tell the agent what was **actually** applied, not what was assumed. This prevents the agent from trusting the result for a constraint that was silently dropped.

## Error code enum (each code bound to one action)

The `error` field is **a fixed enum** per domain. `action` is **bound to the error** — adapters MUST NOT invent new action values for these codes.

### Universal errors

| `error` | When | `action` |
|---|---|---|
| `LOGIN_REQUIRED` | Site requires login. | `stop_and_wait_for_human` |
| `CAPTCHA_REQUIRED` | Site popped a captcha. | `stop_and_wait_for_human` |
| `RATE_LIMITED` | Frequency cap hit. | `backoff_and_retry` |
| `IP_BLOCKED` | IP banned / region-restricted. | `stop_and_wait_for_human` |
| `NOT_FOUND` | Object doesn't exist or was deleted. | `abort` |
| `PERMISSION_DENIED` | No access (private / blocked). | `abort` |
| `AUTH_EXPIRED` | Cookie / token expired. | `stop_and_wait_for_human` |

### Ecommerce-specific

| `error` | When | `action` |
|---|---|---|
| `OUT_OF_STOCK` | Add-to-cart on an unavailable SKU. | `abort` |
| `MIN_ORDER_NOT_MET` | Wholesale MOQ not reached. | `abort` |
| `STORE_MISMATCH` | Trying to add a product from a different store than the active cart. | `retry_or_abort` |
| `WRITE_FAILED` | Generic write failure. | `retry_or_abort` |

### Pharma-data-specific

| `error` | When | `action` |
|---|---|---|
| `VIP_GATED` | Record is soft_vip; values cleared. | `abort` (no upgrade path) |
| `HARD_LOGIN_WALL` | Whole database behind login. | `stop_and_wait_for_human` (run `yaozh-auth` first) |
| `EXPORT_DENIED` | Export not allowed at current tier. | `abort` |

### Social-media-specific

| `error` | When | `action` |
|---|---|---|
| `SIGNATURE_FAILED` | Request signature rejected (e.g. XHS `x-s`/`x-t` stale). | `refresh_and_retry` |
| `CONTENT_REJECTED` | Write content rejected (banned words, etc.). | `abort` |

## Why the error enum is fixed

If adapters invented `error` strings, every downstream agent would have to maintain a per-adapter error dictionary. With a fixed enum, the agent's error-handling is one switch on `error` × `action`. New errors go through the **contract** (a new ADR + contract version bump), not through the adapter.

## `recommendedNextActions`

Always populated (except by `auth`, which is terminal). Lets the agent chain:

```jsonc
"recommendedNextActions": [
  { "adapter": "post-detail", "args": { "noteId": "abc" }, "why": "Read the top result." },
  { "adapter": "like",        "args": { "noteId": "abc" }, "why": "Like it." }
]
```

The `args` are **literal args** the agent can pass to the next adapter. The `why` is **for humans reading the trace**, not for the agent to parse.

## `constraints` (list adapters only)

```jsonc
"constraints": {
  "requestedConstraints": { "keyword": "咖啡", "sort": "latest", "type": "video" },
  "executedConstraints":   { "keyword": "咖啡", "sort": "latest" },
  "deferredConstraints":   { "type": "video" }    // acknowledged but not applied
}
```

Be honest: do not mark a constraint `executed` if you only acknowledged it. The agent downstream trusts this and may skip the next call. The ysbang anti-pattern was marking `factory` as executed when the code only put it in the deferred list — every agent that consumed that adapter made a wrong "factory is filtered" assumption.

If `deferredConstraints` is non-empty, `recommendedNextActions` MUST contain an entry pointing at the adapter that **can** apply the deferred constraint. `bb-eval` checks this for ecommerce.

## `pagination` (list adapters only)

Hybrid shape — surface both cursor and page so the agent picks the most robust path:

```jsonc
"pagination": {
  "page": 2, "pageSize": 20, "hasMore": true,
  "cursor": "next_cursor_string",
  "nextArgs": { "cursor": "next_cursor_string" }  // copy-paste to next call
}
```

`nextArgs` is what the agent should pass. Never reconstruct a cursor — pass it through unchanged.

## When `ok = false`

```jsonc
{
  "ok": false,
  "authStatus": "anonymous",
  "data": null,
  "error": "LOGIN_REQUIRED",
  "hint": "Run `auth` adapter, then hand control to human for login.",
  "action": "stop_and_wait_for_human",
  "recommendedNextActions": [
    { "adapter": "auth", "args": {}, "why": "Check login state." }
  ]
}
```

Even error responses include `recommendedNextActions` when there is a logical next step (e.g. `auth` after `LOGIN_REQUIRED`).

## Honesty caveat

> The `error-envelope` check uses a coarse grep. An adapter that returns errors via `throw` instead of `return { error: ... }` will silently pass `bb-eval`. Use the runtime verifier (`tools/verify-adapter-runtime-shape.js`) to catch this.

## Related concepts

- [Constraints & pagination](constraints-and-pagination.md) — detailed shape.
- [Error codes reference](../reference/error-codes.md) — full per-domain enum.
- [When to stop and ask the human](../workflow/when-to-stop-and-ask-the-human.md) — error workflow.
