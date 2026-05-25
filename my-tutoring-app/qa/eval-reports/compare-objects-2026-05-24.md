# Eval Report: compare-objects — 2026-05-24

## Files

- Component:  [CompareObjects.tsx](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/CompareObjects.tsx)
- Generator:  [gemini-compare-objects.ts](my-tutoring-app/src/components/lumina/service/math/gemini-compare-objects.ts)
- Catalog:    [math.ts:3586](my-tutoring-app/src/components/lumina/service/manifest/catalog/math.ts#L3586)

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| identify_attribute | PASS | — |
| compare_two | FAIL → FIXED | 1 (resolved) |
| order_three | FAIL → FIXED | 4 resolved |
| non_standard | PASS | — |

## Issues

### compare_two — Seesaw tilts the wrong way for weight comparisons
- **Severity:** CRITICAL
- **What's broken:** In [CompareObjects.tsx:120-155](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/CompareObjects.tsx#L120-L155), the seesaw visual rotated so the **heavier** object's side went **up** and the lighter side went **down** — the opposite of a real balance.
- **Fix in:** COMPONENT — inverted the sign: `const tiltDirection = diff > 0 ? -1 : diff < 0 ? 1 : 0;` (one-character fix).
- **Status:** Fixed 2026-05-24. Verified across 3 stochastic runs (6 weight challenges total).

### order_three (weight only) — Seesaw renderer dropped the 3rd object → bar fallback wasn't weight-themed
- **Severity:** CRITICAL → fixed with custom 3-scale renderer
- **What was broken (round 1):** [CompareObjects.tsx:576-578](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/CompareObjects.tsx#L576-L578) routed any `attribute === 'weight'` challenge with `objects.length >= 2` to `renderWeightObject`, which hardcodes a 2-pan seesaw. For `order_three` weight, the third object was rendered as a tap-target button but **invisible on the balance**.
- **What was still wrong (round 2):** The previous fix tightened the condition to `=== 2` so 3-weight challenges fell through to the default horizontal-bar renderer. Bars work but they're not a weight metaphor — students see length-style bars labeled with object names, not a weighing visualization. User reported this looks broken.
- **Fix in:** COMPONENT + GENERATOR.
  - Added new renderer `renderThreeScaleWeights(objects, weightUnit)` ([CompareObjects.tsx:161](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/CompareObjects.tsx#L161)) — three platform scales side-by-side. Each scale sags downward by `visualSize` (heavier = bigger drop), the spring/post visibly compresses, and a digital readout below shows `displayWeight` (derived from visualSize as 1-9) with the unit (`lbs`/`kg`/`oz`/etc.).
  - Routing condition: `attribute === 'weight' && objects.length >= 3` → `renderThreeScaleWeights` ([CompareObjects.tsx:585](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/CompareObjects.tsx#L585)).
  - Generator schema gained an optional `weightUnit` field in the `order_three` schema; prompt instructs Gemini to provide it for weight challenges (`lbs`/`kg`/`oz`). Component defaults to `'lbs'` when missing.
  - `reconstructOrderThree` now also verifies that `visualSize` ranks consistent with `actualValue` ranks; on mismatch it snaps visualSize to canonical [20, 50, 80] so the displayed weight always agrees with `correctAnswer`.
- **Status:** Fixed 2026-05-24. Re-tested 4 stochastic runs of `order_three`; weight challenges in every run rendered the 3-scale visual with populated `weightUnit` (observed: `oz`, `lbs`), and `visualSize` always rank-matched `actualValue`.

### order_three — Display order leaks the correct answer (randomizer missing)
- **Severity:** CRITICAL
- **What's broken:** Generator emitted the `objects[]` array in already-sorted order; component rendered in array order so students tapped left-to-right to win.
- **Fix in:** GENERATOR — `shuffleNonTrivial(objects)` in `reconstructOrderThree` rejects any shuffle matching ascending or descending sort by `actualValue`. `correctAnswer` is name-keyed, so the shuffle is order-invariant.
- **Status:** Fixed 2026-05-24. Re-verified after this round: 4 runs × 4 challenges = 16 order_three samples, none rendered in already-sorted order.

### order_three — Instruction direction stochastically contradicts comparisonWord direction
- **Severity:** HIGH (was stochastic — ~3/16 challenges across original 4-run sample)
- **What was broken:** `correctAnswer` is derived from `comparisonWord` direction (`shorter`/`lighter`/`holds_less` → ascending; rest → descending). Gemini stochastically wrote the instruction prose in the *opposite* direction. Observed cases (run ot2):
  - `cw=heavier corrDir=DESC` but instruction "Order them from lightest to heaviest" (ASC) → student following instruction taps lightest first, gets marked wrong because correctAnswer expects heaviest first.
  - `cw=shorter corrDir=ASC` but instruction "organize these pencils from longest to shortest" (DESC) → same mismatch.
- **Root cause:** SP-17 (instruction-data desync) — `instruction` was LLM prose, `correctAnswer` is deterministic post-process; both reference order direction but nothing kept them aligned.
- **Fix in:** GENERATOR — **SCHEMA-SIMPLIFY** (same approach as hundreds-chart HC-1/2/3). Removed `instruction` from the `order_three` Gemini schema entirely; added `buildOrderThreeInstruction(comparisonWord, attribute)` helper in [gemini-compare-objects.ts](my-tutoring-app/src/components/lumina/service/math/gemini-compare-objects.ts) that synthesizes the prose from a 4-attribute × 2-direction lookup table. Endpoints per attribute: length [shortest, longest], height [shortest, tallest], weight [lightest, heaviest], capacity [holds the least, holds the most]. `reconstructOrderThree` sets `challenge.instruction` from the helper, so direction is correct by construction. Prompt rule that asked Gemini to author instructions was removed; a new note tells Gemini "the student-facing instruction is synthesized by the post-process — do NOT author it."
- **Verification:** 3 stochastic runs × 4 challenges = 12 order_three samples; instruction direction matched `comparisonWord` direction in 12/12 (was 13/16 before). Other modes re-tested: identify_attribute, compare_two, non_standard all PASS — no regression. Natural-language variety preserved in those three modes; only `order_three` (where templated prose is fine for K-1) uses synthesized text.
- **Status:** Fixed 2026-05-24. Tracked as CO-5.

## Notes (not flagged as issues)

- `identify_attribute` includes distractors like `"color"` and `"temperature"` in `attributeOptions`, which is correct pedagogy (forces students to distinguish *measurable* attributes).
- `non_standard` data looks clean; `unitCount` matches the visual unit row, instruction is unambiguous.
- New 3-scale renderer uses `visualSize`-derived display weight (`Math.max(1, Math.round(obj.visualSize / 10))`) so the readout maps to a small clean integer (1-9) with the unit. Since `visualSize` is rank-consistent with `actualValue` (enforced in post-process), the visual ordering always agrees with `correctAnswer`.
