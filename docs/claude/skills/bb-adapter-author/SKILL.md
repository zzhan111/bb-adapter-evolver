---
name: bb-adapter-author
description: Author a bb-browser adapter end-to-end — declare destination URL, reverse-engineer the actual API by capture, follow the contract for the site's domain, score with bb-eval, run example via bb-browser MCP, request human help when login is needed. Use when asked to write or fix any file under ~/.bb-browser/sites/<site>/adapters/.
---

# bb-adapter-author

You are about to write or modify a bb-browser adapter. **Stop and read this in full before touching any file.** Past adapter work has accumulated specific failure modes that are easy to repeat.

## Inviolable rules

These are derived from `~/.openclaw/workspace/bb-adapter-evolver/AGENTS.md`. Violating any of them means the adapter will fail `bb-eval` and will not be merged.

1. **Declare the destination URL up front.** First 50 lines must contain a constant naming the canonical entry URL. No exceptions.
2. **Do not invent the adapter granularity.** Match the contract for the site's domain:
   - **ecommerce** → one of the nine P0 names in `docs/claude/contracts/ecommerce/v1.md` (or a justified P1). No `search-by-X` variants; filters are `search` arguments.
   - **pharma-data** → `auth`, `list`, `item`, `search`, `export`, `related`, with the adapter name matching the dbKey (e.g. `yaozh/yaopinjiage`). No `<dbKey>-list` variants; filters are `list()` arguments; details are `item()`.
   - **social-media** → one of the thirteen P0 names in `docs/claude/contracts/social-media/v1.md` (or a justified P1). The granularity rule is **one adapter per intent; fold filter-variants into args**. `feed-hot`/`feed-category` are forbidden (use the `source` arg on `feed`). `search-topic`/`topics` are forbidden (use the `topic` arg on `search`). `user-posts`/`favorites`/`likes` as separate adapters are forbidden (use the `which-list` arg on `user-notes`). `search` vs `feed` vs `user-notes` are allowed — they are different *intents*, not filter-variants.
3. **Assume tier-2 or tier-3.** Only fall back to tier-1 (cookies + naive fetch) when the page is genuinely anonymous and you have proven it via network capture.
4. **Capture before you code.** If you have not run `bb-browser network --with-body` against the actual logged-in user flow, you do not know the real endpoint. The biggest waste in past adapters was guessing endpoints (see `methodology/reverse-engineering/playbook.md` and `~/.bb-browser/docs/solutions/documentation-gaps/jike-following-feed-adapter.md`).
5. **When login is required, stop and ask the human.** Do not paper over it with stubbed cookies. The user wants to be in the loop for any session-dependent action.
6. **Output must follow the contract for the domain.** Read `docs/claude/contracts/<domain>/v1.md`. The contract names every field, every constraint list, every recommendedNextActions entry.
7. **Run `tools/bb-eval` before declaring done.** Every FAIL must be fixed. WARNs are negotiable but should be acknowledged in the commit message.

## Author workflow

```
1. READ the contract for the domain
   → docs/claude/contracts/<domain>/v1.md
   → If no contract exists for this domain, stop and ask the human whether to draft one.

2. IDENTIFY the adapter name
   → Match against the P0/P1 set in the contract.
   → If the requested name is forbidden (e.g. search-by-price), explain to the user
     and propose folding the request into the canonical adapter.

3. CAPTURE the real API
   → Open the target page via bb-browser MCP.
     If login is required → STOP. Tell the human you need them to log in.
   → Use bb-browser network --with-body to record the user flow that triggers
     the data you need.
   → Identify: endpoint URL, method, headers, body, response shape, pagination key.

4. AUTHOR the adapter
   → Start the file with the @meta block (all required fields per contract).
   → Declare the URL constant(s) in the first 50 lines.
   → Implement: validate args → ensure context (navigation if needed) → call API
     → map to contract schema → return.
   → Populate requestedConstraints / executedConstraints / deferredConstraints honestly.
     Do NOT mark a constraint as executed when you only acknowledged it.
   → Populate recommendedNextActions to chain to logical next adapter.

5. SCORE with bb-eval
   → tools/bb-eval <path-to-adapter>
   → Fix every FAIL.

6. RUN the example
   → Execute the @meta.example command via bb-browser MCP.
   → If output is empty or wrong, return to step 3 (your endpoint is wrong).
   → If output passes, snapshot it under fixtures/<domain>/<site>-<adapter>.json
     for future regression.

7. COMMIT
   → Follow AGENTS.md commit format: <type>(<scope>): <summary> in English.
```

