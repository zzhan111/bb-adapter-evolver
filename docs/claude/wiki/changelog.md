---
title: Wiki changelog
type: wiki-changelog
last_updated: 2026-06-28
---

# Wiki changelog

Material changes to wiki pages. Add entries (don't rewrite history). The wiki is the **map**; this changelog is **when the map was redrawn**.

## Format

```markdown
## YYYY-MM-DD — <one-line summary>

- **Added:** `<path>` — <one-line description>
- **Updated:** `<path>` — <one-line description>
- **Removed:** `<path>` — <one-line description>

> Reasoning: <one-line why>
```

## Entries

### 2026-06-28 — Initial wiki + CRUD skill

- **Added:** `docs/claude/wiki/README.md` — landing page with sections index.
- **Added:** `docs/claude/wiki/getting-started.md` — onboarding path with hard-rules table.
- **Added:** `docs/claude/wiki/concepts/adapter.md` — what an adapter is and isn't.
- **Added:** `docs/claude/wiki/concepts/contract.md` — what a contract is and how it becomes enforceable.
- **Added:** `docs/claude/wiki/concepts/intent-granularity.md` — one adapter per intent, the ysbang 38-adapter lesson.
- **Added:** `docs/claude/wiki/concepts/auth-tiers.md` — tier-1/2/3 (ecommerce), public/soft_vip/hard_wall (pharma-data), anonymous/auth_read/auth_write (social-media).
- **Added:** `docs/claude/wiki/concepts/envelope.md` — the standard return shape + fixed error code enum.
- **Added:** `docs/claude/wiki/concepts/constraints-and-pagination.md` — the constraint trio and pagination.
- **Added:** `docs/claude/wiki/domains/ecommerce.md` — 9 P0 + 6 P1 + forbidden table.
- **Added:** `docs/claude/wiki/domains/pharma-data.md` — 3 P0 + 3 P1 + helper + 6 real dbKey coverage.
- **Added:** `docs/claude/wiki/domains/social-media.md` — 13 P0 + 6 P1 + XHS quirks + 16 real xhs adapter coverage.
- **Added:** `docs/claude/wiki/domains/choosing-a-domain.md` — three-question test + decision matrix.
- **Added:** `docs/claude/wiki/workflow/author-loop.md` — the 7-step loop summary.
- **Added:** `docs/claude/wiki/workflow/reverse-engineering.md` — capture-first 5-step playbook + SPA timing + XHS quirks.
- **Added:** `docs/claude/wiki/workflow/bb-eval.md` — universal + PHR-* + SOC-* checks with history.
- **Added:** `docs/claude/wiki/workflow/runtime-verification.md` — sandbox verifier + the 14-bug cross-domain discovery.
- **Added:** `docs/claude/wiki/workflow/browser-setup.md` — WSL2 ↔ Windows Chrome, single + dual daemon.
- **Added:** `docs/claude/wiki/workflow/when-to-stop-and-ask-the-human.md` — the four stop-and-ask gates.
- **Added:** `docs/claude/wiki/reference/ecommerce-adapters.md` — P0/P1/forbidden + worked `@meta`.
- **Added:** `docs/claude/wiki/reference/ecommerce-product.md` — Product object schema + worked examples.
- **Added:** `docs/claude/wiki/reference/ecommerce-order.md` — Order object schema + status enum.
- **Added:** `docs/claude/wiki/reference/ecommerce-cart.md` — Cart object schema + yaoex data-path caveat.
- **Added:** `docs/claude/wiki/reference/pharma-data-adapters.md` — dbKey naming rule + 6 real dbKey coverage.
- **Added:** `docs/claude/wiki/reference/pharma-data-record.md` — Record schema + soft_vip / hard_wall examples.
- **Added:** `docs/claude/wiki/reference/social-media-adapters.md` — P0/P1/forbidden + worked `@meta`.
- **Added:** `docs/claude/wiki/reference/social-media-note.md` — Note / Author / User / Comment / WriteReceipt schemas.
- **Added:** `docs/claude/wiki/reference/error-codes.md` — fixed enum per domain + action binding.
- **Added:** `docs/claude/wiki/reference/anti-patterns.md` — ysbang 38-adapter, stubbed sessions, lying-about-constraints, SPA selector races, anonymous-function export.
- **Added:** `docs/claude/wiki/decisions/index.md` — index of all ADRs + decision-record template.
- **Added:** `docs/claude/wiki/glossary.md` — term dictionary.
- **Added:** `docs/claude/wiki/changelog.md` — this file.
- **Added:** `docs/claude/skills/wiki-curator/SKILL.md` — CRUD skill for the wiki.
- **Added:** `tools/wiki-cli` — bash CRUD tool with `list`/`get`/`add`/`edit`/`delete`/`move`/`validate`/`regenerate-index`/`frontmatter`.
- **Added:** `tests/wiki/test-curd.sh` — end-to-end CRUD + consistency tests.

> Reasoning: User asked for a comprehensive wiki plus a CRUD skill. Wiki is the map (cross-referenced summary of contracts/methodology/decisions/memory); CRUD skill is the maintenance tool.

## See also

- [Wiki index](README.md)
- [Decisions index](decisions/index.md)
- [Memory changelog](../../../memory/soul.md)
