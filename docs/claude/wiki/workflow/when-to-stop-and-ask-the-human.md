---
title: When to stop and ask the human
type: wiki-workflow
last_updated: 2026-06-28
---

# When to stop and ask the human

AGENTS.md #5: **login is the human's job**. The agent must not paper over login with stubbed cookies, hard-coded test tokens, or "TODO: replace before commit" placeholders. This page lists every stop-and-ask gate, why it exists, and what to ask.

## The hard rule

> When the adapter needs the user's session, **stop and ask the human**. Do not auto-create cookies. The human will log in via the browser.

This is non-negotiable. Every write adapter that mutates the user's account, every read adapter that requires login, every flow that touches a captcha — all of these require human intervention.

## The four stop-and-ask gates

### Gate 1: Login required

**Trigger**: any adapter whose `authStatus` is `auth_read` or `auth_write` (social-media) or whose auth is tier-2+ (ecommerce) needs the user to be logged in.

**Why**: stubbing cookies is a lie. The user reviews the agent's actions; if they review and see `authStatus: auth_read` when no real session exists, they trust a result that wasn't real.

**What to ask**:

> "I'm about to author `<adapter-name>`. It needs the site to be logged in. Please open `<url>` in your browser and log in. I'll wait, then continue."

After the user logs in, the agent proceeds with capture and authoring.

### Gate 2: No domain contract exists

**Trigger**: the site belongs to a category with no contract (`docs/claude/contracts/<domain>/v1.md` is missing).

**Why**: drafting a contract is a design decision, not an authoring decision. The user needs to approve scope, auth model, and P0 set before any code is written.

**What to ask**:

> "There's no contract for `<domain>` yet. Should I:
> 1. Draft a new contract (longer, ~1 hour),
> 2. Stretch an existing contract (faster, may need revisions later), or
> 3. Wait until you've decided?"

### Gate 3: Tier-3 multi-step auth

**Trigger**: the captured network shows a CSRF token issued by an HTML page, then sent in a JSON body; or a webpack-bundled signing module that must be injected; or per-request signing with rotating keys.

**Why**: tier-3 is ~10–30 min of work per adapter. The user might decide this isn't worth the cost (the site may have a public read-only API, the user may not actually need writes, etc.).

**What to ask**:

> "Tier-3 detected: the request requires `<specifics>`. This is ~30 min of work. Is this worth it for the adapter you want, or should we:
> 1. Drop the mutating call (use a read-only equivalent),
> 2. Capture and replay only (brittle, may break weekly), or
> 3. Invest in full tier-3 implementation?"

### Gate 4: Mutating state without undo

**Trigger**: the requested adapter would mutate server state without an obvious undo (order-create, payment, account-deletion, follower-spam).

**Why**: these side effects are too large for autonomous execution. The user is responsible for any consequences.

**What to ask**:

> "`<adapter-name>` would `<describe side effect>`. This action cannot be undone (or only manually). Should I:
> 1. Implement `<adapter-name>` as requested (you'll be asked to confirm at runtime),
> 2. Implement a `<safe-alternative>` (e.g. `checkout-preview` for ecommerce) instead, or
> 3. Skip this adapter entirely?"

Ecommerce already encodes this: `order-create` is in the forbidden list. `checkout-preview` is the safe alternative. Use the same pattern for any irreversible write.

## Stop-and-ask during runtime

Even after the adapter is written, there are runtime gates where the agent should pause:

| Runtime signal | Action |
|---|---|
| `ok: false, error: "LOGIN_REQUIRED"` | `action: "stop_and_wait_for_human"` — ask user to log in |
| `ok: false, error: "CAPTCHA_REQUIRED"` | `action: "stop_and_wait_for_human"` — ask user to solve captcha in browser |
| `ok: false, error: "RATE_LIMITED"` | `action: "backoff_and_retry"` — back off 60–300s; do not retry immediately |
| `ok: false, error: "IP_BLOCKED"` | `action: "stop_and_wait_for_human"` — ask user about proxy / region |
| `ok: false, error: "AUTH_EXPIRED"` | `action: "stop_and_wait_for_human"` — ask user to re-login |
| `ok: false, error: "SIGNATURE_FAILED"` | `action: "refresh_and_retry"` — re-capture signature |
| `ok: false, error: "NOT_FOUND"` | `action: "abort"` — object unreachable; skip |
| `ok: false, error: "PERMISSION_DENIED"` | `action: "abort"` — skip |
| `ok: false, error: "CONTENT_REJECTED"` | `action: "abort"` — revise content; retry |

The `action` enum is **bound to the `error` code** by the contract. Adapters MUST NOT invent new action values.

## What you should NOT do

| Anti-pattern | Why it's wrong |
|---|---|
| Stub a test cookie in the adapter source | The shipped adapter will use the stub, not real auth. |
| Hardcode a session token | Tokens rotate. The adapter will break in days. |
| Mark `authStatus: auth_read` when cookies are dead | The agent downstream trusts this. |
| Skip the gate because "it's just a read adapter" | Even reads can leak the user's identity if auth is broken. |
| Auto-retry `LOGIN_REQUIRED` repeatedly | Wastes time; the user has to act first. |

## What you SHOULD do

| Best practice | Why |
|---|---|
| Read the cookie at call time, not at module load | Tokens rotate between calls. |
| Return `authStatus: anonymous` when the cookie is stale | Honest reporting; the agent knows it must wait. |
| Use `action: "stop_and_wait_for_human"` for the gates | Uniform error handling across adapters. |
| Document login state in `recommendedNextActions` | The agent knows the next call is `auth` then `wait`. |
| Surface the login URL in `hint` | The user knows where to go. |

## Related

- [Auth tiers](../concepts/auth-tiers.md)
- [Envelope](../concepts/envelope.md)
- [Error codes reference](../reference/error-codes.md)
- [AGENTS.md #5](../../../../AGENTS.md)
