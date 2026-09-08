---
title: Social-media domain
type: wiki-domain
domain: social-media
last_updated: 2026-06-28
canonical_contract: docs/claude/contracts/social-media/v1.md
---

# Social-media domain

Covers sites whose primary user intent is **browse + read + engage + create** — UGC platforms with a social graph (follow / like / comment / favorite). Use this contract for Xiaohongshu, Twitter, Bilibili, Discord, Telegram.

## Why this is a separate domain (not an extension of ecommerce)

The decision record at [`docs/claude/decisions/2026-06-18-why-social-media-contract.md`](../../decisions/2026-06-18-why-social-media-contract.md) walks through this in detail. Short version:

- Ecommerce models **transactions** (buy things). Social-media models **engagement** (browse, read, react, create).
- Forcing social-media into ecommerce loses half the signal (no cart/order → ecommerce's P0 checks become N/A) or under-models the auth surface (no per-note tokens / captcha cooldowns in ecommerce's tier model).
- Social-media has **read AND write** in P0. Ecommerce explicitly bans `order-create` from P0 (too much side effect for autonomous agents). Social-media writes are **reversible** (unlike/unfollow/delete), which is the reason `like`, `follow`, `post-create` are P0 here but `order-create` is forbidden in ecommerce.

## Scope

In scope (as of 2026-06-28): **Xiaohongshu** (`xiaohongshu.com`, `xhslink.com`).

Projected (per `xiaohongshu-cli` README): **twitter.com / x.com**, **bilibili.com**, **discord.com**, **telegram.org / t.me**.

If a site mixes categories (e.g. a platform with both a shop and a social feed), pick the domain by the **user's primary use case for the adapter being authored**, not by the site overall.

## 5-intent classification

Every social-media adapter declares an `intent` in `@meta`:

| Intent | Meaning | Bias | Adapters |
|---|---|---|---|
| `discover` | Find content. | read | `search`, `feed` |
| `consume` | Read a specific thing. | read | `post-detail`, `comments`, `user`, `user-notes`, `notifications`, `unread` |
| `engage` | Interact with content. | write | `like`, `favorite`, `comment-post`, `follow` |
| `create` | Produce new content. | write | `post-create` |
| `manage` | Administer state. | mixed | `auth`, P1 deletes |

`bb-eval SOC-4` cross-checks the adapter name against its declared intent. `feed` and `search` are allowed to declare either `discover` or `consume` (boundary is fuzzy on simplified sites).

## P0 adapter set (13)

| Adapter | Intent | Read/Write | Required `accessTier` | Purpose |
|---|---|---|---|---|
| `auth` | manage | read | `anonymous` | Report current login state. No side effects. |
| `search` | discover | read | `auth_read`* | Keyword (+ optional topic/hashtag, sort, type, page) → `Note[]`. |
| `feed` | discover | read | `auth_read`* | Algorithmic / trending feed. `source` arg. |
| `post-detail` | consume | read | `auth_read` | Single note/post by id. Resolves per-note tokens. |
| `comments` | consume | read | `auth_read` | Top-level comments, paginated. |
| `user` | consume | read | `auth_read` | User profile. |
| `user-notes` | consume | read | `auth_read` | A user's published / liked / favorited notes. |
| `notifications` | consume | read | `auth_read` | Notification feed. |
| `unread` | consume | read | `auth_read` | Unread counts across notification types. |
| `like` | engage | write | `auth_write` | Like (and `--undo` unlike) a post. |
| `favorite` | engage | write | `auth_write` | Bookmark (and undo) a post. |
| `comment-post` | engage | write | `auth_write` | Post a comment / reply. |
| `follow` | engage | write | `auth_write` | Follow / unfollow a user. |
| `post-create` | create | write | `auth_write` | Publish a new post (image / video). |

\* `search` / `feed` may partially work at `anonymous` on some sites. Declare `auth_read` as the tier needed for **full** results; the adapter returns `authStatus: anonymous` if the call succeeded logged-out.

## P1 (implement only when the site exposes them)

`post-delete`, `comment-delete`, `dm-list`, `dm-send`, `follow-list`, `follower-list`. See the [P1 table in the contract](../../contracts/social-media/v1.md).

## Forbidden names (SOC-6 FAILs)

| Name | Why forbidden | Correct approach |
|---|---|---|
| `feed-hot`, `feed-recommendation`, `feed-category`, `feed-following` | Filter-variant of `feed` | `source` arg |
| `search-topic`, `search-hashtag`, `topics` | Topic is a keyword form | `topic` / `hashtag` arg on `search` |
| `user-posts`, `user-favorites`, `user-likes`, `favorites`, `likes` (as separate adapters) | Same intent, different subset | `which-list` arg on `user-notes` |
| `feed-summary`, `note-summary` | Agent always wants full Note | Return full Note objects |
| `hot-categories` | Dead-end enumeration | Document valid categories in `description` |
| `auto-login`, `login-flow` | AGENTS.md #5 | `auth` reports state only |
| `*-debug`, `*-v2` | Dead code | Delete before merge |

## Object schemas

