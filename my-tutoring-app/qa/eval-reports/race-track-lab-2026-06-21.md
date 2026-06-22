# Eval Report: race-track-lab — 2026-06-21

Step 2c support-tier / structural-difficulty sweep (against running dev server, localhost:3000).
Modes swept: observe, predict, measure, calculate, graph — baseline / easy / hard each.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| observe   | PASS | — |
| predict   | PASS | — |
| measure   | PASS | — |
| calculate | PASS | — |
| graph     | PASS | — |

All five Step-2c checks hold at every tier. The tier is correctly wired (scaffolds flip,
structural lever moves easy→hard, magnitude stays in band, no answer leak, null-tier is a no-op).

## Per-mode summary

**Axis 1 — scaffold withdrawal (`showSpeedLegend`, code-set per `resolveSupportStructure`):**
- observe / predict / measure: easy=`true` → hard=`false` — flips exactly as the table declares.
- calculate / graph: `false` at every tier — CORRECT. The numeric speed readout would hand over
  the value the student must compute (calculate) or read from slope (graph); `speedReadoutIsLeaky`
  keeps it OFF as a UI contract, not a lever. Identical-across-tiers here is by design, not "not wired".
- Prompt-shaped scaffolds also move: easy instructions NAME the strategy ("Use the formula speed =
  distance ÷ time", "Look at the speed number next to each racer"); hard instructions stay neutral
  ("Watch the racers move along the track and see which one arrives first"). Easy hints give the
  explicit formula ("Divide the distance of 8 squares by 2 seconds"); hard hints are conceptual only
  ("Think about how many squares each racer covered").

**Axis 2 — structural lever (`resolveProblemShape`, top-two speed gap, code-enforced):**
- Gap moves easy → hard in every mode: easy gap=2, hard gap=1 (asserted exactly in the data).
- racerCountBias: easy biases to 2 racers; hard biases to the grade-band max (hard observe/predict/
  measure/graph showed n=3 challenges, easy was uniformly n=2).
- calculate step-depth (prompt-shaped soft lever): easy = single divide ("find one racer's speed");
  hard = chained ("compute each racer's distance, THEN compare which is faster"). Confirmed moved.

**Magnitude invariance:** speeds stay inside the same band at every tier — hard gets harder by SHAPE
(tighter gap, more racers, chained step), never by bigger numbers. No scope ceiling breach.

**No answer leak (any tier):** hard instructions/questions never name the winning racer or state the
answer numerically; the legend numbers are withdrawn for observe/predict/measure-hard and always off
for calculate/graph. Easy scaffolds genuinely help (legend shown, strategy named). Answer remains
derivable from visible race/graph data at every tier.

**Null-tier no-op:** baseline (`no &difficulty=`) returns `supportTier` undefined, `showSpeedLegend`
undefined (component defaults legend ON via `!== false`), and the un-tiered `assignSpeeds` jittered
fractional spread (e.g. 4.1/1.4, gap 2.7) — visibly distinct from the tier path's clean integer gaps.
Pre-tier behavior is unchanged.

## Notes (informational — not defects in the tier code)

- **Honest band-driven saturation + harness grade ceiling.** Every reachable request lands in the K-1
  speed band {1,4} (bandSpan 3): easyGap=`max(2,round(3*0.6))`=2, medGap=hardGap=1. So the gap lever
  saturates at easy=2 / hard=1, and medium==hard. This is CORRECT given the band. The full 4→2→1
  ladder only appears at a true grade-4 band {1,8} (easyGap=`round(7*0.6)`=4); I verified that math by
  reading `buildSpeedsWithGap`/`resolveProblemShape` — the construction is correct.
- **Root cause of the grade ceiling (pre-existing eval-test plumbing, NOT this primitive):**
  `generateComponentContent` (geminiService.ts) runs `normalizeGradeLevel(gradeLevel)` →
  `getGradeLevelContext(...)` and passes the *prose context string* to the generator. `normalizeGradeLevel`
  has no per-number grades — "grade 4" / "middle school" / "high school" all collapse to "elementary"
  (or middle/high prose), and the generator's `/grade\s*(\d|K)/i` regex then reads "...grades 1-5..."
  → grade 1. Net: `&gradeLevel=grade%204` is effectively ignored; the generator always builds the
  grade-1 config (4 challenges, racerCounts [2,2,3,2], band {1,4}). This caps the structural lever's
  headroom through this endpoint but does not invalidate the easy<hard verification. Filing as a note
  rather than an issue against race-track-lab since it affects the harness for all primitives equally.
