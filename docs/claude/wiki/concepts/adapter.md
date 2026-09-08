---
title: What is an adapter?
type: wiki-concept
last_updated: 2026-06-28
---

# What is an adapter?

A **bb-browser adapter** is a JavaScript file under `~/.bb-browser/sites/<site>/adapters/<name>.js` that exposes a single async function turning structured **args** into a structured **envelope** that an AI agent can chain.

## Anatomy of an adapter

```javascript
/* @meta
{
  "name": "xiaohongshu/search",
  "description": "Search Xiaohongshu notes by keyword, topic, or hashtag.",
  "domain": "social-media",
  "args": [
    { "name": "keyword", "type": "string", "required": true }
  ],
  "capabilities": ["read", "list"],
  "readOnly": true,
  "accessTier": "auth_read",
  "intent": "discover",
  "example": "bb-browser site xiaohongshu/search --keyword '咖啡'"
}
*/

const HOME_URL = 'https://www.xiaohongshu.com';

async function search(args) {
  // 1. Validate args
  // 2. Ensure context (navigate if needed)
  // 3. Call the real API (or extract from page state)
  // 4. Map to contract schema
  // 5. Return envelope
  return { ok: true, authStatus: 'auth_read', data: [...], ... };
}
```

Every adapter file is **one intent, one entry point**. The `@meta` block is the schema; the function body is the implementation.

## What an adapter is NOT

| Not this | Why |
|---|---|
| A UI automation script | It does not "click around". It calls the real API once the endpoint is known, or extracts from already-loaded page state. |
| A workflow / orchestration | It does not compose other adapters. Recipes do that. |
| A scraper in the raw sense | It returns structured JSON conforming to a contract, not arbitrary HTML. |
| A long-running server | It runs once per call. No state survives between calls (except via the `args` round-trip). |
| A login flow | Per AGENTS.md #5, login is the human's job. The `auth` adapter only **reports** state. |

## Why one file = one intent

A single intent is the smallest unit the agent can reason about. If the granularity is finer (one filter per adapter), the agent has to know which adapter to call for which filter — that knowledge lives in the agent's head, not in the contract. If the granularity is coarser (search + cart-add + checkout all in one), the agent has to filter the result to know what it got.

**One adapter per intent; fold filter-variants into args.** This rule is enforced by every domain's `forbidden-name` list (see [reference/anti-patterns.md](../reference/anti-patterns.md)).

## Where adapters live

```
~/.bb-browser/sites/<site>/adapters/<name>.js
```

`<site>` is a directory name (e.g. `ysbang`, `yaoex`, `xiaohongshu`, `yaozh`). `<name>` is the canonical local adapter name from the domain contract (e.g. `search`, `cart-list`, `auth`). The `@meta.name` field combines them: `"ysbang/search"`.

This repo (`bb-adapter-evolver`) **does not** ship adapters. It ships the contract + tooling + methodology that define what makes an adapter acceptable. Adapters are written in the consuming repo (`bb-browser` or whatever runs `~/.bb-browser/`) and committed there.

## Related concepts

- [Contract](contract.md) — what the adapter must follow.
- [Intent & granularity](intent-granularity.md) — the "one intent per adapter" rule.
- [Auth tiers](auth-tiers.md) — how access is classified.
- [Envelope](envelope.md) — the standard return shape.
- [Domain overview](../domains/ecommerce.md) — pick the right contract for your site.