- Note / Author / User / Comment / WriteReceipt: [reference/social-media-note.md](../reference/social-media-note.md)

## Auth model

`anonymous` / `auth_read` / `auth_write`. Every adapter declares its minimum tier in `@meta.accessTier` and returns the tier actually in effect in `authStatus`.

If a `like` call fails with `LOGIN_REQUIRED`, `authStatus` must be `anonymous` (the cookie was stale), not `auth_write`. The returned tier reflects **what was actually in effect**, not the site's theoretical maximum.

## XHS-specific quirks (XHS-only)

These are XHS recon findings from `W:\tmp\xiaohongshu-cli` and the social-media playbook. They are documented here so XHS adapter authors don't re-derive them, but they are **NOT** generalized contract requirements.

| Quirk | What | Where to handle |
|---|---|---|
| `xsec_token` | Per-note access token, bound to source (`pc_search` / `pc_feed` / `pc_explore`). Required on subsequent calls or 403. | Adapter maintains `noteId → xsecToken` cache. SOC-13 WARNs if no cache evidence. |
| Request signing (`x-s` / `x-t`) | Per-request webpack-bundled signing. Tier-3. | Use SPA-click pattern — let XHS web UI sign its own requests. `SIGNATURE_FAILED` recovery. |
| Captcha cooldown | Aggressive writes trigger captcha. | On `CAPTCHA_REQUIRED`, stop. `RATE_LIMITED` recovery is `backoff_and_retry` with 60–300s delay. |
| SPA timing | Vue SPA. Old and new content share selectors. | Three-phase wait (see [workflow/reverse-engineering.md](../workflow/reverse-engineering.md)). |

The contract explicitly does **not** generalize these to "social-media"; they are XHS-specific.

## bb-eval SOC-* checks

| ID | Check | Level |
|---|---|---|
| SOC-1 | `@meta.domain == 'social-media'` | FAIL |
| SOC-2 | `@meta.accessTier` ∈ {anonymous, auth_read, auth_write} | FAIL |
| SOC-3 | `@meta.intent` ∈ {discover, consume, engage, create, manage} | FAIL |
| SOC-4 | adapter name ↔ intent consistency (feed/search accept discover OR consume) | FAIL |
| SOC-5 | write adapters declare `readOnly: false`; read declare `readOnly: true` | FAIL |
| SOC-6 | local name in P0/P1; forbidden patterns FAIL | FAIL |
| SOC-7 | when source contains `error:`, it also contains `hint:` and `action:` | WARN |
| SOC-8 | `recommendedNextActions` present (except `auth`) | WARN |
| SOC-9 | list adapters contain `pagination` literal | WARN |
| SOC-10 | `authStatus` literal in source | FAIL |
| SOC-11 | first 50 lines declare `const HOME_URL = 'https://...'` | FAIL |
| SOC-12 | no hardcoded credentials | FAIL |
| SOC-13 | token-cache evidence (`xsecToken` / `noteContext`) | WARN |

## Real adapters currently in production (xiaohongshu)

13 P0 + 2 P1 = **15 adapters** for xiaohongshu, all **0 FAIL** under both `bb-eval` and the runtime-shape verifier.

| Adapter | intent | tier | bb-eval | runtime-shape |
|---|---|---|---|---|
| `auth` | manage | auth_read | 23 / 0 / 0 | ✅ |
| `search` | discover | auth_read | 27 / 0 / 0 | ✅ |
| `feed` | discover | auth_read | 25 / 0 / 0 | ✅ |
| `post-detail` | consume | auth_read | 25 / 0 / 0 | ✅ (real test) |
| `user` | consume | auth_read | 23 / 0 / 0 | ✅ |
| `user-notes` | consume | auth_read | 25 / 0 / 0 | ✅ |
| `comments` | consume | auth_read | 25 / 0 / 0 | ✅ |
| `notifications` | consume | auth_read | 24 / 0 / 0 | ✅ |
| `unread` | consume | auth_read | 23 / 0 / 0 | ✅ |
| `like` | engage | auth_write | 25 / 0 / 0 | ✅ (real test) |
| `favorite` | engage | auth_write | 26 / 0 / 0 | ✅ |
| `comment-post` | engage | auth_write | 26 / 0 / 0 | ✅ |
| `follow` | engage | auth_write | 25 / 0 / 0 | ✅ |
| `post-create` | create | auth_write | 25 / 0 / 0 | ✅ |
| `post-delete` [P1] | manage | auth_write | 25 / 0 / 0 | ✅ |
| `comment-delete` [P1] | manage | auth_write | 25 / 0 / 0 | ✅ |

**Total: 378 SOC checks / 0 fail** + **16/16 runtime-shape PASS** + 4 adapters (auth/search/post-detail/like) verified with **real browser tests** (MCP eval).

## Related

- [Contract source](../../contracts/social-media/v1.md)
- [Decision record](../../decisions/2026-06-18-why-social-media-contract.md)
- [Design spec](../../../superpowers/specs/2026-06-18-social-media-design.md)
- [Reverse-engineering playbook](../../methodology/reverse-engineering/social-media-playbook.md)
- [Domain overview](choosing-a-domain.md)
