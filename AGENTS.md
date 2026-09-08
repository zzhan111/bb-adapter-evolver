# bb-adapter-evolver — Agent Conventions

This repo is the **infrastructure layer** for evolving high-quality bb-browser adapters. It does NOT contain adapters themselves (those live in `~/.bb-browser/sites/<site>/adapters/`). It contains:

1. **Contracts** — what makes an adapter in a given domain "good" (`docs/claude/contracts/`)
2. **Skill** — the system prompt a coding agent reads before authoring an adapter (`docs/claude/skills/bb-adapter-author/SKILL.md`)
3. **Methodology** — distilled lessons from past adapter work (`docs/claude/methodology/`)
4. **Tooling** — `bb-eval` static checker that scores any adapter against the contract (`tools/bb-eval`)
5. **Memory** — human + agent shared notes, mirroring openclaw's user/soul/memory pattern (`memory/`)

The repo is staged in 4 phases. We have completed **Phases 1-3**. Phase 4 is conditional.

## Phases

| Phase | Goal | Status |
|---|---|---|
| 1 | Ecommerce contract + bb-eval + SKILL.md, validate against ysbang reference | ✅ complete |
| 2 | Wire `bb-eval` into agent feedback loop, refine SKILL.md from real authoring runs | ✅ complete |
| 3 | Cross-site validation: yaoex (1药城) 9 adapters prove contract holds across B2B sites | ✅ complete |
| 4 | (Conditional) Hook `darwinian_evolver` for tier-3 adapters where single-shot success rate < 30% | not started |

## Phase 1-3 Summary

### Phase 1: Foundation
- Ecommerce contract v1 (`docs/claude/contracts/ecommerce/v1.md`)
- bb-eval static checker (`tools/bb-eval`) — 13 checks, FIXED boolean detection bug
- bb-adapter-author SKILL.md with 6-phase workflow
- Reverse-engineering playbook + ysbang reference fixtures

### Phase 2: Authoring Workflow
- bb-eval integrated into iterative dev loop (write → eval → fix → commit)
- Cart APIs added to contract v1 (cart-list, cart-add)
- AES price decryption pattern documented
- yaoex adapter suite authored using SKILL.md workflow

### Phase 3: Cross-Site Validation
- **ysbang (1药城天津)**: auth + search adapters (existing)
- **yaoex (1药城全国)**: Full 9/9 P0 adapter suite — auth (10/10), search (13/13), product (11/11), cart-list (13/13), cart-add (11/11), cart-remove (11/11), checkout-preview (11/11), order-list (13/13), order-detail (11/11)
- Contract v1 proven across two independent B2B pharmaceutical sites
- site_run workaround: Windows daemon → browser_eval inline

### Key Discoveries
1. **Font obfuscation DISPROVEN** — D-DIN-Bold.ttf is standard font
2. **SPA timing requires 3-phase wait** — old cards → new cards → stabilization
3. **AES-128-ECB price encryption** — key derived from userId, implemented in JS
4. **Cart API structure** — supplyCartList[].productGroupList[].groupItemList[] (not shopList)
5. **Cart-add via XHR interception** — click button, capture network request
6. **Single-daemon WSL→Windows** — simpler than dual-daemon, portproxy for gateway

## Hard rules

These rules are derived from the user's project requirements (see `memory/soul.md`). They are NOT optional:

1. **Adapter must declare destination URL up front.** The first 50 code lines of every adapter (counted after the `@meta` block; front-matter comments don't count) must include a constant naming the canonical entry URL (e.g. `const HOME_URL = 'https://...'`). `bb-eval` enforces this.
2. **Adapter granularity = user's primary use case for that site, not every UI control.** ysbang's 38 adapters (search-by-price, search-by-factory, search-by-provider, ...) are the **anti-pattern**. Filters belong inside `search`, not as separate adapters.
3. **Tier-2/Tier-3 (token+CSRF or webpack injection) is the default assumption.** Cookie-only is the exception, only for genuinely public pages.
4. **Adapter primary user is an AI agent. Human is secondary.** This drives schema design (full English field names, units in values, URLs in every product, `error/hint/action` triple, `recommendedNextActions` chain).
5. **Use bb-browser MCP to author and test.** When login state is required, **stop and wait for the human** rather than proceed with a stubbed session.
6. **All work in English (code, docs, commits). Reply to the user in Chinese.**
7. **All documentation lives under `docs/claude/<category>/<subcategory>/<doc>.md`.** No top-level `.md` sprawl except `README.md` and this `AGENTS.md`.
8. **Honesty over politeness.** If a plan, assumption, or prior decision is wrong, say so with the specific file/line/logic that proves it. The user explicitly asked for this.

## Commit format

Mirrors `bb-browser-main/AGENTS.md`:

```
<type>(<scope>): <summary>
```

- Types: `fix` / `feat` / `refactor` / `chore` / `docs`
- Scope examples: `contract`, `bb-eval`, `skill`, `ecommerce`, `methodology`
- Summary in English, imperative, no trailing period
- Example: `feat(contract): add ecommerce v1 schema for cart-list and order-list`

## Where coding agents should start

If you are a coding agent reading this for the first time and the task is "write a bb-browser adapter":

1. Read `docs/claude/skills/bb-adapter-author/SKILL.md`
2. Identify the domain (ecommerce, pharma-data, or social-media) and read `docs/claude/contracts/<domain>/v1.md`
3. Read `docs/claude/methodology/reverse-engineering/playbook.md` (plus `social-media-playbook.md` for social-media)
4. Author the adapter under `~/.bb-browser/sites/<site>/adapters/<name>.js`
5. Run `tools/bb-eval <path-to-adapter>` and fix every FAIL before declaring done
6. Run the adapter's `example` via bb-browser MCP. If it requires login, stop and ask the human.

## Where humans should start

`README.md` for the why. `memory/soul.md` for context this repo accumulates over time.
