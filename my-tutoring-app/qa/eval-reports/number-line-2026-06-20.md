# Structural-Difficulty Eval-Test — number-line (2026-06-20)

Generator: `my-tutoring-app/src/components/lumina/service/math/gemini-number-line.ts`
Brief: `C:/tmp/struct-diff-briefs/number-line.json`
Sweep: Step-2c support-tier difficulty sweep (baseline / easy / hard), live dev server, componentId=`number-line`, gradeLevel=`Grade 4`.
Archetype: graph-data. All four tested levers are **code-enforced** (constructive re-selectors).

## Results

| Mode | evalMode | Lever (code-enforced) | Scaffold flip (easy→hard) | Easy lever value | Hard lever value | Magnitude in band | Answer leak | Null no-op | Verdict |
|------|----------|------------------------|----------------------------|------------------|------------------|-------------------|-------------|-----------|---------|
| plot_point | `plot` | target-to-label distance (`labelPlacement` on→mid) | tickInterval 2→4; anchors on→off | tv all ON labeled (even) ticks `[8,14,18,0,20]`, anchors `[6,10]…` | tv all MIDWAY (odd) `[17,19,5,1,15]`, no anchors | yes (0–20 both) | none | yes (mixed parity, no anchors, tick=undef) | PASS |
| show_jump | `jump` | steps-to-solve depth (`jumpSteps` 1→2) | worked arc true→false | 1 op, `arc:true` (e.g. start14 +2 →16) | 2 chained ops, `arc:false` (15+4→19, 19+1→20; tv=[19,20]) | yes (0–20 both) | none | yes (single op, arc:false, no tier) | PASS |
| order_values | `order` | adjacent-gap `orderGap` wide→clustered | tickInterval 2→4 | `[0,10,20]` (min gap 10) | `[10,11,12]/[7,8,9]/[3,4,5]/[0,1,2]` (gap 1) | yes (0–20 both) | none | yes (mixed gaps `[2,13,11]`, tick=undef) | PASS |
| find_between | `between` | bound-gap `boundGap` wide→narrow | tickInterval 1→2; anchors on→off | bounds `[0,10]` (8 ticks between), anchors `[1,2]` | bounds `[3,5]/[6,8]/[5,7]` (gap 2, one value between) | yes (0–10 both) | none | yes (gap≥2 mixed, no anchors, tick=undef) | PASS |

### Lever verification detail
- **plot**: integer line span 20 → labelIv=2 (labels on evens). Easy `labelPlacement='on'` snapped every target to an even labeled tick; hard `'mid'` placed every target on the odd midpoint between two labels (widest interpolation). Code-enforced exactly; numberType/range never widened.
- **jump**: hard's second op `startValue` always equals the first op's landing (chained), cumulative landing clamped in range; `targetValues` carries BOTH landings. Easy/baseline single op. The structural lever is the operations-array length (1→2), not magnitude.
- **order**: `reshapeOrderSet` 'wide' maximises the min adjacent gap; 'clustered' picks the tightest perSet-window (adjacent gap 1). Values stayed distinct and in range at both tiers.
- **between**: `reshapeBetweenPair` 'wide' picked the max-gap pair; 'narrow' picked a gap-2 integer pair that still has exactly one value strictly between (floor honored — no unanswerable pair). Easy anchors sit strictly between the bounds and never equal the answer.

### Scaffold flips confirmed (code-set fields the component reads)
- `tickInterval` (label coarseness): rises easy→hard in plot (2→4), order (2→4), between (1→2). Baseline leaves it undefined (component default).
- per-challenge `highlights` (benchmark anchors): present at easy for plot/between, withdrawn at hard. Never equal to a target (leak guard in `buildAnchorsForChallenge`).
- `operations[].showJumpArc`: true at easy, false at hard for show_jump.

## Issues

No CRITICAL or HIGH issues.

(Note, not a defect: at the EASY tier `order` returns the same maximally-wide set `[0,10,20]` for all four challenges, because `reshapeOrderSet('wide')` is deterministic on a fixed integer pool — slight in-session monotony, no difficulty/correctness impact. Also `order` easy produced no anchors because the [0,10,20] span fills the whole line so no in-range below/above helper tick exists; the tickInterval 2→4 flip still carries the scaffold signal.)

## Verdict: PASS

All four code-enforced levers move easy→hard exactly as declared, scaffolds withdraw correctly, magnitude stays in the per-mode band at every tier, no answer leaks at any tier, and the baseline matches the pre-tier default (no tier applied).
