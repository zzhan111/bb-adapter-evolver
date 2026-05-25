---
name: Why we are not jumping straight to darwinian_evolver
type: decision
date: 2026-04-22
status: accepted
---

# Decision: Stage evolver behind contract + bb-eval + skill (4 phases)

## Context

The original ask was: "use `imbue-ai/darwinian_evolver` to make a coding agent self-evolve toward writing the best bb-browser adapters". The temptation is to wire it up immediately and let evolution do the rest.

I argued against this. The user accepted the staged approach.

## What was rejected and why

**Option rejected: hook `darwinian_evolver` to a sample adapter as Phase 1.**

Three concrete reasons it would not work today:

1. **No fitness function exists.** `darwinian_evolver` requires `EvaluationResult.score: float`. "Is this adapter good?" is not currently quantifiable. Without `bb-eval` (or equivalent), every mutation gets a meaningless 0/1, and the evolver collapses to random search.

2. **Side-effectful evaluations.** `darwinian_evolver/evolver.py` defaults to `evaluator_concurrency=10`. The parrot example evaluates against an LLM call (no side effects). An adapter evaluator must hit the real site — 10 concurrent `cart-add` calls will land 10 items in the user's real cart, trip rate limits, or land the account in anti-bot review. Even sequential evaluations on a write adapter mutate user state.

3. **No "best adapter" target.** The user's actual complaint is that ysbang has 38 adapters where 9 would suffice. Evolution optimizes the score; if the score rewards "passes my test", a coding-agent mutator will gladly create a 39th adapter to pass the new test. **The fix is a contract that caps the surface area, not a search procedure that explores it.**

## What was accepted

Four phases, evolver gated behind real infrastructure:

| Phase | Deliverable | Why this order |
|---|---|---|
| 1 | `docs/claude/contracts/ecommerce/v1.md` + `tools/bb-eval` + `SKILL.md` | Defines "good adapter". Without this, every later phase is rudderless. |
| 2 | Iterate SKILL.md against real authoring runs; refine bb-eval rules from observed failures | Proves the contract is teachable to a coding agent (the simplest "evolution": single agent + checker, no population). |
| 3 | Use SKILL only — no evolver — to author adapters for jd / pdd / 1yaocheng. Refine contract from real friction. | Proves contract generalizes across sites. If it does not, evolver cannot save it. |
| 4 | (Conditional) Hook `darwinian_evolver` ONLY for tier-3 adapters where a single SKILL-driven attempt succeeds <30% of the time. Population = adapter source variants. Evaluator = `bb-eval` + sandboxed example run. Mutator = coding agent prompted with SKILL + failure case. | At this point the fitness signal is real, the side-effect surface is bounded to a known-hard adapter, and the cost is justified. |

## Concrete commitment

We do NOT touch `darwinian-evolver-main/` for the rest of Phase 1. Phase 4 may re-evaluate the decision in light of phase 1–3 evidence. If it turns out a SKILL-driven coding agent already gets ≥80% of adapters right on the first try after phase 2, we may **never** wire up the evolver, and that is success, not failure.

## How to revisit this

This decision is reversible. Triggers to revisit:

- Phase 2 reveals that SKILL.md cannot be made specific enough — agents keep producing adapters that fail `bb-eval` in unpredictable ways. Then we may need an evolver to amortize the search.
- Phase 3 reveals that contract v1 is wrong in a way that's hard to specify by hand. Then evolver-on-prompt-evolution (evolve SKILL.md itself) becomes attractive.
- A specific tier-3 adapter is genuinely hard and worth the cost of running evolver on it (e.g. ysbang Pinia store injection).

Until one of those triggers, we hold this position.
