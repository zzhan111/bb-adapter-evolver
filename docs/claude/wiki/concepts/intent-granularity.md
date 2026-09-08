---
title: Intent and Granularity
type: wiki-concept
last_updated: 2026-06-28
---

# Intent and granularity

The single most violated rule in past adapter work is **granularity**. This page explains the rule and why it matters.

## The rule

> **One adapter per intent. Fold filter-variants into args.**

Two tests follow from this:

1. If two adapter names differ only by a filter (`search-by-price` vs `search-by-factory`), they are the **same adapter** with different `args`. Collapse them.
2. If two adapter names serve **different user intents** (`search` vs `feed` vs `user-notes`), they are different adapters even if they happen to return similar shapes. Keep them.

## What "intent" means

An **intent** is the verb the agent is performing on behalf of the user. The five canonical intents:

| Intent | Meaning | Read/Write bias |
|---|---|---|
| `discover` | Find content (search, feed, browse). | read |
| `consume` | Read a specific thing (post-detail, user profile, single record). | read |
| `engage` | Interact with content (like, comment, follow, favorite). | write |
| `create` | Produce new content (post-create, comment-post is engage, not create). | write |
| `manage` | Administer state (auth, delete, settings). | mixed |

Each domain contract maps its adapter names to intents. `bb-eval SOC-3 / SOC-4` enforce this for social-media; ecommerce uses the same shape implicitly.

## Worked examples

| Adapter name | Verdict | Why |
|---|---|---|
| `search` | ✅ canonical | intent = discover |
| `search-by-price` | ❌ forbidden | filter-variant of `search` (intent = discover) |
| `search-topic` | ❌ forbidden | topic is an arg of `search` |
| `feed-hot`, `feed-recommendation`, `feed-category`, `feed-following` | ❌ forbidden | filter-variant of `feed`; use `source` arg |
| `feed` | ✅ canonical | intent = discover |
| `post-detail` | ✅ canonical | intent = consume (one specific note) |
| `user-posts`, `user-likes`, `user-favorites` as separate adapters | ❌ forbidden | same intent ("list a user's notes"), different subset; fold into `user-notes` with `which-list` arg |
| `like` | ✅ canonical | intent = engage |
| `post-create` | ✅ canonical | intent = create |
| `order-create` (ecommerce) | ❌ forbidden | side effect too large for autonomous agent; use `checkout-preview` + human submit |
| `auto-purchase` (ecommerce) | ❌ forbidden | orchestration, not adapter |
| `auto-login` / `login-flow` | ❌ forbidden | AGENTS.md #5: login is the human's job |

## Why this rule exists

Imagine an agent sees a UI and wants to act on it. With correct granularity, the agent has at most ~9 ecommerce or ~13 social-media P0 adapter names to consider. With wrong granularity (the ysbang anti-pattern), the agent has to look up "which of the 38 names applies here?" — knowledge that lives nowhere except in the human's head.

The contract enumerates the canonical names **so the agent doesn't have to enumerate them**. The forbidden list enumerates the anti-patterns **so the agent can recognize and skip them**.

## How the contract enforces this

Every domain contract has a **forbidden-name table** with three columns:

| Name | Why forbidden | Correct approach |

`bb-eval` rejects any adapter whose local name matches a forbidden pattern. Examples:

- Ecommerce: `search-by-*`, `cart-summary`, `order-create`, `submit-order`, `auto-purchase`, `*-debug`.
- Pharma-data: `<dbKey>-list`, `<dbKey>-detail`, `<filter>-list`, `<dbKey>-debug`.
- Social-media: `feed-hot`, `feed-recommendation`, `search-topic`, `user-posts`, `user-favorites`, `user-likes`, `favorites`, `likes` (as separate adapters), `*-debug`, `*-v2`.

## Tension: when do two adapters deserve to be one?

Two questions to ask:

1. **Same intent, different data subset?** They are the same adapter. Use an arg.
2. **Different user verbs?** Different adapters.

Examples:

- `cart-list` returns the cart. `cart-summary` would return totals only. Same intent ("know my cart"). Forbidden — `cart-list` returns both totals and items.
- `comments` returns top-level comments. `sub-comments` would return nested. Same intent ("read the comment thread"). The contract lets `comments --all` auto-paginate, but the schema lets you return `subComments` inline. One adapter, optional recursion.
- `search` returns notes by keyword. `feed` returns notes by algorithmic source. **Different intents** ("I know what I want" vs "show me something"). Both canonical.

## Related concepts

- [Adapter](adapter.md) — what the granularity rule applies to.
- [Contract](contract.md) — where the rule is codified.
- [Anti-patterns](../reference/anti-patterns.md) — the ysbang 38-adapter incident and what to learn from it.
- [Choosing a domain](../domains/choosing-a-domain.md) — when to introduce a new domain instead of stretching an existing one.
