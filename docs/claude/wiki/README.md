---
title: bb-adapter-evolver Wiki
type: wiki-index
last_updated: 2026-06-28
audience: any agent or human joining the project
---

# bb-adapter-evolver Wiki

This is the **landing page** for the bb-adapter-evolver wiki. It is a curated, cross-referenced summary of every concept, contract, workflow, and decision that lives in this repo. The full canonical texts still live in their original locations (`docs/claude/contracts/`, `docs/claude/methodology/`, `docs/claude/decisions/`, `memory/`); this wiki is the **map**, not the **territory**.

If you are new, read in this order:

1. **[Getting started](getting-started.md)** — what to read first.
2. **[Concepts](concepts/adapter.md)** — what an adapter, contract, intent, and envelope are.
3. **[Domains](domains/ecommerce.md)** — pick the contract that fits your site.
4. **[Workflow](workflow/author-loop.md)** — the seven steps to author a good adapter.
5. **[Reference](reference/ecommerce-adapters.md)** — adapter tables and object schemas.
6. **[Glossary](glossary.md)** — lookup any unfamiliar term.

The wiki is **editable through the `wiki-curator` skill**. See `docs/claude/skills/wiki-curator/SKILL.md` for the CRUD contract, or run `tools/wiki-cli` directly.

## Sections

| Section | What it covers |
|---|---|
| [Concepts](concepts/) | Adapter, contract, intent, granularity, auth tiers, envelope, constraints, pagination. |
| [Decisions](decisions/index.md) | Index of all ADR-style decision records in the repo. |
| [Domains](domains/) | One page per contract (`ecommerce`, `pharma-data`, `social-media`) plus how to pick one. |
| [Reference](reference/) | Adapter tables, object schemas, error code enum, anti-patterns. |
| [Workflow](workflow/) | Author loop, reverse-engineering, bb-eval, runtime verification, browser setup, gates. |

## What this wiki is NOT

- **Not a copy of contracts.** When the wiki and the contract disagree, **the contract wins**. The wiki links to the canonical source.
- **Not a tutorial.** The [author skill](../skills/bb-adapter-author/SKILL.md) is the system prompt an authoring agent reads; this wiki is for orientation.
- **Not the only source.** `memory/soul.md` records rolling state (phases, decisions, open items). Read it for "what's happening right now".
