---
title: social-media adapter contract v1 — design spec
date: 2026-06-18
status: approved (user pre-approved design sections 1–5)
domain: social-media
related:
  - docs/claude/contracts/social-media/v1.md
  - docs/claude/decisions/2026-06-18-why-social-media-contract.md
  - W:/tmp/xiaohongshu-cli (reference recon source)
---

# social-media adapter contract v1 — design spec

This is the narrative spec (the "why"). The normative contract lives in
`docs/claude/contracts/social-media/v1.md` (the "what an adapter must do").

## Origin

User pointed at `W:\tmp\xiaohongshu-cli` (a CLI that reverse-engineers
Xiaohongshu's web API) and asked: "what kind of social-media adapter contract
should this repo create, aligned with the existing ecommerce / pharma-data
contracts?"

The xiaohongshu-cli README explicitly names four sister CLIs (bilibili-cli,
twitter-cli, discord-cli, tg-cli). The category is multi-site from day one.

## Brainstorming decisions (5 clarifying questions, all answered)

| # | Question | Choice |
|---|---|---|
| 1 | Scope | **social-media (multi-site)** — generic contract for UGC platforms with a social graph. XHS now; Twitter/Bilibili/Discord/Telegram later. |
| 2 | Writes | **Read + Write, P0 includes writes.** Unlike ecommerce (which forbids `order-create` because order submission is irreversible), social writes are individually reversible (unlike / unfollow / delete-comment / delete-post). |
| 3 | Listing model | **Separate adapter per intent.** Honest engagement with the ysbang lesson: ysbang's sin was one *intent* split by *filters*; XHS's reality is genuinely different *intents* that share a return type. The rule is "separate adapter per intent; forbid filter-variants within an intent." |
| 4 | Intent boundaries | **Fold hot/topics/collections into parents (~13 adapters).** `hot`→`feed` (source arg), `topics`→`search` (topic arg), `favorites`+`likes`+`user-posts` merge into one `user-notes` adapter (which-list arg). |
| 5 | Auth model | **3 tiers + per-note token as documented quirk.** anonymous / auth_read / auth_write, with XHS's `xsec_token` documented as an XHS-only quirk (not generalized). |

## The intent-vs-filter distinction (the central design rule)

This contract's entire granularity philosophy hangs on one distinction:

- **Intent-split** (allowed) = genuinely different user purposes that happen to
  share a return type. "I'm searching" ≠ "I'm browsing the algorithm" ≠
  "I'm looking at one user's work". The ecommerce contract already does this:
  `search`, `order-list`, `cart-list` are three separate listing adapters.
- **Filter-variant** (forbidden) = one intent split by an argument. "Search by
  price" vs "search by factory" vs "search by provider" — ysbang's 38-adapter
  anti-pattern that the project was founded to prevent.

The ysbang lesson is preserved *and* XHS's 7+ listing surfaces get modeled
honestly. `feed-by-category` stays forbidden (category is an arg); `search` vs
`feed` vs `user-notes` are allowed (different intents).

## Canonical adapter set

13 P0 adapters, grouped by intent (the `@meta.intent` enum):

| intent | adapters |
|---|---|
| `discover` | `search`, `feed` |
| `consume` | `post-detail`, `comments`, `user`, `user-notes`, `notifications`, `unread` |
| `engage` | `like`, `favorite`, `comment-post`, `follow` |
| `create` | `post-create` |
| `manage` | `auth`, `post-delete`, `comment-delete` (latter two are P1) |

P1 (implement only when the site exposes them): `post-delete`, `comment-delete`,
`dm-list`/`dm-send`, `follow-list`/`follower-list`.

Forbidden adapter names (bb-eval SOC-6 enforces): `feed-hot`, `feed-recommendation`,
`feed-category`, `search-topic`, `search-hashtag`, `topics`, `user-posts`,
`user-favorites`, `user-likes`, `favorites`, `likes`, `hot-categories`,
`feed-summary`, `note-summary`, `*-debug`, `*-v2`.

## Object model

Three polymorphic cores, derived from xiaohongshu-cli's
`formatter_normalizers.py` but flattened to a single agent-friendly layer:

- **Note** — `id`, `url`, `type` (image|video), `title`, `desc`, `author`,
  `tags[]`, `topics[]`, `stats{likes,likesLabel,collections,comments,shares}`,
  `mediaCount`, `publishedAt`, `xsecToken`, `scrapedAt`.
- **Author / User** — Author is the nested form (id/nickname/url); User is the
  full form (add redId, desc, ipLocation, gender, stats{fans,follows,interaction}).
- **Comment** — `id`, `noteId`, `author`, `content`, `stats{likes,subComments}`,
  `subComments[]`, `createdAt`, `url`.
- **WriteReceipt** — `action`, `targetId`, `resultId`, `undoable`, `undoAdapter`,
  `undoHint`, `url`. Write adapters return this instead of the full object.

Naming convention: full-English camelCase + nested `stats` object (not
snake_case + flat, as the XHS raw API uses). Rationale matches ecommerce's
`priceValue`/`changePercent`: agent-friendly numeric comparison, future field
additions don't pollute the top level.

## Response envelope (shared across all adapters)

```
{ ok, data, authStatus, constraints?, pagination?, recommendedNextActions?,
  error?, hint?, action? }
```

- `authStatus` reflects the tier *that was actually in effect for this call*,
  not the site's theoretical maximum.
- Pagination is hybrid (cursor + page + hasMore + nextArgs).
- 10 fixed error codes, each bound to one `action` enum value:
  LOGIN_REQUIRED, CAPTCHA_REQUIRED, RATE_LIMITED, SIGNATURE_FAILED, IP_BLOCKED,
  NOT_FOUND, PERMISSION_DENIED, CONTENT_REJECTED, WRITE_FAILED, AUTH_EXPIRED.
- `recommendedNextActions` chains adapters (search → post-detail → like).

## `@meta` block — two social-media-specific fields

In addition to the 7 base fields all domains share
(name/description/domain/args/capabilities/readOnly/example), social-media
requires:

- **`accessTier`** — `anonymous` | `auth_read` | `auth_write`. Declares the
  minimum tier this adapter needs. Lets the contract self-document; bb-eval
  checks write adapters can't be anonymous/auth_read.
- **`intent`** — `discover` | `consume` | `engage` | `create` | `manage`.
  Declares which user-intent this adapter serves. Prevents intent confusion
  (an adapter shouldn't cross intents). bb-eval SOC-4 checks adapter-name ↔
  intent consistency.

## bb-eval SOC-* check family

13 new checks (mirroring the PHR-* structure):

| ID | Check | Level |
|---|---|---|
| SOC-1 | `@meta.domain == 'social-media'` | FAIL |
| SOC-2 | `@meta.accessTier` in enum | FAIL |
| SOC-3 | `@meta.intent` in enum | FAIL |
| SOC-4 | adapter-name ↔ intent consistency (feed/search allow discover or consume) | FAIL |
| SOC-5 | write adapters readOnly:false; read adapters readOnly:true | FAIL |
| SOC-6 | canonical name; forbidden patterns fail | FAIL |
| SOC-7 | error envelope includes hint+action when error present | WARN |
| SOC-8 | recommendedNextActions present (auth exempt) | WARN |
| SOC-9 | pagination object in list adapters | WARN |
| SOC-10 | authStatus literal in source | FAIL |
| SOC-11 | HOME_URL constant in first 50 lines | FAIL |
| SOC-12 | no hardcoded credentials | FAIL |
| SOC-13 | token-cache logic evidence (xsecToken / noteContext) | WARN |

bb-eval domain detection extended: XHS/twitter/bilibili/discord/telegram hosts
route to `social-media`. Existing ecommerce/pharma-data checks untouched (new
logic in a new `if [[ "$DOMAIN" == "social-media" ]]` branch).

## Verification strategy

XHS serves as the reference recon source (mirroring how yaozh validated the
pharma-data contract). Phased:

| Phase | Action | Done-when |
|---|---|---|
| SM-1 (this round) | Contract + bb-eval SOC checks + decision doc + playbook + template | bb-eval recognizes `--domain social-media`; ecommerce/pharma-data adapters don't regress |
| SM-2 | Write ≥3 XHS adapters (search read + post-detail read + like write) using SKILL workflow | All 0 FAIL on bb-eval; examples pass via bb-browser MCP |
| SM-3 | Cross-site: port ≥1 adapter to twitter or bilibili | Proves contract non-XHS-specific |
| SM-4 (conditional) | darwinian_evolver only if SM-3 single-shot success <30% | data-driven |

## What this contract does NOT commit to

- **Multi-tenant social graph queries** (`follow-list`/`follower-list`/DM) —
  deferred to P1. XHS web API doesn't expose these; twitter does. Land them
  when a site needs them.
- **Live streaming / stories / ephemeral content** — out of scope. If needed,
  that's a separate domain (`social-live`), not an extension here.
- **Content moderation / report / block** — out of scope. Reputation-risk
  operations deferred until a real use case appears.
- **Phase 4 evolver** — conditional on SM-3 data, same gate as the original
  4-phase plan.

## Honest caveats on SOC checks

- All SOC checks are **static** (grep-based). Same limitation as PHR checks.
- SOC-13 (token-cache logic) is WARN, not FAIL — static scanning for token
  propagation is unreliable, same reasoning as PHR-6 (id-detect).
- SOC-4 (intent-name consistency) allows `feed`/`search` to be either
  `discover` or `consume` because on simplified platforms (single-API sites)
  the boundary blurs. Other pairings (e.g. `like` labeled `create`) are real
  errors and FAIL.
- The forbidden-name list (SOC-6) is XHS-informed. When twitter/bilibili land,
  we may need to revisit whether `topics` / `hot-categories` should stay
  forbidden globally or become site-specific.
