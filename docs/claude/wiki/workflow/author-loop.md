---
title: Author loop
type: wiki-workflow
last_updated: 2026-06-28
---

# Author loop

The full 7-step loop for writing a bb-browser adapter. This is the wiki summary; the canonical system prompt lives at [`docs/claude/skills/bb-adapter-author/SKILL.md`](../../skills/bb-adapter-author/SKILL.md) and you should read it in full before authoring.

## The 7 steps

```
1. READ the contract for the domain
   → docs/claude/contracts/<domain>/v1.md
   → If no contract exists for this domain, stop and ask the human whether to draft one.

2. IDENTIFY the adapter name
   → Match against the P0/P1 set in the contract.
   → If the requested name is forbidden (e.g. search-by-price), explain to the user
     and propose folding the request into the canonical adapter.

3. CAPTURE the real API
   → Open the target page via bb-browser MCP.
     If login is required → STOP. Tell the human you need them to log in.
   → Use bb-browser network --with-body to record the user flow that triggers
     the data you need.
   → Identify: endpoint URL, method, headers, body, response shape, pagination key.

4. AUTHOR the adapter
   → Start the file with the @meta block (all required fields per contract).
   → Declare the URL constant(s) in the first 50 lines.
   → Implement: validate args → ensure context (navigation if needed) → call API
     → map to contract schema → return.
   → Populate requestedConstraints / executedConstraints / deferredConstraints honestly.
     Do NOT mark a constraint as executed when you only acknowledged it.
   → Populate recommendedNextActions to chain to logical next adapter.

5. SCORE with bb-eval
   → tools/bb-eval <path-to-adapter>
   → Fix every FAIL.

6. RUN the example
   → Execute the @meta.example command via bb-browser MCP.
   → If output is empty or wrong, return to step 3 (your endpoint is wrong).
   → If output passes, snapshot it under fixtures/<domain>/<site>-<adapter>.json
     for future regression.

7. COMMIT
   → Follow AGENTS.md commit format: <type>(<scope>): <summary> in English.
```

## Where to spend time

| Step | Time (typical) | Failure mode if rushed |
|---|---|---|
| 1. Read contract | 5 min | Adapter violates the contract. `bb-eval` FAILs. |
| 2. Identify name | 1 min | Forbidden name; reviewer rejection. |
| 3. Capture API | 15–60 min | Guessed endpoint. Adapter never works. |
| 4. Author | 20–60 min | Wrong schema; envelope-shape bugs. |
| 5. bb-eval | 1 min | FAILs not fixed; can't merge. |
| 6. Run example | 5 min | Schema-correct but wrong endpoint. |
| 7. Commit | 1 min | Commit-message format errors. |

**Most past failures are in step 3.** The reverse-engineering playbook ([workflow/reverse-engineering.md](reverse-engineering.md)) is the longest page in this wiki for that reason.

## Stop-and-ask gates

You **must stop and ask the human** at these points — do not paper over with workarounds:

| Gate | Why | What to ask |
|---|---|---|
| Login required | AGENTS.md #5 | "Please log in via the browser. I'll wait." |
| No domain contract exists | Don't invent a contract silently | "Should I draft a new contract, or extend an existing one?" |
| Multi-step auth (CSRF issued by HTML page, then JSON body) | Tier-3 is ~30 min work | "Confirm tier-3 is worth it before I invest." |
| The adapter would mutate state without undo (order-create, payment) | AGENTS.md | "Are you sure? This bypasses human submit." |
| Two intents feel like they should be one (or vice versa) | Don't pick granularity alone | "Confirm the granularity before I author." |

## Honest caveats

- **Step 5 (`bb-eval`) is static.** It can confirm the adapter *says* the right things but not that it *works*. Always do step 6.
- **Step 6 (run example) requires a working browser.** If MCP eval is down (rate limit, daemon disconnect), fall back to the runtime-shape verifier ([workflow/runtime-verification.md](runtime-verification.md)) for envelope-shape confidence.
- **The 7-step loop is iterative.** Steps 3–6 often cycle 2–3 times before the adapter is right. Don't try to write the whole file in step 4 before seeing real data.

## Related

- [Reverse-engineering](reverse-engineering.md) — the longest step.
- [bb-eval](bb-eval.md) — the static gate.
- [Runtime verification](runtime-verification.md) — the runtime gate.
- [When to stop and ask the human](when-to-stop-and-ask-the-human.md) — the gates.
- [Author skill (canonical system prompt)](../../skills/bb-adapter-author/SKILL.md)
