# strategy-picker — the objective's number window (atlas `k-story-problems-within-10`, slice 3)

**2026-09-09 · /eval-fix · CLOSED.** Probe: `scripts/probe-objective-window-caps.mjs`,
12/12 draws → `qa/eval-reports/objective-window-caps-2026-09-09.json`.

## What was wrong

`generateSetup` fixed `maxNumber` by BAND — K 5, Grade 1 10 — and the pool service picks
every problem in code (`enumerateProblems`), so `buildScopePromptSection` could never reach
it. K OPS001-01-F says "solve addition problems **within 10**"; every guided sum stopped at
5. The same defect the scene closed on 09-08, in a second generator.

## What changed

- `service/objectiveNumberWindow.ts` — the scene's resolver, extracted so both generators
  share one definition of the rule. It keys on `hasExplicitScope`, so a lesson naming no
  range leaves the band default alone; a scope equal to the band default returns null.
  Not `resolveScopeRange`, which hard-clamps to the grade and can only narrow.
- `gemini-addition-subtraction-scene.ts` — calls the shared resolver, ceiling
  `SPOKEN_ANSWER_MAX` (20). Prompt and semantics unchanged; both scene cases re-pass.
- `gemini-strategy-picker.ts` — resolves the window from topic + intent + **objectiveText**
  (the range is stated in the objective, not the intent) and feeds the same `maxNumber` axis
  an explicit `config.maxNumber` already drives. Ceiling **10**, the primitive's real drawing
  capacity: `MakeTenViz` has exactly ten cells and fills `i < total`, so an eleventh object
  silently vanishes; `DrawObjectsViz` wraps five per row and a third row runs past its 140px
  SVG. That is capacity, not band policy — raising it means fixing those two views first.
- `catalog/math.ts` — strategy-picker `constraints` now names the band as the DEFAULT and the
  objective as the scope, so the curator will place it on a K within-10 requirement.

## Evidence

| Case | Draw 1 | Draw 2 |
|---|---|---|
| OPS001-01-F @ K (guided) | maxNumber 10; 2+8, 1+3, 5+4, 1+7 → 10/4/9/8 | maxNumber 10; 5+1, 6+4, 3+7, 5+3 → 6/10/10/8 |
| K no-window control | maxNumber 5; sums 4/5/5/4 | maxNumber 5; sums 5/4/5/3 |
| scene make-10 / control | unchanged, both pass | unchanged, both pass |

Gates: `typecheck:lumina` 0 for every file in this slice; registry contract tests 18/18. Two
suite failures (`NumberBond.di-script`, `SortingStation.di-script`) and two `numberBondScript.ts`
tsc errors belong to other uncommitted work in the same tree — neither test names
strategy-picker, and `numberBondScript.ts` was written by another session mid-run.

## Residual — SPK-2 (EVAL_TRACKER)

Both draws introduced only `counting-on`, `tally-marks`, `draw-objects`. OPS001-01-F names
ten frames, tally marks and **doubles**: `strategiesIntroduced` is still chosen by band, so
two of the three named strategies are unreachable at K and the requirement stays partial on
the strategy axis. Same class as the number cap, one axis over. Not fixed here because it
changes what every K strategy-picker lesson introduces, including within-5 lessons this
slice does not touch — that needs its own decision, not a patch.
