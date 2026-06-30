---
title: What is a contract?
type: wiki-concept
last_updated: 2026-06-28
---

# What is a contract?

A **contract** is a normative document under `docs/claude/contracts/<domain>/v1.md` that defines, for a given **domain** (category of website):

1. Which adapter names are canonical (the **P0 set**) and which are allowed-when-applicable (the **P1 set**).
2. What each adapter must return — the **envelope**, the **object schemas**, the **error code enum**.
3. Which names are **forbidden** (anti-patterns).
4. What `@meta` fields are required.
5. Which `bb-eval` checks enforce the above.

Contracts are **versioned**. `v1` is frozen once shipped so existing adapters stay reproducible. Breaking changes go to `v2` with a migration note pointing back to `v1`.

## Why contracts exist

> Without a contract, every new request becomes a new adapter, and the surface area grows monotonically.

That is the observation from `ysbang/`'s 38 adapters, most of which were filter-variants of `search` (`search-by-price`, `search-by-factory`, `search-by-provider`, ...). Each one duplicated ~200 lines of search-page navigation. Each one was a dead end for agents that didn't know which to call.

The contract collapses those 38 adapters into the **9 P0 ecommerce adapters** (`auth`, `search`, `product`, `cart-list`, `cart-add`, `cart-remove`, `checkout-preview`, `order-list`, `order-detail`).

## Current contracts

| Domain | Path | P0 adapters | Authored |
|---|---|---|---|
| `ecommerce` | [`docs/claude/contracts/ecommerce/v1.md`](../../contracts/ecommerce/v1.md) | 9 | Phase 1 (2026-04-22) |
| `pharma-data` | [`docs/claude/contracts/pharma-data/v1.md`](../../contracts/pharma-data/v1.md) | 3 + helper | Phase 2 (2026-06-16) |
| `social-media` | [`docs/claude/contracts/social-media/v1.md`](../../contracts/social-media/v1.md) | 13 + 6 P1 | Phase 3 (2026-06-18) |

## Anatomy of a contract

Each `v1.md` follows a similar shape:

1. **Purpose** — what this contract is for and what it is not.
2. **Scope** — what sites belong to this domain.
3. **Auth model** — the tiers used (`public`/`soft_vip`/`hard_wall` for pharma-data, `anonymous`/`auth_read`/`auth_write` for social-media, tier-1/2/3 for ecommerce).
4. **Canonical adapter set** — P0 (required) and P1 (allowed-when-applicable) with intent, read/write, and minimum auth tier per adapter.
5. **Forbidden names** — anti-patterns with the correct approach.
6. **Object model** — the canonical shapes for products / orders / records / notes / users.
7. **Response envelope** — top-level return shape, error codes (fixed enum bound to actions), constraints, pagination, next actions.
8. **`@meta` requirements** — required fields per domain.
9. **`bb-eval` checks** — which checks enforce which rules.
10. **Domain-specific quirks** (optional) — e.g. `xsec_token` for XHS, AES price decryption for yaoex. These are documented **as quirks, not generalized contract requirements**.
11. **Worked examples** — minimal `@meta` + return shapes for the most common adapter types.

## How a contract becomes enforceable

1. The contract text is written.
2. `tools/bb-eval` is extended with a check family (`PHR-*` for pharma-data, `SOC-*` for social-media) that encodes the rules in shell+jq.
3. Reference adapters (`templates/<domain>/TEMPLATE.js`) are written to demonstrate the contract.
4. Real adapters are authored against the contract and pass `bb-eval` with 0 FAIL.
5. The contract is **frozen** at v1.

## How to add a new domain

1. Read `docs/claude/decisions/2026-06-18-why-social-media-contract.md` for the format of a domain-creation decision record.
2. Write `docs/superpowers/specs/YYYY-MM-DD-<domain>-design.md` (brainstorming output).
3. Write `docs/claude/decisions/YYYY-MM-DD-why-<domain>-contract.md` (the ADR).
4. Write `docs/claude/contracts/<domain>/v1.md` (the contract).
5. Extend `tools/bb-eval` with the domain's check family.
6. Write `templates/<domain>/TEMPLATE.js` and at least 3 real adapters per P0 set.
7. Update this wiki's [domains section](../domains/) and the [glossary](../glossary.md).

## When the contract and the adapter disagree

The contract always wins. If `bb-eval` rejects an adapter you believe is correct:

1. Read the contract. Does it really require what `bb-eval` enforces?
2. If yes, fix the adapter.
3. If no, file a **contract change** (ADR + new minor version). Do not weaken `bb-eval` to match a single adapter.

The contract is the load-bearing wall; the checker is the inspection scaffold; adapters are the bricks. You don't knock out the wall because a brick doesn't fit.

## Related concepts

- [Adapter](adapter.md) — what follows the contract.
- [Intent & granularity](intent-granularity.md) — how contracts constrain names.
- [Domains index](../domains/ecommerce.md) — which contract to use.
- [Decisions index](../decisions/index.md) — why each contract exists.
