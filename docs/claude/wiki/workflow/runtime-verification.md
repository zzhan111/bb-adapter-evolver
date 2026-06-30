---
title: Runtime verification
type: wiki-workflow
last_updated: 2026-06-28
---

# Runtime verification

`tools/verify-adapter-runtime-shape.js` is a **sandboxed runtime verifier** that runs each adapter in a Node `vm` context with mocked browser APIs and inspects the returned envelope. It catches bugs `bb-eval` cannot.

## Why both checkers?

| Tool | What it sees | What it misses |
|---|---|---|
| `bb-eval` (static) | `@meta` block, source keywords, URL constants, no-creds | Anonymous-function syntax errors, undefined variables at call time, envelope shape at runtime |
| `verify-adapter-runtime-shape.js` (sandbox) | Envelope shape, error paths, basic meta validation | Real DOM selectors, real API responses, real timing |

You need both. The static check is fast and catches contract violations; the runtime verifier catches **bugs the static check was never going to find**.

## Why this tool exists (2026-06-19 incident)

SM-2.8 attempted to **really test** all 16 social-media adapters via bb-browser MCP, but `browser_eval` started returning `{}` mid-session and `browser_close_all` only closed tracked tabs. The MCP eval channel was broken.

The fix was a sandbox runtime-shape verifier — run the adapter in Node `vm` with mocked `bb.goto` / `bb.eval` / `window`, inspect the returned object. This caught a class of bugs `bb-eval` had silently approved:

- **14 ecommerce/pharma-data adapters** (`1688/*` × 12 + `yaozh-auth` + `yaopinzhongbiao`) declared `async function(args) { ... }` — anonymous function expression, which is **invalid JavaScript** (and silently broken when called as a named export).
- **bb-eval never noticed** because it only greps for keywords.

After the fix, **16/16 social-media adapters PASS** the runtime-shape check; cross-domain regression exposed 14 silently broken ecommerce/pharma-data adapters.

## How to use it

```bash
node tools/verify-adapter-runtime-shape.js \
  --adapter ~/.bb-browser/sites/xiaohongshu/adapters/auth.js

# Multiple adapters
node tools/verify-adapter-runtime-shape.js \
  --adapters ~/.bb-browser/sites/xiaohongshu/adapters/

# With a custom mock for INITIAL_STATE
node tools/verify-adapter-runtime-shape.js \
  --adapter ./auth.js \
  --mock '{"INITIAL_STATE":{"user":{"userInfo":{"_value":{"userId":"abc"}}}}}'
```

Exit code is **0** if all adapters PASS, **1** otherwise. Output is JSON when `--json` is passed.

## What the sandbox provides

| API | Mock | Purpose |
|---|---|---|
| `bb.goto(url)` | records the call, resolves to `{ url }` | Lets adapters navigate |
| `bb.eval(js)` | executes in vm context, returns last expression | Lets adapters read page state |
| `bb.fetch(url, opts)` | records the call, returns mock JSON | Lets adapters call APIs |
| `window.fetch` | same as `bb.fetch` | Adapter compatibility |
| `window.location.href` | configurable per test | URL context |
| `document.cookie` / `cookieStore` | configurable per test | Auth context |
| `INITIAL_STATE` / `__INITIAL_STATE__` | configurable per test | XHS, yaoex page state |
| `console.*` | captured into stderr | Debugging |

The sandbox runs **synchronous mocks** to keep tests deterministic. Real adapters that `await` long-running APIs need their mocks to resolve immediately.

## What it checks

| Check | What |
|---|---|
| Module syntax | Adapter file parses; named export exists. |
| `@meta` validity | Block parses as JSON; required fields present per domain. |
| Envelope shape | Returned object has `ok`, `data`/`error`, `recommendedNextActions`, etc. |
| Error path | When `ok: false`, `error` + `hint` + `action` are all set and `action` is one of the bound enum values. |
| Constraints | List adapters return the trio honestly; `deferredConstraints` non-empty implies a `recommendedNextActions` entry exists. |
| Pagination | List adapters return a `pagination` object with `hasMore`. |
| Auth status | Returned `authStatus` ∈ the domain's tier enum. |
| Access tier (SOC) | `@meta.accessTier` matches the returned `authStatus` for read adapters (warning if mismatch). |

## What it does NOT check

- **Real DOM selectors.** Mocked selectors return canned data; an adapter that picks the wrong selector in production will still PASS here.
- **Real API responses.** Mocks are hand-written or default; the adapter could be calling the wrong endpoint entirely.
- **Signing correctness.** Mocked `_webmsxyw()` returns `{ X-s, X-t }`; the real XHS signing requires 5 headers, not 2.
- **Timing.** Mocks resolve synchronously; SPA timing bugs (race conditions, missing waits) won't be caught.

**bb-browser MCP `browser_eval` is still ground truth.** The runtime verifier is the next-best thing when MCP is unavailable, and a useful pre-flight when MCP is available.

## Honest caveats

> Runtime-shape verifier is not a real-browser test. It validates envelope shape + error paths + meta fields. It does not validate:
> - The site's actual API accepting the adapter's request.
> - DOM selectors finding the right elements (XHS class name change would break production).
> - Signature validity (`adapter` calls `_webmsxyw()` but mock returns null).
> - Timing issues (wait 200ms vs wait 2000ms).
>
> MCP real test is still ground truth — the runtime-shape verifier gives higher confidence than pure static `bb-eval`, but it is not a substitute.

## Related

- [bb-eval](bb-eval.md)
- [Author loop](author-loop.md)
- [Verifier source](../../../../tools/verify-adapter-runtime-shape.js)
- [Memory 2026-06-19 (SM-2.8)](../../../../memory/soul.md)
