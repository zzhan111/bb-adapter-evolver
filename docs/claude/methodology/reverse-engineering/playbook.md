---
name: Reverse-Engineering Playbook
type: methodology
last_updated: 2026-04-22
applies_to: every adapter that hits a private/auth-gated API
---

# Reverse-Engineering Playbook

This is the **default** flow. Skipping any step is how past adapters ended up calling endpoints that never existed (see `~/.bb-browser/docs/solutions/documentation-gaps/jike-following-feed-adapter.md`).

## The five steps

### 1. Open the page in the real browser

Via bb-browser MCP:

```bash
bb-browser open <target-url>
```

If login is required and you don't have a session, **stop**. Tell the human to log in. Do not stub.

### 2. Capture network with bodies

```bash
bb-browser network --with-body --json --tab <tab-id>
```

While capture is running, perform the user action you want to adapt (search, click product, add to cart, etc.) inside the browser tab. Capture only what's needed; large captures are noisy.

### 3. Identify the actual endpoint

For each candidate request, check:

- **Domain**: matches the API host (often a different subdomain than the page, e.g. `api.ruguoapp.com` for `web.okjike.com`)
- **Method**: usually `POST` for actions, `GET` for reads
- **Body**: contains the parameters of the action (the search keyword, the sku id)
- **Response**: contains the data you want to surface (product list, cart total)
- **Pagination key**: usually `loadMoreKey` / `cursor` / `sinceId` / `lastReadTime` — note this exactly, and pass it through unchanged

**Forbidden:** writing the adapter against `/api/v1/<noun>/list` because "that's how these things are usually named". The jike adapter shipped broken for exactly this reason.

### 4. Build the smallest reproducible request

Inside the page's devtools console, run the request standalone:

```js
fetch('https://api.example.com/...', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-csrf-token': '...' },
  credentials: 'include',
  body: JSON.stringify({ keyword: 'foo', limit: 1 })
}).then(r => r.json()).then(console.log)
```

If this works, you have the truth. Now go write the adapter.

If this fails (401 / 403 / signature error), the request needs more than cookies. Either a header-bound token (look in `localStorage`, page-bound `window.__INITIAL_STATE__`, or a webpack module export) or a signed body. This is **tier 3**. Plan for ~10–30 min of work.

### 5. Pagination + auth lifecycle

Two things that always bite:

- **Pagination**: pass server's `loadMoreKey` / `cursor` back unchanged. Never reconstruct it. Surface it in your adapter's `pagination.nextCursor`.
- **Token refresh**: if the captured request includes a token from `localStorage` / `sessionStorage` / `document.cookie`, read it inside the adapter at call time, not once at module load. Tokens rotate.

## Auth taxonomy (tier system from bb-browser README)

| Tier | Auth | How to find | Effort |
|---|---|---|---|
| 1 | Cookie only — `credentials: 'include'` is enough | Capture, request works without extra headers | ~1 min |
| 2 | Bearer + CSRF — token in header (`Authorization`, `X-CSRF-Token`, `x-jike-access-token`) | Look in request headers in capture; find token source in localStorage / cookies | ~3 min |
| 3 | Webpack injection / Pinia store / page-runtime signing | Token is built per-request inside JS, not stored as a flat string. You must call into the page's own modules. | ~10–30 min |

For tier 3, the pattern is to expose the page's existing function:

```js
// Inside the page context, the SPA already has a function like
// window.__app__.api.cart.add(skuId, qty)
// or the Pinia store: window.__app__.config.globalProperties.$store
// Find it once, call it from your adapter.
```

If you cannot find the page-bound function, fall back to capture + manually compute the signature (last resort, brittle).

## What a "minimal failure log" looks like

When the adapter fails in production, the agent or human needs to know:

- Which endpoint was attempted (final URL)
- HTTP status
- A short snippet of the response body (truncated, no secrets)
- The list of fallback endpoints if any were tried

Return these in the adapter's output when `args.debug === true`. Default to silent in normal runs.

## Quick checklist before declaring done

- [ ] Captured the real endpoint, not guessed it
- [ ] Tested the minimal request standalone in console
- [ ] Pagination cursor surfaced in `pagination.nextCursor`
- [ ] Token read at call time, not module load
- [ ] Fallback endpoints (if any) listed in priority order
- [ ] `error/hint/action` triple set on every error path
- [ ] `bb-eval` passes
