---
title: Auth tiers
type: wiki-concept
last_updated: 2026-06-28
---

# Auth tiers

Authentication is the **hardest** part of writing an adapter. Every domain contract declares an auth model and every adapter must declare what tier it needs.

There are **two different taxonomies** in the repo, used in different domains:

| Domain | Taxonomy | Per-adapter field |
|---|---|---|
| Ecommerce (and the universal `playbook`) | tier-1 / tier-2 / tier-3 (effort-based) | implicit |
| Pharma-data | `public` / `soft_vip` / `hard_wall` (data access) | `authStatus` |
| Social-media | `anonymous` / `auth_read` / `auth_write` (functional) | `accessTier` (declared) + `authStatus` (returned) |

The ecommerce tier model is **how to implement** the adapter. The pharma-data and social-media tier models are **what the site returns**. An adapter implements tier-2 to declare `accessTier: auth_read`.

## Ecommerce tier system (implementation effort)

The playbook at `docs/claude/methodology/reverse-engineering/playbook.md` defines this 3-tier system. It answers "how much work is this adapter?".

| Tier | Auth | How to find it | Effort | Example |
|---|---|---|---|---|
| 1 | Cookie only, naive `fetch` | Capture; request works with just `credentials: 'include'`. | ~1 min | Public product page, no personalization |
| 2 | Bearer + CSRF, or signed body | Look in captured headers; find token in `localStorage` / cookies. | ~3 min | ysbang most APIs, jd cart, pdd order list |
| 3 | Webpack injection / Pinia store / page-runtime signing | Token is built per-request inside JS; you must call into the page's own modules. | ~10–30 min | XHS signing (`x-s`/`x-t`), yaoex AES price decryption |

**AGENTS.md #3:** "Tier-2/Tier-3 is the default assumption. Cookie-only is the exception, only for genuinely public pages." If your `search` adapter is tier-1 on a logged-in B2C site, you are almost certainly wrong — re-check by capturing network with `bb-browser network --with-body` while logged in.

## Pharma-data access levels (data access)

`docs/claude/contracts/pharma-data/v1.md` defines three access levels for **records**:

| Level | Meaning | Adapter behavior |
|---|---|---|
| `public` | Anyone can read. No login. | Adapter reads and returns full data. |
| `soft_vip` | Record shows up in the list, but detail fields are gated (literally shows "查看" / "view" button). | Adapter returns `vipGatedFields: [...field names...]`, **clears** the field values, and tells the agent how to upgrade. Never invents values. |
| `hard_wall` | The whole database is behind login; nothing renders for anonymous users. | Adapter returns `authStatus: hard_wall` with an explicit hint pointing to the `yaozh-auth` helper. No data is fabricated. |

The `authStatus` field is **the level that was actually in effect for this call**, not the site's theoretical maximum.

## Social-media access tiers (functional)

`docs/claude/contracts/social-media/v1.md` defines three tiers based on **what the agent is trying to do**:

| Tier | Meaning | Adapters that declare it |
|---|---|---|
| `anonymous` | Works logged-out. | `auth`, `search` (partial), `feed` (partial on some sites) |
| `auth_read` | Login required, but only to read. | `search`, `feed`, `post-detail`, `comments`, `user`, `user-notes`, `notifications`, `unread` |
| `auth_write` | Login required AND the account must be in good standing (not captcha-throttled, not rate-limited). | `like`, `favorite`, `comment-post`, `follow`, `post-create`, plus P1 writes |

`@meta.accessTier` declares the **minimum** tier the adapter needs. The returned `authStatus` reflects the tier **in effect for this call**.

## How these interact

| If the site is tier-3 to implement AND the data is auth_read | The adapter must do tier-3 (webpack injection / runtime signing) just to expose auth_read functionality. |
| If the data is hard_wall | The adapter returns `authStatus: hard_wall` regardless of how the implementation works. |
| If a write to social-media hits a captcha | `authStatus` is `anonymous` (the cookie was stale), not `auth_write`. |

The auth tier you return is **about what the user can do**, not about how the adapter is implemented. A tier-3 implementation that exposes an `auth_read` feature returns `authStatus: auth_read`.

## What to do when the adapter needs login

Per AGENTS.md #5: **stop and ask the human**. Do not stub cookies. The agent downstream will trust `authStatus` to make autonomy decisions; a fake `authStatus: auth_read` when the cookie is dead is a contract violation, not a corner case.

Workflow:

1. Adapter detects `LOGIN_REQUIRED` (cookie missing, session dead, captcha required).
2. Returns `{ ok: false, error: 'LOGIN_REQUIRED', hint: '...', action: 'stop_and_wait_for_human' }`.
3. Human logs in via the browser.
4. Agent retries.

## Related concepts

- [Adapter](adapter.md) — where auth tiers are declared.
- [Contract](contract.md) — where each domain's tier model is defined.
- [Envelope](envelope.md) — where `authStatus` lives in the return shape.
- [When to stop and ask the human](../workflow/when-to-stop-and-ask-the-human.md) — the gating workflow.
