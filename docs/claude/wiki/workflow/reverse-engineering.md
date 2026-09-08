---
title: Reverse-engineering
type: wiki-workflow
last_updated: 2026-06-28
---

# Reverse-engineering

How to discover the real endpoint, headers, body, and pagination key for any private/auth-gated API. The full playbook is at [`docs/claude/methodology/reverse-engineering/playbook.md`](../../methodology/reverse-engineering/playbook.md); for social-media specifically, see [`social-media-playbook.md`](../../methodology/reverse-engineering/social-media-playbook.md).

## The 5-step flow

### 1. Open the page in the real browser

```bash
bb-browser open <target-url>
```

If login is required and you don't have a session, **stop**. Tell the human to log in. Do not stub. (Per AGENTS.md #5.)

### 2. Capture network with bodies

```bash
bb-browser network --with-body --json --tab <tab-id>
```

While capture is running, perform the user action you want to adapt (search, click product, add to cart, etc.) inside the browser tab. Capture only what's needed; large captures are noisy.

### 3. Identify the actual endpoint

For each candidate request, check:

- **Domain**: matches the API host (often a different subdomain than the page, e.g. `gateway-b2b.fangkuaiyi.com` for `mall.yaoex.com`, `api.ruguoapp.com` for `web.okjike.com`).
- **Method**: usually `POST` for actions, `GET` for reads.
- **Body**: contains the parameters of the action (the search keyword, the sku id).
- **Response**: contains the data you want to surface (product list, cart total).
- **Pagination key**: usually `loadMoreKey` / `cursor` / `sinceId` / `lastReadTime` — note this **exactly**, and pass it through unchanged.

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

- **Pagination**: pass server's `loadMoreKey` / `cursor` back unchanged. Never reconstruct it. Surface it in your adapter's `pagination.nextCursor` and `pagination.nextArgs`.
- **Token refresh**: if the captured request includes a token from `localStorage` / `sessionStorage` / `document.cookie`, **read it inside the adapter at call time, not once at module load**. Tokens rotate.

## Tier system

| Tier | Auth | How to find | Effort |
|---|---|---|---|
| 1 | Cookie only — `credentials: 'include'` is enough | Capture; request works without extra headers | ~1 min |
| 2 | Bearer + CSRF — token in header (`Authorization`, `X-CSRF-Token`, `x-jike-access-token`) | Look in request headers in capture; find token source in localStorage / cookies | ~3 min |
| 3 | Webpack injection / Pinia store / page-runtime signing | Token is built per-request inside JS; you must call into the page's own modules | ~10–30 min |

For tier 3, the pattern is to expose the page's existing function:

```js
// Inside the page context, the SPA already has a function like
// window.__app__.api.cart.add(skuId, qty)
// or the Pinia store: window.__app__.config.globalProperties.$store
// Find it once, call it from your adapter.
```

If you cannot find the page-bound function, fall back to capture + manually compute the signature (last resort, brittle).

## SPA timing patterns (Vue / React)

SPA presents a specific hazard: **the same CSS selector exists on the current page and the target page**. `waitFor(() => selector.length > 0)` resolves on the WRONG page.

### The ysbang case (2026-05-18)

- Home page: 200 `.all-goods-wrapper` cards (recommendations, NO `.goods-name span`).
- Search results: 65 `.all-goods-wrapper` cards (WITH `.goods-name span`).
- `waitFor` resolved on home page cards → adapter extracted 0 products.

### Three-phase wait strategy (the fix)

```javascript
// After triggering navigation (click, form submit):
// Phase 1: old content disappears
await waitFor(() => document.querySelectorAll(SELECTOR).length === 0, 5000, 100);

// Phase 2: new content appears WITH expected child elements
await waitFor(() => {
  const items = document.querySelectorAll(SELECTOR);
  return items.length > 0 && !!items[0].querySelector(EXPECTED_CHILD);
}, 10000, 200);

// Phase 3: count stabilizes (no changes for 1.5s)
let stable = 0, last = -1;
while (stable < 3) {
  await delay(500);
  const n = document.querySelectorAll(SELECTOR).length;
  if (n === last && n > 0) stable++; else stable = 0;
  last = n;
}
```

### Rules

1. **Never trust `selector.length > 0` alone** — verify content quality (child elements).
2. **Never trust manual `browser_eval` for timing** — `site_run` has different page state.
3. **Monitor the transition** — write a 5-second logging loop to capture the full DOM timeline.
4. **Document in CLAUDE.md** — record timing patterns in the site's CLAUDE.md for future agents.

## XHS-specific (see also social-media-playbook)

| XHS quirk | Solution |
|---|---|
| `cookieStore.getAll()` reveals `a1` cookie that `document.cookie` hides | Use `cookieStore` (or in Node-VM mocks, return the full set) |
| `INITIAL_STATE` is Vue refs with `_value` indirection | Recursively unwrap `.x_value`; nested refs need multiple unwrap steps |
| `_webmsxyw()` is only a partial signature (length=0, returns `{X-s, X-t}` only) | Don't try to call it; rely on SPA-click instead |
| Per-note `xsec_token` must accompany `noteId` in URL | Adapter maintains `noteId → xsecToken` cache |
| `/explore/<id>` without token → 300 redirect to `/explore` | Always carry `?xsec_token=<token>&xsec_source=pc_search` |
| Note IDs are 24-char not 16-char | Validate length before constructing URLs |
| `code 300011` | XHS 风控「当前账号存在异常」— cannot be hand-crafted; use SPA-click |
| `code -101` | No login info — cookie didn't propagate server-side |

## What a "minimal failure log" looks like

When the adapter fails in production, the agent or human needs to know:

- Which endpoint was attempted (final URL)
- HTTP status
- A short snippet of the response body (truncated, no secrets)
- The list of fallback endpoints if any were tried

Return these in the adapter's output when `args.debug === true`. Default to silent in normal runs.

## Quick checklist before declaring done

- [ ] Captured the real endpoint, not guessed it.
- [ ] Tested the minimal request standalone in console.
- [ ] Pagination cursor surfaced in `pagination.nextCursor` (passed through unchanged).
- [ ] Token read at call time, not module load.
- [ ] Fallback endpoints (if any) listed in priority order.
- [ ] `error/hint/action` triple set on every error path.
- [ ] `bb-eval` passes.

## Related

- [Author loop](author-loop.md)
- [Auth tiers](../concepts/auth-tiers.md)
- [Playbook (canonical)](../../methodology/reverse-engineering/playbook.md)
- [Social-media playbook](../../methodology/reverse-engineering/social-media-playbook.md)
