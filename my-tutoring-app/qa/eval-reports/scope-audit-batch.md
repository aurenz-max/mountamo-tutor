# Scope Audit — Batch Report

**8** components across **1** lessons — 3 PASS · 4 FAIL · 0 VAGUE · 1 N/A

## FAIL — generated values exceed the scope ceiling

| Lesson | Generator | max | ceiling | over | Bounding objective |
|---|---|---|---|---|---|
| Counting to 10 | `number-sequencer` | 50 | 10 | +40 | Identify numbers 1 through 10 in order. |
| Counting to 10 | `number-line` | 20 | 10 | +10 | Identify numbers 1 through 10 in order. |
| Counting to 10 | `counting-board` | 12 | 10 | +2 | Apply counting to a collection of up to 10 objects by touching each o… |
| Counting to 10 | `deep-dive` | 11 | 10 | +1 | Explain that the last number we say tells us the total amount. |

## How to read a failure

- **FAIL** — the objective *did* carry a range but the generated values blew past it.
  Check whether that generator calls `buildScopePromptSection` (scopeContext.ts). Only
  ten-frame + number-sequencer are migrated so far; an un-migrated generator here is a
  rollout target. If it *is* migrated, the prompt binding needs strengthening.
- **VAGUE** — the manifest never put a range into the objective text, so there was nothing
  to bind to. Fix upstream in the manifest/curator prompt, not the generator.
- **PASS / N/A** — within scope, or no numeric content to check.
