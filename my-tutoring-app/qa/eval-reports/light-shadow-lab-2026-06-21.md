# Eval Report: light-shadow-lab — 2026-06-21

Step 2c support-tier / structural-difficulty sweep against the running dev server
(localhost:3000). Modes swept: observe, predict, measure, apply — baseline / easy /
hard each, grade 3, topic "Sun position and shadows".

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| observe   | PASS   | —      |
| predict   | PASS   | —      |
| measure   | PASS   | —      |
| apply     | PASS   | —      |

## What was verified (all 5 Step-2c checks PASS)

**1. Scaffold withdrawal deterministic (code-set).** `resolveSupportStructure` fields
flipped exactly per the table on every challenge of every mode:
- easy → `showLiveShadowReadout:true, showSunPath:true, showDirectionLabels:true`,
  rule named in hint.
- hard → all three `false`, hint replaced by the generic stripped fallback
  ("Look at where the sun is…" / apply: "Look at the shadow first…").
- baseline → all three fields `undefined` (component defaults: sunPath/dirLabels ON,
  readout OFF = legacy), `supportTier` undefined. No LLM variance observed in these
  fields — deterministic as required.

**2. Structural lever (boundary margin) moves easy→hard.** `tierMarginDegrees`
(easy 14 / hard 1) is code-enforced and held in every mode. Sun altitude/azimuth sat
~14° from the nearest length/direction boundary at easy (e.g. observe alt=17 az=65 →
exactly 14° from edges; clamps to 12 in the narrow `long` bin) and ~1° at hard
(alt=29/az=79, alt=61/az=81, alt=29/az=99 — all 1° off a 30/60/80/100 boundary).
Lever moves decisively in all four modes.

**3. Magnitude invariance / bin preserved.** Degrees stayed inside legal ranges
(alt 5–85, az 5–175) at every tier, and the answer CATEGORY was preserved across
tiers (e.g. observe row 1 stays W/long at baseline 20/25, easy 17/65, hard 29/79).
Harder = the sun sits nearer a bin boundary (subtler to read), never bigger numbers,
never a scope/bin crossing. `correctShadow` is recomputed from the reshaped degrees
so the emitted answer never drifts (verified: hard alt=31/az=78 correctly →
W/medium).

**4. No answer leak at any tier.** Correct MC option is always present alongside
distractors; instruction text never states the answer. The live length/direction
readout (the strongest self-check aid) is shown only at easy and withdrawn at hard;
at hard distractors are near-miss (one zone off / adjacent direction) per the lever.
Easy scaffold genuinely helps (readout + labels + sun-path + named rule all on),
so the easy→hard gradient is real.

**5. Null-tier no-op.** Baseline output matches pre-tier behavior: scaffold fields
undefined, `supportTier` absent, sun positions at natural deep-in-bin reference
values (20/25, 65/90, 20/155). Baseline does not look "hard."

## Honest saturation (band-driven, not a bug)

The easy target margin is 14° but `placeAtMargin` clamps it to half the bin width:
the `long` altitude bin [5,29] (width 24) saturates easy at 12° (observe easy alt=17).
Confirmed this matches the generator clamp `Math.floor((hi-lo)/2)` — correct
behavior, not a lever failure. Hard reaches margin 1 cleanly in every bin. The
length/direction categories cannot widen the band without changing the answer, so
saturation here is the intended ceiling of the structural axis.

No CRITICAL or HIGH issues found. Tier is fully wired across all four eval modes.
