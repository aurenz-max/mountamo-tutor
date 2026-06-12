# Difficulty Sweep: rollout #2 (11 generators) — 2026-06-11

Third wave of IRT within-mode difficulty. Brings the difficulty spec to **17
primitives total** (2 keystone + 4 rollout #1 + 11 here). Same contract: mode =
WHAT (pinned by pedagogy), difficulty = HOW HARD within the mode's β band,
computed code-side from `config.studentTheta` (2PL @ P*=0.70 using the catalog
`discrimination`), every quantity drawn from `modeRange ∩ scopeWindow ∩
difficultyBand`. Built by 11 parallel Workflow agents (one generator each) +
central catalog `discrimination` edits (50 modes) + the sweeps below.

Representative mode swept per primitive at θ LOW/MID/HIGH; scope-conflict run at
HIGH θ with an explicit small ceiling; null-θ confirms the grade-band no-op.
Values shown are the max scope-bearing quantity (product for the array/area/
multiplication modes).

## Results — all PASS

| Primitive | Mode | Arch | LOW→MID→HIGH | Mono | Scope-conflict | Null-θ |
|-----------|------|------|-------------|------|----------------|--------|
| comparison-builder | compare_groups | refactored | 5→10→10 | ✅ | "within 5"→5 ✅ | 7 |
| number-bond | decompose | refactored | 5→8→10 | ✅ | "within 5"→5 ✅ | 9 |
| base-ten-blocks | build_number | refactored | 43→233→890 | ✅ | "within 20"→20 ✅ | 285 |
| skip-counting-runner | count_along | refactored | 25→40→45 | ✅ | "within 20"→20 ✅ | 40 |
| array-grid | build_array (product) | pool | 12→15→20 | ✅ | "Arrays within 12"→12 ✅ | 20 |
| area-model | find_area (product) | pool | (capped, see below) | ✅ | "within 600"→468 ✅ | — |
| multiplication-explorer | build (product) | refactored | 8→20→35 | ✅ | "Multiply within 25"→25 ✅ | 36 |
| math-fact-fluency | visual_fact | refactored | 5→8→10 | ✅ | "Add within 5"→5 ✅ | 8 |
| regrouping-workbench | add_no_regroup | refactored | 19→39→63 | ✅ | "Add within 20"→20 ✅ | 38 |
| addition-subtraction-scene | act_out | refactored | 5→5→5† | ✅ | "Add within 5"→5 ✅ | 10 |
| factor-tree | guided_small | pool | 12→16→24 | ✅ | "up to 20"→20 ✅ | 16 |

† `act_out` magnitude is flat at 5 under `gradeLevel=elementary` (the K-level
concrete mode is grade-capped at 5). Valid — scope/grade wins — but the magnitude
axis doesn't move for this mode at this grade; difficulty there lives in story
complexity, not number size. Higher grades open the band (5→10→20).

## Bug found + fixed: area-model empty session (CRITICAL → fixed)

The first `area-model find_area` scope sweep returned **0 challenges** for any
"within N" topic (the no-ceiling topic worked). Two compounding causes in the
agent's refactor:

1. **`capProductToWindow` couldn't bind.** It floored the band shrink at the
   *difficulty lo* (`Math.max(f2lo, …)`), so a HIGH-level band `[30,49]×[30,49]`
   collapsed to `[30,30]×[30,30]` — product 900, still far above a 100–600
   window. The "product ≤ window" guarantee was false whenever `window <
   f1lo*f2lo`.
2. **The 2×2 generator rejected, didn't degrade.** `findAreaOperands` requires
   both factors to decompose into tens+ones (a 2×2 grid). The collapsed `[30,30]`
   only yields 30 → `[30]` (one part) → every draw rejected → empty session.

Fixes (area-model generator only):
- `capProductToWindow` now shrinks below the difficulty lo to a **structural
  floor** (11 for 2-digit grid factors, 100 for multiply's 3-digit f1) — scope
  wins over the difficulty band *entirely*, so the product actually fits.
- the 2×2 generator **nudges** a multiple-of-10 factor down to the nearest value
  with a ones digit (keeps a valid grid, never creeps past the window) instead of
  rejecting.
- a **non-empty guard** in `buildChallenges` falls back to the mode's minimal
  valid pair, so a scope below the mode's structural floor degrades to a minimal
  challenge rather than rendering nothing.

Re-verified: "within 600" → 5 challenges, max product 468 (binds); "within 100"
(below find_area's 11×11=121 floor) → 5 challenges, all 121 (graceful minimum, no
empty session); unbounded → products 144–391. This generalizes the rollout-#1
span-clamp lesson to **product modes**: capping each factor band independently is
insufficient, and a cap that can't shrink below its own lo silently fails.

## Plumbing

- **catalog/math.ts**: `discrimination` added to all **50** modes across the 11
  primitives (1.8 concrete recognition/build, 1.6 abstract operational, 1.4
  estimation/fluency), applied by an idempotent script that skips modes already
  carrying it (so rollout-#1 shared keys like `find_skip_value`/`match` were
  untouched). Catalog discrimination fields: 28 → 78.
- Registration: all 11 already forward `item.config` (spread or wholesale) → no edits.
- tsc: **1441 errors** (below the 1444 baseline), zero in any touched file.

## Verdict

17 primitives now honor calibrated, monotonic, scope-safe difficulty. New lesson
this round: **product-mode caps must be able to shrink below the difficulty lo,
and value generators must degrade rather than reject** — a cap floored at its own
lo, or a generator that rejects every collapsed draw, silently empties the
session. ~41 eval-mode primitives remain (many non-numeric — shapes, function
rules — where the difficulty axis is not a count).
