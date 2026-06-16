---
name: Why db.yaozh.com needs a new pharma-data contract (not an extension of ecommerce v1)
type: decision
date: 2026-06-16
status: accepted
---

# Decision: New `pharma-data` contract domain (not extension of `ecommerce` v1)

## Context

User asked for adapters for `https://db.yaozh.com/` (药智数据, a pharmaceutical data intelligence platform). Initial assumption: reuse `ecommerce` v1 contract since yaoex / ysbang both validated there.

Recon (2026-06-16) showed the assumption was wrong:

- `db.yaozh.com` is a **structured query station**, not a transactional commerce site.
- Primary user intent is "look up regulatory / market / quality data about a drug or company", not "buy a drug".
- No cart. No orders. No checkout. No tier-2/3 AES price decryption (prices are public).
- Two of six databases need authentication gating (soft_vip on ypxs sales values, hard_wall on yaopinzhongbiao).

## What was rejected and why

**Option rejected: extend `ecommerce` v1 with new fields.**

Three concrete reasons it would fail:

1. **No cart/order primitives means half the existing ecommerce checks are N/A.** Forcing `cart-list`, `cart-add`, `cart-remove`, `checkout-preview`, `order-list`, `order-detail` into `bb-eval` for a non-commerce site makes them either always-FAIL or always-WARN — losing signal.

2. **Filter-passing would explode the forbidden-patterns list.** ecommerce v1 forbids `search-by-*` because B2B buyers are sensitive to filter-bait. pharma-data has no buyer; its databases naturally cluster by category. Adapters like `yaopinjiage-list` / `policies-list` would be tempting but represent the wrong granularity — one database, one adapter, with filters as arguments.

3. **Different auth tiers.** ecommerce has public + tier-2 cookie + tier-3 signature. pharma-data has public + soft_vip (cell redaction) + hard_wall (page never renders). Modelling soft_vip as "tier-3 but partial" loses fidelity.

## What was accepted

| Decision | Rationale |
|---|---|
| New contract `docs/claude/contracts/pharma-data/v1.md` | ecommerce stays untouched; future non-commerce sites (news, financials) can each have their own domain |
| Canonical adapter set: `auth`, `list`, `item`, `search`, `export`, `related` | Aligns with pharma-data's actual user intent (query vs browse) |
| One adapter per dbKey, exporting `list` + `item` together | Filter dimensions become `list()` arguments, not separate adapters — matches the user's primary use case, not the site's UI controls |
| `authStatus` field with enum `public` / `soft_vip` / `hard_wall` | Captures the three tiers cleanly without forcing every adapter to fake tier-2/3 |
| 6 standard error codes (LOGIN_REQUIRED, HARD_LOGIN_WALL, ENCRYPTED_ID_DECODE_FAILED, RATE_LIMITED, SCHEMA_DRIFT, DBKEY_UNKNOWN) | Replaces ecommerce's tier-3-specific codes |
| Auth helper `yaozh-auth` with `kind: "helper"` | Reads cookie from caller input, never auto-logs in (AGENTS.md #5 compliant). Helper skips the per-database checks. |
| `id` is a string with no type discriminator | Detail-page ID encoding is per-database (numeric vs base64) — checked at runtime, not statically asserted |
| Top-level envelope identical to ecommerce v1 | Cross-domain agent portability |

## Concrete deliverables shipped

- `docs/claude/contracts/pharma-data/v1.md` (251 lines)
- `docs/superpowers/specs/2026-06-16-pharma-data-design.md` (narrative spec, 308 lines)
- `templates/pharma-data/TEMPLATE.js` (220 lines, 22/22 PHR pass)
- `tools/bb-eval` extended: domain detection + 10 PHR-* checks + 2 helper-related skips
- `docs/claude/skills/bb-adapter-author/SKILL.md` rule #2 updated to cover both domains
- `docs/claude/methodology/evaluation/bb-eval-usage.md` PHR section added
- 7 adapter files in `~/.bb-browser/sites/yaozh/adapters/`: 6 per-database + 1 helper, all 0 FAIL on bb-eval (152/152 aggregate pass)

## Lessons written to `memory/soul.md` (2026-06-16 entry)

- Recon before assuming — `db.yaozh.com` looked ecommerce-ish but was structurally different.
- Each database uses a different keyword URL parameter. `scrme_name` was wrong for all six; correct params vary by `dbKey`. Reading the page's filter `<form>` is mandatory.
- Menu item counts (53 / 4 / 7370) are wildly out of date. Live page always wins.
- `is_search=1` is a hidden flag on every filter form; GET filters are silently ignored without it.
- Hard_wall databases (yaopinzhongbiao) require `HARD_LOGIN_WALL` + `authStatus` propagation, not silent fail.

## What this decision does NOT commit us to

- Phase 4 (darwinian_evolver) — still conditional. Single-shot SKILL-driven success was ≥70% on every public adapter, so the evolver cost is not yet justified.
- Other db.yaozh.com sub-domains (drug registration `/zhuce`, clinical trials `/linchuangshiyan`, company info `/company_info`, etc.) — out of scope for this round; recon data is in the soul.md entry if a future round picks them up.
- `data.yaozh.com` English version — same backend, deferred to v2.