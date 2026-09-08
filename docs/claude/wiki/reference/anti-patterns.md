---
title: Anti-patterns
type: wiki-reference
last_updated: 2026-06-28
---

# Anti-patterns

The catalog of mistakes observed in past adapter work. Each entry: what was done, why it was wrong, and how to avoid it. **Read this before authoring.**

## Filter explosion

**Done:** Created `search-by-price`, `search-by-factory`, `search-by-provider`, `search-by-expiration`, `search-by-free-shipping`, `search-with-filters`, `search-filters`, `search-plan`, ... as separate adapters.

**Why wrong:** Each duplicates ~200 lines of search-page navigation. Agents don't know which to call. Reviewers can't tell if `search-by-price` and `search-by-factory` use the same page.

**Avoid:** Filters are `search` arguments, not adapters. One `search` adapter with `keyword`, `page`, `pageSize`, `sort`, and any other filter args. `bb-eval` rejects `search-by-*` patterns.

## Stubbed sessions

**Done:** Hard-coded test cookies in the adapter with `// TODO: replace before commit` comments. Always shipped with the stub.

**Why wrong:** The adapter appears to work in CI but fails for every real user. The TODO comment becomes a permanent fixture.

**Avoid:** Per AGENTS.md #5, **stop and ask the human**. Don't paper over login. The human logs in via the browser; the adapter reads the cookie at call time.

## Lying about constraints

**Done:** Marked `factory` as `executedConstraints` when the code only put it in the `deferredConstraints` list. The agent downstream trusted the result and skipped a follow-up call.

**Why wrong:** The constraint trio is a lie-detector. Once the lie is in, every agent that consumes the adapter makes wrong assumptions about what was filtered.

**Avoid:** Before committing, ask: "if I gave this envelope to an agent that knew nothing about my site, would it correctly predict what was filtered?" If not, fix the trio. If `deferredConstraints` is non-empty, `recommendedNextActions` MUST contain a corresponding entry. `bb-eval constraint-tracking` checks this.

## Missing destination URL

**Done:** Adapter starts with `async function(args) { const token = ...` and never references the URL it's bound to.

**Why wrong:** Reader (human or agent) cannot tell what page this is for. Anti-debugging, anti-review.

**Avoid:** Declare `const HOME_URL = 'https://...'` in the **first 50 lines**. `bb-eval url-declared` enforces this.

## Adapter that submits orders

**Done:** `order-create.js`, `auto-purchase.js`, `submit-order.js` ship in production.

**Why wrong:** Order submission is too large a side effect for autonomous agent. The user might come back to a charged credit card and a cancelled inventory.

**Avoid:** Use `checkout-preview` (read-only, returns the order summary for human review) and require the human to click submit in the UI. The contract explicitly bans `order-create` / `submit-order` / `auto-purchase`.

## Endpoint guessing

**Done:** Wrote adapter against guessed `*/list` / `*/feed` / `*/search` paths because "that's how these things are usually named."

**Why wrong:** The jike adapter shipped broken for exactly this reason. The actual endpoint was something else entirely; the guessed path returned 404.

**Avoid:** Capture before you code. Use `bb-browser network --with-body` to record the user flow. Identify the endpoint by capture, not by convention. See [workflow/reverse-engineering.md](../workflow/reverse-engineering.md).

## `jq // empty` for boolean fields

**Done:** Used `jq -r '.readOnly // empty'` to check field existence.

**Why wrong:** `//` is jq's "alternative" operator — `false // empty` returns empty (falsy), so a `false` value is silently treated as missing.

**Avoid:** Use `has($k) and (.[$k] != null)` instead. `bb-eval` was patched in 2026-04-22 to use this pattern.

## Anonymous-function export

**Done:** Wrote `async function(args) { ... }` and exported it as default. Adapter was 0 FAIL on `bb-eval` but never ran.

**Why wrong:** Anonymous function expression is valid syntax for a default export, but when imported as a named export (`require('adapter.js')` returning the function) the agent gets an object, not a callable. Also: `async function(args)` shadows the `args` parameter name in many JS engines.

**Avoid:** Use a named function or `const fn = async function(args) { ... }; module.exports = fn;` pattern. Run `node --check` on the adapter before committing. The runtime-shape verifier catches this; future `bb-eval` extension will too.

## SPA selector races

**Done:** `await waitFor(() => document.querySelectorAll(SELECTOR).length > 0)` after navigation.

**Why wrong:** Vue/React SPAs have the same selector on the source page and the target page. The wait resolves on the source page; the adapter extracts 0 items.

**Avoid:** Three-phase wait strategy (see [workflow/reverse-engineering.md](../workflow/reverse-engineering.md#spa-timing-patterns-vue--react)):

1. Wait old content gone.
2. Wait new content WITH expected child.
3. Wait count stable for 1.5s.

## Anti-patterns that aren't enforced by tooling yet

| Anti-pattern | Why not enforced | Mitigation |
|---|---|---|
| Misnamed P1 (e.g. `coupon-claim` called `coupon-redeem`) | `bb-eval` only matches P0/P1 list as a set | Reviewers catch this |
| Inflating stats (returning `likesLabel: "1.2万"` as `likes: 12000` AND `likesLabel: "1.2万"`, but then computing `interaction: 12000 + 56 = 12056` instead of the site's reported `45000`) | Domain-specific; not generic | Reviewers; runtime-shape verifier may catch obvious cases |
| Adapters that don't honor `args.confirm` for writes | `bb-eval` only checks `readOnly` flag | Reviewers; the `like` contract was demonstrated to need this in SM-2.5 |
| Treating `authStatus` as binary (logged in / not) | Ecommerce doesn't model tiers | Reviewers; the social-media contract uses 3 tiers explicitly |

## Honesty caveat

> The catalog above comes from auditing `~/.bb-browser/sites/ysbang/adapters/` and from incidents during Phase 1–3 (2026-04 to 2026-06). It is not exhaustive. When you find a new anti-pattern, **add it here** and link to the commit or memory entry that recorded it.

## See also

- [Author loop](../workflow/author-loop.md)
- [Reverse-engineering](../workflow/reverse-engineering.md)
- [bb-eval](../workflow/bb-eval.md)
- [Runtime verification](../workflow/runtime-verification.md)
- [When to stop and ask the human](../workflow/when-to-stop-and-ask-the-human.md)
