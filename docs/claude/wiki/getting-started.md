---
title: Getting Started
type: wiki-page
audience: new agents or humans
last_updated: 2026-06-28
---

# Getting started

This page is the **onboarding path**. If you arrived here because someone asked you to "write an adapter for site X", you are in the right place.

## 30-second summary

`bb-adapter-evolver` defines what makes a bb-browser adapter good enough for an AI agent to use as its primary consumer. It does this through three things:

1. **Contracts** — normative specs per domain (ecommerce, pharma-data, social-media) that say exactly which adapter names exist, what they return, and what is forbidden.
2. **`bb-eval`** — a static checker that scores any adapter against the contract for its domain in <1s. Every FAIL must be fixed before merge.
3. **`verify-adapter-runtime-shape.js`** — a sandboxed runtime verifier that catches bugs `bb-eval` cannot (undefined variables at call time, envelope-shape mistakes).

The repo also ships **methodology** (`reverse-engineering`, `evaluation`, `setup`), **decisions** (why we made the choices we made), and **skills** (the system prompts coding agents read).

## Pick your entry point

| You are… | Read first |
|---|---|
| A coding agent asked to write a new adapter for a known site | [Workflow: Author loop](workflow/author-loop.md) → [Skills: bb-adapter-author](../skills/bb-adapter-author/SKILL.md) |
| A coding agent asked to author an adapter for an unfamiliar site | [Domains: choosing a domain](domains/choosing-a-domain.md) → matching domain page → workflow |
| A reviewer who needs to know if an adapter is acceptable | [bb-eval](workflow/bb-eval.md) → [Reference: Anti-patterns](reference/anti-patterns.md) |
| A new human trying to understand what this repo is | This page → [Concepts: what is an adapter?](concepts/adapter.md) |
| A maintainer adding a new domain contract | [Decisions index](decisions/index.md) → read prior decisions for the format |

## The 7-step author loop (TL;DR)

The full version is at [workflow/author-loop.md](workflow/author-loop.md). The compressed version:

1. **Read the contract** for the domain. If none exists, draft one first.
2. **Identify the adapter name.** Match against the domain's P0/P1 set.
3. **Capture the real API** in the browser. Never guess endpoints.
4. **Author the adapter** following the contract's schema and `@meta` rules.
5. **Score with `bb-eval`.** Fix every FAIL.
6. **Run the example** via bb-browser MCP. Stop and ask the human if login is needed.
7. **Snapshot a fixture** under `fixtures/<domain>/` for regression.

## Hard rules (do not violate)

These come from `AGENTS.md` and are enforced by tooling. Violating any of them means your adapter will not be merged.

| # | Rule | Enforced by |
|---|---|---|
| 1 | Destination URL declared in the first 50 lines. | `bb-eval` (cross-domain URL check) |
| 2 | Adapter granularity = user's primary use case, not every UI control. | Domain contract's forbidden-name list |
| 3 | Assume tier-2 or tier-3 auth; tier-1 only when proven via capture. | `bb-eval` (no direct check; reviewers enforce) |
| 4 | Primary user is an AI agent. Schema favors the agent. | Domain contract schema |
| 5 | When login is required, **stop and ask the human**. No stubbed sessions. | Reviewer-only (no automated check) |
| 6 | All work in English. Reply to the user in Chinese. | Style convention |
| 7 | All documentation under `docs/claude/<category>/<sub>/`. No top-level sprawl. | Repo structure convention |
| 8 | Honesty over politeness. State when something is wrong. | Soul.md history |

## Where things live

| Path | What |
|---|---|
| `docs/claude/contracts/<domain>/v1.md` | The normative contract. |
| `docs/claude/skills/bb-adapter-author/SKILL.md` | System prompt for adapter-authoring agents. |
| `docs/claude/methodology/` | Distilled lessons (reverse-engineering, evaluation, setup). |
| `docs/claude/decisions/` | ADR-style decision records. |
| `docs/superpowers/specs/` | Long-form design specs (brainstorming output). |
| `docs/claude/wiki/` | This wiki. |
| `templates/<domain>/` | Reference adapter skeletons. |
| `tools/bb-eval` | Static contract checker. |
| `tools/verify-adapter-runtime-shape.js` | Sandbox runtime verifier. |
| `tools/wiki-cli` | CRUD tool for this wiki. |
| `memory/soul.md` | Rolling long-running notes. |
| `fixtures/<domain>/` | Captured adapter outputs for regression. |
