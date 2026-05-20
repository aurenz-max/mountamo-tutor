# Eval Report: place-value-chart — 2026-05-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| identify       | PASS | 0 |
| build          | PASS | 0 |
| compare        | PASS | 0 |
| expanded_form  | PASS | 0 |

All four modes generate valid data, render correctly, and pass G1–G5 sync checks. Phase 2 ("Find the Value") was redesigned from a numeric-MC check to a word-form vocabulary check (PVC-1 fix).

## Notes — PVC-1 Fix (2026-05-15)

**Original issue:** Phase 2 trivialized after Phase 1. The number-display card showed `Highlighted digit: 7`, Phase 1 established the place name, then Phase 2 asked "What is the value of this digit?" with numeric MC `[70, 7, 700, 0.7]`. Once the place name was known, the answer was mechanically derivable — students appended zeros to the visible digit without recalling place-value vocabulary.

**Fix (SCHEMA-CHANGE + COMPONENT):**

1. **Generator** (`gemini-place-value.ts`):
   - Added `ONES_WORDS` / `TENS_WORDS` / `DECIMAL_PLACE_WORDS_{SINGULAR,PLURAL}` constants.
   - Added `buildDigitValueWord(digit, place)` — produces "Seventy", "Three Hundred", "Eighty Thousand", "Five Tenths", "One Tenth" (singular when digit=1).
   - Changed `digitValueChoices` from `number[]` to `{ value: number; wordForm: string }[]`. Numeric value remains the stable correctness key; word-form is the display label.
   - Distractor strategy preserved (off-by-one place from correct), now produces a real word-form for each candidate.

2. **Component** (`PlaceValueChart.tsx`):
   - Updated `PlaceValueChartChallenge.digitValueChoices` interface.
   - Phase 2 prompt: *"How do you say this digit's value out loud?"*
   - Phase 2 buttons render `choice.wordForm` ("Thirty") instead of `choice.toLocaleString()` ("30").
   - Wrong-answer feedback no longer says "Multiply X by the place value multiplier" (which leaked the numeric → word translation). New text: *"Try saying the digit X together with its place name (Tens)."*
   - Hint changed from `Multiply: ${digit} ${getMultiplierLabel(place)}` (revealed the answer) to an example using a *different* digit/place: *"Say the digit name, then the place. For example, a 3 in the Hundreds place is 'Three Hundred'."*

3. **Catalog** (`manifest/catalog/math.ts`):
   - Updated tutoring `level2` scaffolding to coach word-form vocabulary instead of numeric multiplication.
   - Reworked `aiDirectives` PHASE-AWARE COACHING for Phase 2 to coach the spoken -ty / Hundred / Thousand / Tenths combinations and to forbid the AI from speaking the answer word directly.
   - Added new `commonStruggles` entry: "Picking a wrong word-form in Phase 2".

**Pedagogical outcome:** Phase 2 now tests retrieval of place-value vocabulary (the -ty form for Tens, "Hundred" for Hundreds, plural Tenths/Hundredths for decimals) rather than zero-padding. Phase 3 still requires entering the numeric digit in the chart, so numeric-value reasoning is preserved where it actually applies.

## Step 2a Audit Notes (Generator↔Component Sync)

| Rule | Result |
|------|--------|
| G1: Required fields per challenge type | PASS — `digitValueChoices` now `{value, wordForm}` pairs; both fields populated for every challenge across 4 modes. |
| G2: Nullable flat-field reconstruction | N/A — generator emits wrapper metadata only; per-challenge data built locally. |
| G3: Eval mode semantic differentiation | PASS — identify (2-digit), build (3-digit), compare (4-digit), expanded_form (5-digit). Number ranges from MODE_PROFILES enforce distinction. |
| G4: Answer derivability from visible data | PASS — Phase 2 now requires retrieving place-value vocabulary (Thirty / Three Hundred / Three Tenths). The visible "Highlighted digit: 3" + known place ("Tens") no longer mechanically yields the word-form; the student must know the spoken pattern. |
| G5: Fallback quality | PASS — outward-walk fallback in `buildDigitValueChoices` also routes through `buildDigitValueWord`, so every choice is a real word-form (no "???" or numeric-only fallbacks). |

## Visual Check

Open MathPrimitivesTester → place-value-chart → any mode → Generate → advance past Phase 1. Phase 2 button grid shows word-forms (e.g., "Three", "Three Hundred", "Thirty", "Three Tenths") at `text-xl font-semibold`, no longer giant `text-2xl font-mono` numerals. The "Highlighted digit: X" indicator is still visible on the number-display card (intentional — students verify their Phase 1 answer) but no longer leaks Phase 2 because the Phase 2 task is vocabulary retrieval, not arithmetic.
