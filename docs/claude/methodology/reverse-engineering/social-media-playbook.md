---
name: Social-Media Reverse-Engineering Playbook
type: methodology
last_updated: 2026-06-18
applies_to: every adapter that hits a social-media web API (Xiaohongshu, Twitter, Bilibili, Discord, Telegram, ...)
---

# Social-Media Reverse-Engineering Playbook

This extends the general `playbook.md` with social-media-specific hazards. Read both. The general playbook covers capture-first / tier system / pagination lifecycle; this file covers what's different about social platforms.

## Why social-media is harder than ecommerce

| Hazard | ecommerce | social-media |
|---|---|---|
| Per-object access tokens | rare | **common** (XHS `xsec_token`) |
| Per-request signatures | sometimes (tier-3) | **almost always** (XHS `x-s`/`x-t`, twitter) |
| Captcha cooldowns | rare | **common on writes** |
| Write reversibility | order-submit is irreversible | writes are individually reversible (unlike / delete) |
| Content-based failures | rare | **common** (banned words, spam filters) |
| Rate limiting | generous | **aggressive, especially on writes** |

## Capture workflow — social-media additions

Run the general playbook's five steps first. Then:

### Step 3b: Identify per-object tokens

On XHS (and likely other social platforms), every object returned from a listing carries a short-lived access token bound to its source. Look for fields like `xsec_token`, `token`, `access_key` on each item in the response.

**Pattern to recognize:**
```jsonc
// search response items
{ "id": "noteA", "xsec_token": "ABc...", /* ... */ },
{ "id": "noteB", "xsec_token": "XYz...", /* ... */ }   // different token per note!
```

If you see this, your adapter MUST:
1. Surface the token on the Note object (`xsecToken` field).
2. Maintain a `noteId → token` cache populated by listing calls.
3. Pass the cached token when calling `post-detail` / `comments` / `like` for that note.

bb-eval SOC-13 WARNs if the source shows no evidence of this cache.

### Step 3c: Identify per-request signatures

If the captured request has headers like `x-s`, `x-t`, `x-bogus`, `signature`, `x-gorgon` that **change every request even with identical bodies**, the signature is computed per-request inside a JS module. This is tier-3.

The signing module is almost always webpack-bundled. To find it:

1. In the page devtools console, search `window` for objects exposing signing functions:
   ```js
   Object.keys(window).filter(k => /sign|encrypt|x-s/i.test(k))
   ```
2. If not on `window`, look in the webpack chunk graph. Set a breakpoint on the network request in the Sources panel; walk the call stack to find the signing function.
3. Once found, call it from page context (don't reimplement it):
   ```js
   // inside the page, the SPA already exposes something like:
   window._webmsxyw('/api/sns/web/v1/feed', { /* body */ })  // returns { 'x-s': ..., 'x-t': ... }
   ```

The adapter calls this via `bb.eval()` (page-context eval) — never reimplement the signing algorithm. Vendor JS changes break re-implementations; calling the live function does not.

`SIGNATURE_FAILED` error + `refresh_and_retry` action is the recovery path when the signing module isn't reachable.

## Step 5b: Write-operation lifecycle

Social-media writes have a lifecycle that reads don't:

1. **Idempotency check** — many writes are toggle-able (like/unlike). Before writing, check current state to avoid double-actions.
2. **Token propagation** — writes on a specific object need that object's access token (same as reads).
3. **Captcha readiness** — if the account has been captcha-throttled, the write will fail with `CAPTCHA_REQUIRED`. Do NOT retry within 60s.
4. **Rate-limit awareness** — rapid sequential writes trigger `RATE_LIMITED`. Back off 60–300s.

## The `xsecToken` cache pattern (XHS)

This is the single most important XHS-specific pattern. Every XHS adapter author must internalize it.

```javascript
// Module-scope cache, populated by listing adapters, consulted by detail/comment/like adapters.
const noteContextCache = new Map();  // noteId → { xsecToken, source, fetchedAt }

function cacheNoteContext(note) {
  if (note && note.id && note.xsecToken) {
    noteContextCache.set(note.id, {
      xsecToken: note.xsecToken,
      source: note._source || 'unknown',
      fetchedAt: Date.now(),
    });
  }
}

function getNoteContext(noteId) {
  const ctx = noteContextCache.get(noteId);
  if (!ctx) return null;
  // Tokens are source-bound and may rotate; treat cache as best-effort.
  return ctx;
}

// In every listing adapter, after parsing the response:
for (const note of notes) cacheNoteContext(note);

// In post-detail / comments / like / favorite / comment-post:
const ctx = getNoteContext(noteId);
if (!ctx) {
  return {
    ok: false,
    authStatus: 'auth_read',
    error: 'PERMISSION_DENIED',
    hint: `No xsecToken cached for noteId ${noteId}. Run search/feed first to obtain it.`,
    action: 'abort',
  };
}
// ... attach ctx.xsecToken to the request
```

## Captcha cooldown protocol

XHS (and likely twitter, instagram) throttle aggressive writes:

| Symptom | Response |
|---|---|
| Single `CAPTCHA_REQUIRED` | Stop. Return the error. Do NOT retry. Human solves in-page. |
| Repeated `CAPTCHA_REQUIRED` across calls | Account is in cooldown. Back off all writes for ≥300s. |
| `RATE_LIMITED` (429-like) | `backoff_and_retry` with 60–300s delay. |

Never auto-solve captchas. That's the human's job (AGENTS.md #5).

## SPA timing — the XHS case

XHS web is a Vue SPA. The three-phase wait strategy from `playbook.md` applies fully:

- **Phase 1:** old cards gone (`document.querySelectorAll('.note-item').length === 0`)
- **Phase 2:** new cards present with expected child (`.note-item .title`)
- **Phase 3:** count stable for 1.5s

For infinite-scroll feeds (XHS `feed`), there is no "page transition" — append-only. Detect append by watching `length` increase, then stabilize.

## Quick checklist before declaring a social-media adapter done

In addition to the general playbook's checklist:

- [ ] Per-object tokens (if any) surfaced on the object and cached for downstream calls
- [ ] Per-request signature (if any) computed via live page function, not reimplemented
- [ ] Write adapters return `WriteReceipt` with `undoable` + `undoAdapter`
- [ ] `authStatus` reflects the tier actually in effect for this call
- [ ] Captcha / rate-limit errors return the right error code and `action`
- [ ] `recommendedNextActions` chains to the logical next adapter
- [ ] `bb-eval --domain social-media` 0 FAIL
