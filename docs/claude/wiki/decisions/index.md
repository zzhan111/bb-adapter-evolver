---
title: Decisions index
type: wiki-decisions
last_updated: 2026-06-28
---

# Decisions index

All ADR-style decision records in this repo. Each record documents **why** a choice was made, what alternatives were considered, and what trade-offs were accepted.

## Format

Each decision lives at `docs/claude/decisions/YYYY-MM-DD-<slug>.md`. The body is the ADR. Long-form design specs (the "how") live at `docs/superpowers/specs/YYYY-MM-DD-<slug>.md`.

## Recorded decisions

| Date | Slug | What was decided | ADR |
|---|---|---|---|
| 2026-04-22 | why-not-evolver-first | Staging 4 phases; rejected "jump straight to evolver" | [`docs/claude/decisions/2026-04-22-why-not-evolver-first.md`](../../decisions/2026-04-22-why-not-evolver-first.md) |
| 2026-06-16 | why-pharma-data-contract | New domain `pharma-data`; rejected extending ecommerce | [`docs/claude/decisions/2026-06-16-why-pharma-data-contract.md`](../../decisions/2026-06-16-why-pharma-data-contract.md) |
| 2026-06-18 | why-social-media-contract | New domain `social-media`; rejected extending ecommerce or pharma-data | [`docs/claude/decisions/2026-06-18-why-social-media-contract.md`](../../decisions/2026-06-18-why-social-media-contract.md) |

## Decision record template

```markdown
---
title: <decision>
date: YYYY-MM-DD
status: accepted | superseded | deprecated
---

# <Decision title>

## Context

What is the issue? What forces are at play?

## Considered options

What alternatives were considered?

## Decision

What was decided? Why?

## Consequences

What becomes easier? What becomes harder?

## References

- Contract: <path>
- Spec: <path>
- Related: <path>
```

## Why decisions live in `docs/claude/decisions/`

- Contracts (`docs/claude/contracts/`) are **load-bearing walls**: stable, versioned, normative.
- Decisions (`docs/claude/decisions/`) are the **reasoning**: why each wall is where it is.
- Specs (`docs/superpowers/specs/`) are the **brainstorming output**: how each wall was designed.
- Methodology (`docs/claude/methodology/`) is the **distilled lesson**: what we learned.

Mixing these makes any one of them harder to maintain. Keep them separate.

## See also

- [Getting started](../getting-started.md)
- [Domain overview](../domains/choosing-a-domain.md)
- [Memory (rolling notes)](../../../../memory/soul.md)
