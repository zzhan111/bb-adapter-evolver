---
title: Constraints and pagination
type: wiki-concept
last_updated: 2026-06-28
---

# Constraints and pagination

Two pieces of the envelope deserve their own page because their **honesty** is what separates a good adapter from a ysbang-style one.

## Constraints

The constraint trio is **mandatory** for list adapters (`search`, `feed`, `user-notes`, `comments`, `notifications` for social-media; `search`, `cart-list`, `order-list` for ecommerce; `list` for pharma-data).

```jsonc
"constraints": {
  "requestedConstraints": { "keyword": "咖啡", "sort": "latest", "type": "video" },
  "executedConstraints":   { "keyword": "咖啡", "sort": "latest" },
  "deferredConstraints":   { "type": "video" }
}
```

| Field | What | Why |
|---|---|---|
| `requestedConstraints` | Every constraint the caller asked for. | The agent knows what was requested, not what was silently dropped. |
| `executedConstraints` | What the adapter actually applied to the request or local filter. | The agent can trust the result to satisfy these. |
| `deferredConstraints` | What was acknowledged but not applied. | The agent knows it needs a follow-up call to satisfy these. |

### Why this trio exists

In ysbang's `search.js`, the adapter marked `factory` as `executedConstraints` when the code only put it in the deferred list. Every downstream agent that consumed that adapter assumed "factory is filtered", which was a lie.

The constraint trio is a **lie-detector**. If a constraint is in `deferredConstraints`, the agent knows to make a follow-up call. If it's in `executedConstraints`, the agent trusts the result. The two states are **mutually exclusive** — never both.

### When `deferredConstraints` is non-empty

`recommendedNextActions` MUST contain an entry pointing at the adapter (or arg shape) that **can** apply the deferred constraint. Example:

```jsonc
"recommendedNextActions": [
  { "adapter": "search", "args": { "type": "video" }, "why": "Retry with type filter applied." }
]
```

`bb-eval` (ecommerce `constraint-tracking` check) verifies this invariant.

### Honesty test

Before commit, ask: "if I gave this envelope to an agent that knew nothing about my site, would it correctly predict what was filtered?" If not, fix the trio.

## Pagination

List adapters also return a `pagination` object. The hybrid shape lets agents pick the most robust path:

```jsonc
"pagination": {
  "page": 2, "pageSize": 20, "hasMore": true,
  "cursor": "next_cursor_string",
  "totalItems": 137,         // when the server provides it
  "totalPages": 7,           // ditto
  "nextArgs": { "cursor": "next_cursor_string" }
}
```

| Field | When present |
|---|---|
| `page` | Always (1-based). |
| `pageSize` | Always (the count actually returned this page). |
| `hasMore` | Always. |
| `cursor` | Cursor-based sites (XHS search, most modern APIs). |
| `totalItems`, `totalPages` | Only when the server provides them. Some sites cap pageSize and never return totals (yaoex search returns `pageCount` only). |
| `nextArgs` | Always (when `hasMore`). The agent can copy-paste this to the next call. |

### `nextArgs` is the contract

`nextArgs` is **the single most useful field** for an agent. It is a complete arg object the agent can pass directly. Never reconstruct a cursor or page number from `page` + `pageSize` arithmetic; pass the cursor through unchanged. Site cursors are opaque and break under arithmetic.

### `loadMoreKey` is a real example

yaoex search returns `{ pageCount, hasMore }` but no cursor. The adapter computes the next page from `page + 1` and passes that back in `nextArgs.page`. This is fine because yaoex is page-based, not cursor-based. For cursor-based sites, always pass the cursor.

### `hasMore` vs `totalPages`

`hasMore` is the **canonical** signal. Some sites return `totalPages` that disagrees with reality (cached, stale, or just wrong). Trust `hasMore` first; use `totalPages` for display only.

## How `bb-eval` enforces this

| Domain | Check | Level |
|---|---|---|
| Ecommerce | `constraint-tracking` | WARN |
| Ecommerce | `pagination` | WARN |
| Social-media | SOC-9 (pagination literal present for list adapters) | WARN |
| Social-media | SOC-8 (next-actions present except for `auth`) | WARN |

These are **WARN** because grep can't verify the *content* of the constraint trio — only that the field exists. Use the runtime verifier to confirm the values are honest.

## Related concepts

- [Envelope](envelope.md) — where these live in the return shape.
- [Author loop](../workflow/author-loop.md) — when to populate each field.
- [Anti-patterns](../reference/anti-patterns.md) — the lying-about-constraints anti-pattern.