## Anti-patterns observed in past adapters

These come from auditing `~/.bb-browser/sites/ysbang/adapters/`. Do not repeat them.

| Anti-pattern | What was done | Why it's wrong |
|---|---|---|
| Filter explosion | Created `search-by-price`, `search-by-factory`, `search-by-provider`, `search-by-expriation_date`, `search-by-free-shipping` as separate adapters | Each duplicates 200 lines of search-page navigation. Filters are search arguments, not adapters. |
| Stubbed sessions | Hard-coded test cookies and "TODO: replace before commit" | Always shipped. Use bb-browser MCP with real human login. |
| Lying about constraints | Marked `factory` as `executedConstraints` when the code only put it in a deferred list | Agent downstream trusts this and skips the next call. Be honest. |
| Missing destination URL | Adapter starts with `async function(args) { const token = ...` and never references the URL it's bound to | Reader (human or agent) cannot tell what page this is for. |
| Adapter that submits orders | `order-create.js`, `auto-purchase.js` ship in production | Side effects too large for autonomous agent. Use `checkout-preview` and require human submit. |
| Endpoint guessing | Wrote adapter against guessed `*/list` / `*/feed` paths | Captured network is the only source of truth. |
| jq `// empty` for boolean fields | Used `jq -r '.readOnly // empty'` to check field existence | `//` is jq's "alternative" operator — `false // empty` returns empty. Use `has($k) and (.[$k] != null)` instead. |

## SPA Timing Patterns (learned from ysbang/search, 2026-05-18)

Vue.js/React SPAs present a specific hazard: **the same CSS selector exists on the current page and the target page**. `waitFor(() => selector.length > 0)` resolves on the WRONG page.

### The ysbang case
- Home page: 200 `.all-goods-wrapper` cards (recommendations, NO `.goods-name span`)
- Search results: 65 `.all-goods-wrapper` cards (WITH `.goods-name span`)
- `waitFor` resolved on home page cards → adapter extracted 0 products

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
1. **Never trust `selector.length > 0` alone** — verify content quality (child elements)
2. **Never trust manual `browser_eval` for timing** — `site_run` has different page state
3. **Monitor the transition** — write a 5-second logging loop to capture the full DOM timeline
4. **Document in CLAUDE.md** — record timing patterns in the site's CLAUDE.md for future agents

## Workflow gates

You must stop at these points and explicitly ask the human to act:

1. **Login required.** Do not auto-create cookies. The human will log in via the browser.
2. **No domain contract exists.** Ask whether to draft one before writing the adapter.
3. **Network capture shows multi-step auth (CSRF token issued by an HTML page, then sent in JSON body).** Confirm with human whether to invest in tier-3 implementation.
4. **The requested adapter would mutate state without an obvious undo (order-create, payment).** Ask explicitly.

## Reading order before authoring

1. This file (you're here)
2. `~/.openclaw/workspace/bb-adapter-evolver/docs/claude/contracts/<domain>/v1.md` for your domain (ecommerce, pharma-data, or social-media)
3. `~/.openclaw/workspace/bb-adapter-evolver/docs/claude/methodology/reverse-engineering/playbook.md` — and for social-media, also `social-media-playbook.md` (per-note tokens, request signing, captcha cooldown)
4. The existing reference adapter for the same use case in another site (e.g. before writing `jd/search`, read `~/.bb-browser/sites/ysbang/adapters/search.js` for the constraint-tracking pattern)
5. `~/.bb-browser/docs/solutions/documentation-gaps/` for any prior lessons on the site or pattern you're touching
