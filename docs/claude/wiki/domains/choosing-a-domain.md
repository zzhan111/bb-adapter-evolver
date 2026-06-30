---
title: Choosing a domain
type: wiki-domain
last_updated: 2026-06-28
---

# Choosing a domain

When you sit down to author an adapter for a new site, the **first** decision is which contract to use. Get this wrong and the rest of the work is fighting the contract instead of authoring the adapter.

## The three-question test

Answer these three questions about the **user's primary intent** for the adapter:

| Question | If yes | If no |
|---|---|---|
| **Q1. Does the site have a cart → checkout → order flow?** | Ecommerce candidate. | Skip ecommerce. |
| **Q2. Are records (data documents) the primary content?** | Pharma-data candidate. | Skip pharma-data. |
| **Q3. Is user-generated content + social graph the primary content?** | Social-media candidate. | None of these — escalate. |

## Decision matrix

| Q1 cart/checkout | Q2 records | Q3 UGC+social | Domain |
|---|---|---|---|
| Yes | — | — | `ecommerce` |
| No | Yes | — | `pharma-data` |
| No | No | Yes | `social-media` |
| No | No | No | **None — escalate.** |
| Yes | Yes | — | **Both — pick by primary use case.** |
| Yes | — | Yes | **Both — pick by primary use case.** |

When multiple domains match, **pick by the user's primary use case for this adapter**, not by what the site as a whole does. A platform with both a shop and a social feed can have both ecommerce and social-media adapters; each follows its own contract.

## Worked examples

| Site | Q1 | Q2 | Q3 | Verdict | Why |
|---|---|---|---|---|---|
| `jd.com` | ✅ | — | — | ecommerce | B2C marketplace, classic cart+order |
| `mall.yaoex.com` | ✅ | — | — | ecommerce | B2B wholesale, cart+order (Phase 3) |
| `db.yaozh.com` | ❌ | ✅ | ❌ | pharma-data | Data lookup; no cart/order; no UGC |
| `xiaohongshu.com` | ❌ | ❌ | ✅ | social-media | UGC with social graph; no cart |
| `taobao.com` | ✅ | ❌ | ❌ | ecommerce | Has cart and order (note: shop recommendations are not UGC) |
| `weibo.com` | ❌ | ❌ | ✅ | social-media | UGC + social graph, no cart |

## When to add a new domain

Three signals indicate the existing contracts can't accommodate a site:

1. **Forced FAILs.** You find yourself with 5+ FAILs on P0 checks that don't apply (e.g. cart-add FAILs on a site with no cart). The contract is wrong, not your adapter.
2. **Cross-cutting access model.** The site's auth model has dimensions not in the existing contracts (e.g. pharma-data's `soft_vip` didn't fit ecommerce's tier system).
3. **Different primary intent.** The site's user intent is **browse + read + engage + create** but no existing contract models all four (this is what created `social-media`).

If you see these, **draft a new domain**. The process:

1. Read prior decisions for format: [`docs/claude/decisions/2026-06-18-why-social-media-contract.md`](../../decisions/2026-06-18-why-social-media-contract.md).
2. Write [`docs/superpowers/specs/YYYY-MM-DD-<domain>-design.md`](../../../superpowers/specs/) — the brainstorming output.
3. Write [`docs/claude/decisions/YYYY-MM-DD-why-<domain>-contract.md`](../../decisions/) — the ADR.
4. Write [`docs/claude/contracts/<domain>/v1.md`](../../contracts/) — the contract.
5. Extend `tools/bb-eval` with the domain's check family (`PHR-*`, `SOC-*`, `<DOM>-*`, etc.).
6. Write `templates/<domain>/TEMPLATE.js` and at least 3 real adapters per P0 set.
7. Update this wiki's domain pages and the [glossary](../glossary.md).

## Common wrong choices (and the fix)

| Wrong choice | Why it's wrong | Fix |
|---|---|---|
| Stretch ecommerce to cover a UGC site | Forces 5+ FAILs on cart/order checks; misses the engage/create axis | Use `social-media` or draft a new domain |
| Stretch ecommerce to cover a data lookup site | Forces FAILs on cart; misses the public/soft_vip/hard_wall axis | Use `pharma-data` or draft a new domain |
| Add a new domain when one fits | Splits the agent's mental model unnecessarily | Re-read the three-question test |
| Pick by site category, not by adapter use case | A marketplace with a community forum should still use ecommerce for the shop adapters and social-media for the forum adapters | Pick per-adapter, not per-site |

## Related

- [Ecommerce](ecommerce.md)
- [Pharma-data](pharma-data.md)
- [Social-media](social-media.md)
- [Decisions index](../decisions/index.md)
