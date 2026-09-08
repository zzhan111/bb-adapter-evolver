---
title: Glossary
type: wiki-glossary
last_updated: 2026-06-28
---

# Glossary

Terms used across the wiki and the contracts. Definitions are intentionally short — follow the cross-references for depth.

## `@meta`

The `/* @meta { ... } */` JSON block at the top of every adapter file. Declares name, description, domain, args, capabilities, readOnly, example, and any domain-specific fields. `bb-eval` parses this first.

## access tier

For social-media: `anonymous` / `auth_read` / `auth_write`. Declared in `@meta.accessTier`; reflects the **minimum** tier needed. The returned `authStatus` is the tier **in effect**. See [concepts/auth-tiers.md](concepts/auth-tiers.md).

## adapter

A JavaScript file under `~/.bb-browser/sites/<site>/adapters/<name>.js` that turns structured args into a structured envelope. One adapter per intent. See [concepts/adapter.md](concepts/adapter.md).

## ADR

Architecture Decision Record. A short document at `docs/claude/decisions/YYYY-MM-DD-<slug>.md` capturing why a decision was made. See [decisions/index.md](decisions/index.md).

## anti-pattern

A repeated mistake from past adapter work. Catalog at [reference/anti-patterns.md](reference/anti-patterns.md).

## auth-required gate

The point in the workflow where the agent must stop and ask the human to log in. Per AGENTS.md #5. See [workflow/when-to-stop-and-ask-the-human.md](workflow/when-to-stop-and-ask-the-human.md).

## bb-browser

The browser-automation framework this repo supports. Adapter files are consumed by `~/.bb-browser/`.

## bb-eval

`tools/bb-eval` — the static contract checker. Fast (<1s), no execution. Run on every adapter before declaring done. See [workflow/bb-eval.md](workflow/bb-eval.md).

## canonical name

An adapter name in the domain contract's P0 or P1 set. Examples: `search`, `cart-list`, `auth`. Anything else is either forbidden or unknown.

## CDP

Chrome DevTools Protocol. How `bb-browser` drives Chrome. See [workflow/browser-setup.md](workflow/browser-setup.md).

## contract

A normative document at `docs/claude/contracts/<domain>/v1.md` defining the canonical adapter set, schemas, and forbidden names for a domain. See [concepts/contract.md](concepts/contract.md).

## constraint trio

The `requestedConstraints` / `executedConstraints` / `deferredConstraints` triple on list adapters. Honesty detector. See [concepts/constraints-and-pagination.md](concepts/constraints-and-pagination.md).

## darwinian_evolver

The Phase 4 conditional system: organism = adapter source, evaluator = `bb-eval` + example run, mutator = coding agent with SKILL. Hook only when single-shot success rate < 30%. Not yet started.

## dbKey

For pharma-data: the database identifier (e.g. `yaopinjiage`, `policies`). Used as the adapter file name and in the URL slug.

## domain

A category of website that shares an adapter contract. Current domains: `ecommerce`, `pharma-data`, `social-media`. See [domains/](domains/).

## envelope

The standard return shape every adapter produces. `ok`, `data`, `authStatus`, `constraints`, `pagination`, `recommendedNextActions`, plus `error/hint/action` on failure. See [concepts/envelope.md](concepts/envelope.md).

## fixture

A captured successful adapter output, stored under `fixtures/<domain>/<site>-<adapter>.json`. Used for regression.

## forbidden name

An adapter name on the contract's forbidden list. `bb-eval` FAILs these. Examples: `search-by-price`, `order-create`, `feed-hot`.

## granularity

How finely adapter names are split. The rule is **one adapter per intent; fold filter-variants into args**. See [concepts/intent-granularity.md](concepts/intent-granularity.md).

## Hermes

`/skill` shortcut mechanism for cross-session skill references (e.g. `wsl-bb-browser-windows`). Not part of this repo's tooling, but referenced from `memory/soul.md`.

## intent

The user verb the adapter serves. Five values: `discover`, `consume`, `engage`, `create`, `manage`. See [concepts/intent-granularity.md](concepts/intent-granularity.md).

## MCP

Model Context Protocol. The runtime used by agents to call tools. bb-browser MCP tools include `browser_open`, `browser_eval`, `browser_snapshot`, `browser_network`, etc.

## methodology

Distilled lessons at `docs/claude/methodology/<category>/`. Categories: `reverse-engineering`, `evaluation`, `setup`.

## nextActions

`recommendedNextActions` field in the envelope. Chain of adapters the agent can call next. See [concepts/envelope.md](concepts/envelope.md).

## P0

The required adapter set for a domain. `bb-eval` knows these names; unknown names are warned.

## P1

The optional adapter set for a domain. Implement only when the site has the concept.

## pharma-data

Domain for sites whose primary intent is record lookup. See [domains/pharma-data.md](domains/pharma-data.md).

## recommendedNextActions

See **nextActions**.

## social-media

Domain for UGC + social-graph sites. See [domains/social-media.md](domains/social-media.md).

## spec

Long-form design document at `docs/superpowers/specs/YYYY-MM-DD-<slug>.md`. Brainstorming output, not normative.

## SPA

Single-Page Application. Vue / React. Presents timing hazards. See [workflow/reverse-engineering.md](workflow/reverse-engineering.md).

## stage

A numbered phase of the repo's evolution (1–4). See [README.md](../../../README.md).

## tier-1 / tier-2 / tier-3

Ecommerce auth effort levels. Tier-1: cookie only (~1 min). Tier-2: bearer + CSRF (~3 min). Tier-3: webpack injection / runtime signing (~10–30 min). See [concepts/auth-tiers.md](concepts/auth-tiers.md).

## validate

Run `tools/bb-eval` (static) and `tools/verify-adapter-runtime-shape.js` (runtime) on an adapter. Both should be 0 FAIL.

## verify-adapter-runtime-shape.js

`tools/verify-adapter-runtime-shape.js` — sandboxed runtime verifier. Catches bugs `bb-eval` cannot. See [workflow/runtime-verification.md](workflow/runtime-verification.md).

## xsec_token

XHS-only per-note access token. Documented as a quirk in the social-media contract, NOT generalized to all social-media sites. See [domains/social-media.md](domains/social-media.md).

## See also

- [Wiki index](README.md)
- [Getting started](getting-started.md)
