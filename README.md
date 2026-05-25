# bb-adapter-evolver

> Infrastructure for evolving high-quality [bb-browser](https://github.com/epiral/bb-browser) adapters that are good enough for AI agents to use as primary consumers.

## What this is (and isn't)

**This is:** the contract, skill, methodology, and tooling layer that surrounds adapter authoring. Read once, apply forever.

**This is NOT:** a place where adapters live. Adapters live in `~/.bb-browser/sites/<site>/adapters/`. This repo never ships adapters; it ships the **definition of "good adapter"** and the **tools to verify** any adapter against that definition.

## Why this exists

The user observed that `~/.bb-browser/sites/ysbang/adapters/` contains 38 files — `search`, `search-by-price`, `search-by-factory`, `search-by-provider`, `search-by-expriation_date`, `search-by-free-shipping`, `search-with-filters`, `search-filters`, `search-plan`, ... — most of which collapse into a handful of canonical use cases (search, add-to-cart, checkout, order-list, switch-store).

The root cause is **not** that the coding agent is bad at writing adapters. It is that **"good adapter" was never defined**. Without a contract, every new request becomes a new adapter, and the surface area grows monotonically.

This repo defines the contract first, builds tooling that enforces it second, and only then considers automated evolution.

## The four phases

| Phase | What | Why later phases depend on this |
|---|---|---|
| 1. Contract + bb-eval (here now) | Write `docs/claude/contracts/ecommerce/v1.md`. Build `tools/bb-eval` static checker. Validate against ysbang adapters. | Without a contract, evolution has no fitness signal. |
| 2. Skill loop | Coding agents read `SKILL.md`, write adapter, `bb-eval` scores it, agent iterates. Refine `SKILL.md` from observed failures. | Proves the contract is teachable before adding more domains. |
| 3. Cross-site validation | Author adapters for jd / pdd / 1yaocheng using only the SKILL. Refine contract from real friction. | Proves the contract is general before automating it. |
| 4. (Conditional) Evolver | For tier-3 adapters where single-shot success rate is below 30%, hook `darwinian_evolver`. Organism = adapter source. Evaluator = `bb-eval` + example run. Mutator = coding agent with SKILL. | Only meaningful once 1-3 are real. |

The user agreed to this staging after I argued against jumping straight to evolver — see `docs/claude/decisions/2026-04-22-why-not-evolver-first.md`.

## Repo layout

```
bb-adapter-evolver/
├── AGENTS.md              # Conventions for any agent (human or AI) working here
├── README.md              # This file
├── docs/claude/
│   ├── contracts/
│   │   └── ecommerce/
│   │       └── v1.md      # The ecommerce contract (Phase 1 deliverable)
│   ├── skills/
│   │   └── bb-adapter-author/
│   │       └── SKILL.md   # System prompt for adapter-authoring agents
│   ├── methodology/
│   │   ├── reverse-engineering/
│   │   │   └── playbook.md
│   │   ├── evaluation/
│   │   │   └── bb-eval-usage.md
│   │   └── setup/
│   │       └── wsl2-windows-chrome-cdp.md  # dual-daemon: drive Windows Chrome from WSL2
│   └── decisions/
│       └── 2026-04-22-why-not-evolver-first.md
├── tools/
│   ├── bb-eval            # Shell + jq adapter scorer
│   └── cdp-windows        # Launch a 2nd daemon that drives Windows Chrome via portproxy
├── fixtures/
│   └── ecommerce/         # Snapshotted example outputs for regression
└── memory/
    └── soul.md            # Long-running notes (human + agent), openclaw-style
```

## Quick start

For a coding agent asked to "write a bb-browser adapter":

```bash
# 1. Read the skill
cat docs/claude/skills/bb-adapter-author/SKILL.md

# 2. Read the contract for your domain
cat docs/claude/contracts/ecommerce/v1.md

# 3. Author the adapter (file lives outside this repo, in ~/.bb-browser/sites/...)

# 4. Score it
./tools/bb-eval ~/.bb-browser/sites/<site>/adapters/<name>.js

# 5. If it requires login, stop and ask the human before running the example.
```

## Status

- 2026-04-22: Phase 1 started. Contract v1, bb-eval, SKILL initial draft committed.

See `memory/soul.md` for the rolling state that humans and agents both append to.
