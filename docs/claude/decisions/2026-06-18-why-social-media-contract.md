---
name: Why social-media needs a new contract (not an extension of ecommerce / pharma-data)
type: decision
date: 2026-06-18
status: accepted
---

# Decision: New `social-media` contract domain (not extension of `ecommerce` / `pharma-data`)

## Context

User pointed at `W:\tmp\xiaohongshu-cli` — a CLI that reverse-engineers Xiaohongshu's web API — and asked what kind of adapter contract this repo should create for social-media, aligned with the existing ecommerce and pharma-data contracts.

Initial temptation: reuse `ecommerce` v1, since Xiaohongshu is a consumer-facing site with listings, search, and detail pages. The xiaohongshu-cli README also names four sister CLIs (bilibili-cli, twitter-cli, discord-cli, tg-cli), making clear the category is multi-site, not XHS-only.

Recon (`W:\tmp\xiaohongshu-cli\` — `formatter_normalizers.py`, all five command modules, `SKILL.md`, `SCHEMA.md`, `README.md`) showed the ecommerce reuse assumption was wrong:

- XHS's primary user intent is **browse → read → engage → create**, not transact.
- There is **no cart, no orders, no checkout**, no AES price decryption.
- The API surface is structurally different: per-note access tokens (`xsec_token`), per-request signature headers (`x-s` / `x-t`), captcha cooldowns on writes.
- Engagement (like / favorite / comment / follow / post) is first-class, individually reversible, and the agent's real use case.
- 7+ listing surfaces (search / feed / hot / topics / user-posts / favorites / likes / notifications) all return Note-shaped objects — a listing-sprawl pressure that neither prior contract addresses.

## What was rejected and why

**Option rejected: extend `ecommerce` v1 with new fields / adapters.**

Three concrete reasons it would fail (the same three that motivated the pharma-data split, applied again):

1. **No cart/order primitives means half the existing ecommerce checks are N/A.** Forcing `cart-list`, `cart-add`, `cart-remove`, `checkout-preview`, `order-list`, `order-detail` into the contract for a social site makes them either always-FAIL or always-WARN — losing signal. The ecommerce forbidden-name list (`search-by-*`, `order-create`, etc.) doesn't catch social-media's sprawl pattern (`feed-hot`, `user-posts`, `favorites`).

2. **Different auth surface.** ecommerce has public + tier-2 cookie + tier-3 signature. pharma-data has public + soft_vip + hard_wall. social-media has anonymous + auth_read + auth_write, **plus** per-note access tokens and captcha cooldowns that don't exist in either prior contract. Modelling this as "tier-3 with extra steps" loses the per-note-token quirk that every XHS adapter has to handle.

3. **Engagement semantics are new.** ecommerce forbids `order-create` because order submission is irreversible. social-media writes (like / favorite / comment / follow / post) are individually reversible via `--undo` / delete. This changes the P0 inclusion bar — engagement writes belong in P0, not deferred.

**Option rejected: XHS-only contract (`xiaohongshu` domain).**

The xiaohongshu-cli README explicitly names bilibili-cli, twitter-cli, discord-cli, tg-cli as siblings. A per-site contract would force four more near-duplicate contracts. The repo's stated model is one contract per category of site, validated across multiple sites (ecommerce spans jd/pdd/ysbang/yaoex; pharma-data spans yaozh + future). social-media should span XHS + twitter + bilibili + discord + telegram.

## What was accepted

| Decision | Rationale |
|---|---|
| New contract `docs/claude/contracts/social-media/v1.md` | ecommerce and pharma-data stay untouched; future UGC-with-social-graph sites reuse this contract |
| Canonical adapter set: 13 P0 (`auth`, `search`, `feed`, `post-detail`, `comments`, `user`, `user-notes`, `notifications`, `unread`, `like`, `favorite`, `comment-post`, `follow`, `post-create`) | Covers browse + read + engage + create |
| **Intent-vs-filter rule** (the central granularity decision): one adapter per intent; filter-variants fold into args | Preserves the ysbang lesson (forbid `search-by-*`) while honestly modeling XHS's 7+ listing surfaces as separate adapters (`search` vs `feed` vs `user-notes` are different *intents*, not filter-variants) |
| Fold decisions: `hot`→`feed` (source arg), `topics`→`search` (topic arg), `favorites`+`likes`+`user-posts`→`user-notes` (which-list arg) | Collapses 8 listing surfaces to 4 adapters without losing intent |
| 3 access tiers: `anonymous` / `auth_read` / `auth_write` | Captures the social auth reality without over-fitting XHS |
| `xsecToken` documented as XHS-only quirk (NOT generalized) | Other sites don't have per-note access tokens; generalizing it would pollute their schemas |
| Two new `@meta` fields: `accessTier` + `intent` | Lets the contract self-document; bb-eval cross-checks against adapter name and `readOnly` |
| `WriteReceipt` return shape for all write adapters | Writes return a lightweight receipt (action / targetId / undoable / undoAdapter), not the full Note — undoability is first-class |
| 13 SOC-* bb-eval checks | Mirror the PHR-* structure; 8 FAIL / 5 WARN |
| Full read+write in P0 (including `post-create`) | Unlike ecommerce's `order-create` ban: social posts are individually reversible via `post-delete`, and creator-side use is the agent's primary task |
| Phased rollout SM-1..SM-4 (mirroring the original 4-phase plan) | SM-1 = contract + tooling (this round); SM-2 = ≥3 XHS adapters; SM-3 = cross-site port; SM-4 conditional on evolver |

## Concrete deliverables shipped (SM-1)

- `docs/claude/contracts/social-media/v1.md` — normative contract
- `docs/superpowers/specs/2026-06-18-social-media-design.md` — narrative spec (the "why")
- `docs/claude/decisions/2026-06-18-why-social-media-contract.md` — this file
- `docs/claude/methodology/reverse-engineering/social-media-playbook.md` — XHS recon playbook
- `templates/social-media/TEMPLATE.js` — reference adapter skeleton
- `tools/bb-eval` extended: social-media domain detection + 13 SOC-* checks; ecommerce/pharma-data checks untouched
- `docs/claude/skills/bb-adapter-author/SKILL.md` rule #2 updated to cover all three domains
- `memory/soul.md` — 2026-06-18 entry

## Lessons captured for future agents

- The ysbang anti-pattern (one intent × N filters = N adapters) and the XHS reality (N intents × 1 return type = N adapters) are **not the same thing**. The forbidden-name list must forbid filter-variants, not intent-splits.
- `xsec_token` is XHS's, not social-media's. Generalizing per-platform quirks into the category contract is how schemas become unmaintainable.
- `post-create` in P0 was a real tension (mirrors ecommerce's `order-create` ban), resolved by the reversibility argument: social posts have `post-delete` as recovery; ecommerce orders do not have an equivalent.

## What this decision does NOT commit us to

- **Multi-tenant social graph queries** (`follow-list` / `follower-list` / DMs) — P1. XHS web API doesn't expose them; land them when a site needs them.
- **Live streaming / stories / ephemeral content** — out of scope. If needed, that's a separate domain (`social-live`).
- **Content moderation / report / block** — deferred until a real use case appears; reputation risk.
- **SM-2/3/4** — subsequent phases depend on real adapter runs. Not pre-committed.
- **Phase 4 darwinian_evolver** — still conditional on SM-3 single-shot success rate <30%.
