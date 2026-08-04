# number-line `--check` — 2026-08-03 — verdict: **COMPATIBLE**

Edit under guard: reader-fit **14m pilot** — canonical-grade-first band resolution
(`numberLineGradeBandFromGrade(ctx.grade)` wins; prose `resolveGradeBand` kept as
fallback at all 5 sites). Diff: `gemini-number-line.ts` +33/−9 (additive; every prose
call site preserved as `??` fallback), + new focused test file. Contract:
`docs/contracts/number-line.md` (derived same slice, 12 R, C1 OPEN).

## Pre-edit blast radius (printed before authoring)

Edit serves R2 (all 8 authored G1 subskills + 3-5 reachability). Other-consumer
requirements probed post-edit: R1, R3, R4, R5, R6, R7, R8, R9. Out-of-zone by
doctrine: C1 (clamp / pool window / between semantics — owned by 14k, untouched;
`git diff` confirms no edit to `:1449-1453` clamp, `numberPoolService.ts`, or the
component).

## Post-edit probes (real Gemini via `/api/lumina/eval-test`, dev :3000, 2026-08-03)

| R | Probe | Result |
|---|---|---|
| R2 (edit's own) | `plot&grade=4` | **3-5, decimal** — first runtime proof the 3-5 band is reachable on the ctx path |
| R2 (edit's own) | `plot&grade=1` "Counting to 120" | **K-2, integer** (band the 8 authored consumers demand) |
| R2 fallback | `plot`, no `grade` | K-2 — legacy prose path unchanged |
| R1 | `plot&grade=K` "Counting to 5" | range {0,5}, targets [4,0,1,2,3] all ≤5 — resolver narrows, intact |
| R3 | `identify&grade=4` | pinned K-2 / {0,10} / integers 1-10 — canonical grade correctly ignored |
| R4 | `jump&grade=1` "subtraction within 20" | K-2, range {0,20}, ops arithmetic recomputes, sizes ∈ [1..5] |
| R5 | `order&grade=1` | 4 sets × 3 distinct in-range values |
| R6 | `between&grade=1` "numbers to 10" | 4 pairs, both endpoints in range, interior integer exists each |
| R7 | `plot&grade=1&difficulty=hard` | supportTier stamped, tickInterval 4, anchors withdrawn, max target 13 ≤ 20 (hard ≠ bigger) |
| R8 | observed across probes | target windows spans 17/20/22 ≤ 25 |
| R9 | observed across probes | all challenge sets distinct |

## Static gates

- Focused `gemini-number-line.grade-band.test.ts` **7/7**; **non-vacuity proven**: reverting
  the `canonicalGradeBand` threading fails the Grade-4 wiring test (1 failed / 6 passed observed).
- `typecheck:lumina` 0; full tsc **803 = baseline** (all pre-existing, outside lumina/).
- Full vitest **1327/1327** (tree also carries the DI stream's in-flight di-letter-sounds L4 files).

## 14k census replay (measured honestly — NOT closed by this edit)

`between&grade=1`, census topic + 90–110 intent: band now K-2 ✓ deterministic, but
range still clamps to {0,30}, endpoints landed 63–85 (window placement ignores the
intent focus), accept is still any-interior. **14k stays open**; its mechanism is now
pinned in contract C1: (a) K-2 clamp ≤30 vs the authored ≤120 demand, (b) uniform
pool-window placement (no window floor), (c) `find_between` interior-accept vs
exact-adjacent task. Note: endpoints outside the drawn range on big-range K-2 topics
is a **pre-existing** C1 symptom (the census observed the same class), not a
regression of this edit.

Changelog line appended to the contract. Reporter: 14m pilot slice
(`qa/reader-fit/number-line-14m-2026-08-03.md`).
