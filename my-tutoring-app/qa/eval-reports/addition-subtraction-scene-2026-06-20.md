# Eval Report: addition-subtraction-scene — 2026-06-20

Scope: support-tier difficulty sweep of the **build_equation** eval mode (Step 2c).
Generator now reads `config.difficulty` (two axes: scaffold tilePalette + AXIS-2
storyType ladder). Baseline / easy / medium / hard each generated.

> Note: the request named mode `build-equation?` (hyphen) — that is the *challenge
> type*, not a catalog eval-mode ID. The catalog ID is **`build_equation`** (underscore).
> Curling the hyphen form returns `catalogMeta: null` and generates unconstrained
> (all 4 challenge types mixed). All results below use the correct `build_equation` ID.

## Results

| Eval Mode | Tier | Status | Issues |
|-----------|------|--------|--------|
| build_equation | baseline (no tier) | PASS | — |
| build_equation | easy | PASS | — |
| build_equation | medium | PASS | ~~1 CRITICAL~~ FIXED 2026-06-20 |
| build_equation | hard | PASS | — |

Tier mechanics verified working:
- **Scaffold withdrawal (AXIS 1, code-set):** easy → `allowedTiles` = exact 3 story
  numbers; medium → exact + up to 3 distractors; hard → field absent (full palette).
  Flips deterministically as `resolveSupportStructure` declares.
- **Structural lever (AXIS 2, schema-enum):** easy → storyType ∈ {join, separate};
  medium → part-whole; hard → compare. Enum-constrained, observed exactly.
- **Magnitude invariance:** all counts ≤ maxNumber (10) at every tier; hard is
  structurally harder (compare), not bigger numbers. ✓
- **No answer leak / null-tier no-op:** hard instructions never state the result;
  baseline emits no `allowedTiles`, mixed storyTypes, scaffolds default ON. ✓

## Issues

### medium — part-whole missing-addend desyncs the equation from the story  — ✅ FIXED 2026-06-20
- **Severity:** CRITICAL — **RESOLVED**
- **Root cause (refined):** Two coupled faults. (1) The schema constrained only the
  storyType *label* to `part-whole`, leaving the forward/missing-addend shape
  ambiguous. (2) The real corruptor was the **post-process tier block** (`build-equation`
  AXIS-2 loop): it *force-overrode* `operation` from the storyType label
  (`part-whole → addition`) and recomputed `result = start + change`. When the LLM
  authored a self-consistent take-away story (`9 baked, ate 4 → 9 − 4 = 5`), the
  override clobbered it into `9 + 4 = 13`, desyncing the equation from the story and
  overflowing maxNumber.
- **Fix (schema-led, per directive "the schema must do this, not post-process"):**
  1. **Schema:** `resolveProblemShape` now pins `unknownPosition='result'` for
     build-equation (all tiers) via the existing `constrainStructuralEnums` — enum +
     required + parts→whole description. build-equation is intrinsically forward (the
     student builds the whole sentence; the result IS the answer), so this disambiguates
     part-whole away from missing-addend by construction. The medium prompt line also now
     explicitly forbids "how many are LEFT / the REST" missing-addend phrasing.
  2. **Removed the post-process operation override.** The tier block now TRUSTS the LLM's
     schema-constrained, self-authored `operation` and only keeps the arithmetic
     self-consistent for THAT operation (recompute result, rebuild equation, build tiles).
     No more re-deriving operation from the forced label.
- **Verification:** all 4 tiers PASS; 0/13 desync-or-overflow across 3 stochastic medium
  runs. Take-away stories at medium now render as correct subtraction (`8 − 3 = 5`,
  `9 − 5 = 4`); magnitude back within maxNumber. tsc unchanged (1419, baseline).
- **Residual (non-blocking):** the LLM still occasionally writes a take-away story under
  the `part-whole` label at medium — now harmless (operation follows the story, answer is
  correct), but a minor *difficulty-fidelity* gap (a take-away shape is easy-tier
  structurally). Prompt now discourages it; correctness is guaranteed regardless.

<details><summary>Original issue (archived)</summary>

- **Severity:** CRITICAL
- **What's broken:** The medium tier forces `storyType = part-whole` via the schema
  enum, but does not constrain part-whole to the *two-parts-combine* shape. The LLM is
  free to author a **missing-addend** part-whole ("whole given, one part given, find the
  other part"). The post-process unconditionally recomputes `resultCount = startCount +
  changeCount` and rebuilds the equation from it, producing an equation that contradicts
  the story. The component (`handleCheckEquation`) then requires the student to build
  exactly `startCount op changeCount = resultCount` — so a student who reads the story
  correctly is marked wrong, and the accepted answer is false relative to the story.
- **Data:** ch3 — storyText `"There are 8 bunnies in the field. 5 are eating grass and
  the rest are hopping. How many are hopping?"` → generated `startCount:8, changeCount:5,
  resultCount:13, operation:"addition", equation:"8 + 2 → 8 + 5 = 13"`. Story total is 8
  and the answer is 3 (8−5); the accepted equation `8 + 5 = 13` invents 13 bunnies.
  Other 3 medium challenges (genuine two-part part-whole, e.g. `3 yellow + 2 pink = 5`)
  are correct — so ~1-in-4 medium challenges hit this.
- **Fix in:** GENERATOR (`gemini-addition-subtraction-scene.ts`). Options: (a) constrain
  the medium part-whole prompt/schema to the *two-parts-combine, find-the-whole* form
  only (forbid "the rest / how many are left / how many more came" missing-addend
  phrasing); or (b) detect the missing-addend case (the stated total = max of the three
  numbers) and treat the unknown as the missing part instead of forcing
  `result = start + change`. compare (hard) and join/separate (easy) are unaffected
  because their forward arithmetic always matches the story.

</details>

## Visual check

Open MathPrimitivesTester → **addition-subtraction-scene** → **Build Equation (Scaffold
2)** → **Structural Tier = Med**, Generate, and confirm any part-whole challenge phrased
as "…the rest…/how many are left/how many more came" — the equation tray's accepted
answer will not match the story total. easy/hard tiers render correctly.
