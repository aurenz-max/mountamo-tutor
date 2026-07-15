# Topic Fidelity: cross-board intent contract sweep — 2026-07-14

## Contract

For a fixed broad topic, changing the per-component intent must change the
student-facing content that the primitive generates. The lesson topic is framing;
the resolved objective/intent is the assignment. Eval mode still controls the task
modality and grade remains a ceiling.

## Root cause

The registry had already resolved `GenerationContext`, but 52 context-native
generator files never consumed `ctx.intent`, `ctx.scope`, or `ctx.objective`. They
prompted from the broad topic alone, so different component assignments could
collapse to the same content. Five registry adapters also remained on the legacy
positional contract, leaving the same defect class open at the dispatch boundary.

## Fix

- Wired the shared authoritative `buildScopePromptSection(ctx.scope)` into all 52
  dead-intent generators. This uses the existing generation call, not another LLM
  pass.
- Threaded scope explicitly through six non-standard orchestrators whose prompt is
  built outside the common generator shape.
- Migrated the final five legacy adapters (`distribution-explorer`,
  `practice-problem`, `curator-brief`, `annotated-example`, and `knowledge-check`)
  to `registerContextGenerator`.
- Replaced the hand-maintained 34-generator registry ledger with an invariant that
  every registered generator is context-native.
- Added `npm run audit:intent-contract`, plus a CI test, which fails if any
  `GenerationContext` generator stops consuming a canonical objective axis.

Post-fix structural coverage:

| Contract | Coverage |
|---|---:|
| Registered generators using resolved `GenerationContext` | 193 / 193 |
| Context-native generator files consuming intent/scope/objective | 171 / 171 |

## Fixed-topic, varying-intent probes

All probes used the same topic within each pair and changed only intent.

| Primitive | Fixed topic | Intent A → output | Intent B → output | Verdict |
|---|---|---|---|---|
| classification-sorter | Classifying living things | diet → Herbivore / Carnivore / Omnivore | habitat → Land / Water / Both | FULL |
| machine-profile | Simple machines in everyday life | seesaw → Playground Seesaw / lever explanation | flagpole → Flagpole Pulley System / pulley explanation | FULL |
| timeline-builder | Ordering historical events over time | Apollo milestones → Apollo event sets | civil-rights milestones → civil-rights event sets | FULL |
| constellation-builder | Recognizing star patterns | Orion → Orion first | Big Dipper → Big Dipper in all four challenges | FULL |
| histogram | Reading/describing histograms | temperature title, but mixed contexts | reading-minutes title, but mixed contexts | PARTIAL |
| net-folder | Connecting nets to solids | requested cubes, generated rectangular prisms | requested triangular prisms, generated rectangular prisms | PARTIAL |

The partials are intentionally not counted as complete fixes. In those generators,
intent now steers LLM-authored framing, but deterministic/code-picked value pools
remain independent of intent. Those are Tier-2 value-selection changes, not dead
prompt wiring. They should be handled by intent-aware deterministic selectors (or,
only with explicit approval, an additional resolver call) and re-probed separately.

## Verification

- `npm run audit:intent-contract`: 171 / 171 pass
- focused intent/registry/sorting tests: 5 / 5 pass
- full Vitest suite: 56 files, 726 / 726 tests pass
- `npm run typecheck:lumina`: 0 errors
- live eval-test probes: 12 / 12 status `pass`; semantic verdicts above

