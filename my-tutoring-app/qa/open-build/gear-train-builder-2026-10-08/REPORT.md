# gear-train-builder: workspace binding + three open builds (OB-4 #2), 2026-10-08

Second OB-4 engineering builder, on the tower-stacker pattern. The old primitive was a sandbox with **no evaluation**
(no `usePrimitiveEvaluation`, nothing ever submitted, though the catalog said `supportsEvaluation: true`). Gears sat on
a grid and "meshed" within ±20% of touching, so overlapping gears were allowed. A hint button printed the current
ratio and said "add a bigger gear". All replaced.

## What a child does

Empty track. Tap a gear size (8, 12, 16, 24, 32 teeth) to add a gear to the end of the train, where it meshes with
the one before; tap a gear to take it out (the rest close up). The first gear has the crank. "I'm done!" turns the
crank twice and the code checks the last gear. Three trains per session, code-written.

| Mode | β | Ask | Misses (test order) |
|---|---|---|---|
| `build_direction` (K-3) | 2.0 | at least N gears, last gear turns the same way as / opposite to the first | `too_few_gears`, `wrong_direction` |
| `build_speed` (1-5) | 2.8 | last gear turns faster / slower than the first (sometimes also a way) | + `not_faster`, `not_slower` |
| `build_ratio` (3-5) | 3.6 | last gear turns 2, 3, 4 times per turn of the first, or once per 2 or 3 (sometimes also a way) | + `too_fast`, `too_slow` |

**Judge (code, `gearWorkspace.ts`).** Way = odd number of gears turns the same way; turns per crank turn = first
teeth ÷ last teeth. Middle gears change only the way. Many trains pass (the oracle counts at least two for every
target; most have hundreds).

**Levers (bare at start).** `direction_arrows` (an arrow on every gear), `try_spin` ("Turn the crank": six turns,
ungraded, counting the first and last gear's turns), `simpler_train` (drops the way, or eases a ratio to 2 / ½, or two
fewer gears). `too_few_gears` unanswered: the ask states the number.

**Tutor facts.** `gearsPlaced`, `firstGearTeeth`, `lastGearTeeth` as numbers (work history), the train in words. No
way, speed or verdict. Guidance: never say which way or how fast a gear turns, which gear to add, or the rules
(each mesh reverses, smaller is faster).

**Generator.** Code writes every target from per-band pools (a random subset, easiest first); flash-lite writes the
title. Mixed: K-1 direction×2 + speed; 2-3 direction + speed×2; 4-5 speed + ratio×2.

**Backend prior key fixed.** `PROBLEM_TYPE_REGISTRY` had `"gear-train"`, which no primitive sends, so the prior never
matched. Now `"gear-train-builder"` with the three modes and a default.

Size: about 900 production lines (old component + generator 1,254), 205 test lines, a probe and a drive script.

## Gates

| Gate | Result |
|---|---|
| `GearTrainBuilder.workspace.test.tsx` | 10/10 (every miss, Try again keeps the train, history `gearsPlaced 0 → 4 → 3`, arrows, trial crank counts 6 → 12, picture excludes aids, simplify, scripted path, every band × mode through oracle + adapter + reference train) |
| vitest: live-activity, manifest, qa, pip, engineering, build-layer | 172 files, 4,122 pass; 1 load timeout (`MathPrimitivesTester.surface`, passes alone) |
| `typecheck:lumina` | 0 |
| full tsc | 771, unchanged since tower-stacker (the extra one vs HEAD is the stale `.next` route type) |
| journey sweep | 3 payloads × 3 items, 0 findings, all misses named |
| real generator (`scripts/gear-train-build-probe.mjs --run`) | 9 sessions: oracle 0, adapter ok, journey pass/wrong trains right on all 27 items. Intent: "exactly three times" → ratio; "which way the last gear turns" → direction; "explore how gears work" → mixed. A variety bug was found here and fixed (the 5-target pool always gave its first 3) |
| headless Chromium drive (`drive.mjs`) | 12/12: wrong count of gears → "turns the wrong way" → take one out → pass; backwards pair → "does not turn slower" → revise → pass; swapped ratio → "too few times" → reference → pass; six 32-tooth gears fit a 358 px column (gears 61 px), tray buttons 44 px |
| watcher | 5 builds, 5 lines, 0 leaks |

## Not verified / owed

- No Live run; rides the engineering class Live gate (with tower-stacker).
- Phone width checked by narrowing the primitive in the desktop tester, not on a phone. A 6-big-gear train scales its
  tooth labels down to about 5 px; short trains read fine.
- The check spins the crank twice for the eye only; the verdict is computed at once, not after the spin.

## Rulings owed

1. Mixed sessions by band (above), the R4/R7 question.
2. `build_speed` K-1 includes "faster, and the opposite way" (two demands at K-1). Keep, or K-1 speed asks only one?
