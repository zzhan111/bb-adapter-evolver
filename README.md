# bb-adapter-evolver

English | [简体中文](README.zh-CN.md)

> Infrastructure for evolving high-quality [bb-browser](https://github.com/epiral/bb-browser) adapters that are good enough for AI agents to use as primary consumers.

## What this is (and isn't)

**This is:** the contract, skill, methodology, and tooling layer that surrounds adapter authoring. Read once, apply forever.

**This is NOT:** a place where adapters live. Adapters live in `~/.bb-browser/sites/<site>/adapters/`. This repo never ships adapters; it ships the **definition of "good adapter"** and the **tools to verify** any adapter against that definition.

## Why this exists

The user observed that `~/.bb-browser/sites/ysbang/adapters/` contains 38 files — `search`, `search-by-price`, `search-by-factory`, `search-by-provider`, `search-by-expriation_date`, `search-by-free-shipping`, `search-with-filters`, `search-filters`, `search-plan`, ... — most of which collapse into a handful of canonical use cases (search, add-to-cart, checkout, order-list, switch-store).

The root cause is **not** that the coding agent is bad at writing adapters. It is that **"good adapter" was never defined**. Without a contract, every new request becomes a new adapter, and the surface area grows monotonically.

This repo defines the contract first, builds tooling that enforces it second, and only then considers automated evolution.

## Domains

A domain is a category of site with its own contract, check family, and template. `tools/bb-eval` resolves the domain from `--domain`, `@meta.domain` (contract name or hostname), or `@meta.name` heuristics.

| Domain | Contract | bb-eval checks | Template | Proven on |
|---|---|---|---|---|
| ecommerce | `docs/claude/contracts/ecommerce/v1.md` | 13 generic checks | `templates/ecommerce/` | ysbang (1药城天津), yaoex (1药城全国) 9/9 P0 |
| pharma-data | `docs/claude/contracts/pharma-data/v1.md` | PHR-1..10 | `templates/pharma-data/` | yaozh (db.yaozh.com) |
| social-media | `docs/claude/contracts/social-media/v1.md` | SOC-1..13 | `templates/social-media/` | xiaohongshu — 15 adapters (SM-2); twitter/bilibili cross-site pending (SM-3) |

The granularity rule shared by all domains: **one adapter per intent; fold filter-variants into arguments.** `search-by-X` adapters are the anti-pattern this repo exists to prevent.

## The four phases

| Phase | What | Why later phases depend on this |
|---|---|---|
| 1. Contract + bb-eval (✅ complete) | Write `docs/claude/contracts/ecommerce/v1.md`. Build `tools/bb-eval` static checker. Validate against ysbang adapters. | Without a contract, evolution has no fitness signal. |
| 2. Skill loop (✅ complete) | Coding agents read `SKILL.md`, write adapter, `bb-eval` scores it, agent iterates. Refine `SKILL.md` from observed failures. | Proves the contract is teachable before adding more domains. |
| 3. Cross-site validation (✅ complete) | Author adapters for jd / pdd / 1yaocheng using only the SKILL. Refine contract from real friction. | Proves the contract is general before automating it. |
| 4. (Conditional) Evolver (not started) | For tier-3 adapters where single-shot success rate is below 30%, hook `darwinian_evolver`. Organism = adapter source. Evaluator = `bb-eval` + example run. Mutator = coding agent with SKILL. | Only meaningful once 1-3 are real. |

The user agreed to this staging after I argued against jumping straight to evolver — see `docs/claude/decisions/2026-04-22-why-not-evolver-first.md`.

Phases 1-3 ran on the ecommerce track. The pharma-data and social-media domains then repeated the same contract → checks → template → real-adapter loop on their own tracks (SM-*, PHR-*); see `memory/soul.md`.

## Repo layout

```
bb-adapter-evolver/
├── AGENTS.md              # Conventions for any agent (human or AI) working here
├── README.md              # This file
├── README.zh-CN.md        # Chinese translation of this file
├── docs/claude/
│   ├── contracts/         # One v1.md per domain: ecommerce, pharma-data, social-media
│   ├── skills/
│   │   └── bb-adapter-author/
│   │       └── SKILL.md   # System prompt for adapter-authoring agents
│   ├── methodology/
│   │   ├── reverse-engineering/
│   │   │   ├── playbook.md               # Generic capture-before-code playbook
│   │   │   └── social-media-playbook.md  # XHS-specific: per-note tokens, signing, captcha cooldown
│   │   ├── evaluation/
│   │   │   └── bb-eval-usage.md
│   │   └── setup/
│   │       └── wsl2-windows-chrome-cdp.md
│   ├── decisions/         # Dated decision records (why-not-evolver-first, why-social-media-contract, ...)
│   └── wiki/              # Navigable wiki over all of the above (start at wiki/README.md)
├── templates/             # Reference adapter skeletons per domain
│   ├── ecommerce/
│   ├── pharma-data/
│   └── social-media/
├── tools/
│   ├── bb-eval                          # Static contract checker (bash + jq, <1s per adapter)
│   ├── verify-adapter-runtime-shape.js  # Sandboxed runtime verifier (mocked bb.*/page.* APIs)
│   ├── wiki-cli                         # CRUD CLI for docs/claude/wiki/
│   └── cdp-windows                      # Launch a 2nd daemon that drives Windows Chrome via portproxy
├── fixtures/              # Snapshotted example outputs for regression
├── tests/
│   └── wiki/              # test-curd.sh — wiki-cli regression suite
└── memory/
    └── soul.md            # Long-running notes (human + agent), openclaw-style
```

## Quick start

For a coding agent asked to "write a bb-browser adapter":

```bash
# 1. Read the skill
cat docs/claude/skills/bb-adapter-author/SKILL.md

# 2. Identify the domain and read its contract (ecommerce | pharma-data | social-media)
cat docs/claude/contracts/<domain>/v1.md

# 3. Author the adapter (file lives outside this repo, in ~/.bb-browser/sites/...)

# 4. Score it statically
./tools/bb-eval ~/.bb-browser/sites/<site>/adapters/<name>.js

# 5. Verify envelope shape without a browser
node tools/verify-adapter-runtime-shape.js --only <site>/<adapter>

# 6. If it requires login, stop and ask the human before running the example.
```

## Status

- 2026-04-22: Phase 1 started. ecommerce contract v1, bb-eval, SKILL initial draft committed.
- 2026-06-16: Phases 1-3 complete (ecommerce proven on ysbang + yaoex). pharma-data domain added and proven on yaozh.
- 2026-06-18: social-media contract v1 delivered (SM-1): contract, decision record, playbook, template, SOC-1..13 checks.
- 2026-06-19: SM-2 complete — 15 xiaohongshu adapters (13 P0 + 2 P1), 378 SOC checks / 0 fail and 16/16 runtime-shape verified. SM-3 (twitter/bilibili cross-site) not started.

See `memory/soul.md` for the rolling state that humans and agents both append to.
