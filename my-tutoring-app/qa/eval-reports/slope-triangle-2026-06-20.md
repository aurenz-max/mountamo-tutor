# Structural-Difficulty Eval-Test — slope-triangle (2026-06-20)

Step-2c support-tier difficulty sweep. componentId=`slope-triangle`. Levers are code-enforced
at challenge-build time (generator builds every challenge; LLM only writes title/description).

## Results

| Mode | Scaffold flip (easy→hard) | Structural lever (easy→hard) | Magnitude in-band | Answer leak | Null-tier no-op | Verdict |
|------|---------------------------|------------------------------|-------------------|-------------|-----------------|---------|
| calculate | labels+grid+formula **ON** → all **OFF** | gcd(legs) 1 → 2/3 (reducible, must simplify) | yes — slope set {±0.75,1.5,2,3,±1/3,±1/2,±2/3} same both tiers | none | yes (tier=None, overlays undefined, mixed gcd, meas=True default) | PASS |
| identify_slope | grid+formula **ON** → all **OFF**; labels **OFF** every tier (answer guard) | forcedRun 2 → 4 (more grid squares to count) | yes — slope set m∈{±1,±2,±3,4,±1/2} same both tiers | none | yes (tier=None, overlays undefined, run mix 2/3/4, meas=False default) | PASS |

### Evidence — calculate
- easy (n=5): all `gcd(rise,run)=1` (e.g. 3/2, 2/1, 3/1) — read-direct, no simplify. Scaffolds labels=grid=formula=True.
- hard (n=5): `gcd≥2` every challenge — 2/6→1/3, 3/6→1/2, 9/6→3/2, 4/6→2/3. Must simplify. All scaffolds False.
- Answer slope magnitudes identical family across tiers; legs scaled by common factor (cap run=6 honored; factor clamps down to k=2 where c0·3>6, saturating in-band, never overflowing).
- baseline: tier=None, overlay fields undefined, `showMeasurements=True` (no-tier calculate default), random run/factor mix — matches pre-tier default.

### Evidence — identify_slope
- easy (n=5): all `run=2`, scaffolds grid=formula=True, labels=False.
- hard (n=5): all `run=4`, all scaffolds False.
- Rise grows with run (slope 3 → rise 12/run 4) but that is leg length = counting steps, NOT the answer; answer slope stays in band (≤4). No magnitude inflation of the answer.
- Numeric rise/run labels stay OFF at every tier (the asked answer IS rise & run) — no leak.
- baseline: tier=None, overlays undefined, run mix (3,4,4,3,2), `showMeasurements=False` (no-tier identify default).

## Issues
None. No CRITICAL or HIGH findings. Both code-enforced levers move exactly as declared, scaffolds
flip on schedule, the answer-slope magnitude is held fixed across tiers (scaling rise & run by a
common factor preserves the ratio), and the baseline is a true no-op. draw_triangle (third mode,
same forcedRun 2→4 lever shape as identify_slope) not separately swept; capability verified.
