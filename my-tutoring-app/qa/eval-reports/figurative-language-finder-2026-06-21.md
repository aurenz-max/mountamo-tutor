# Eval Report: figurative-language-finder — 2026-06-21

Step 2c (support-tier / structural-difficulty) sweep against running dev server (localhost:3000).
Topic "Figurative language in poetry", grade 5. Modes swept: sound_devices, comparison, advanced, idiom.
Each mode curled at baseline / easy / hard; hard re-run 2x per mode for distribution.

## Results

| Eval Mode     | Status | Issues |
|---------------|--------|--------|
| sound_devices | PASS   | —      |
| comparison    | PASS   | —      |
| advanced      | PASS   | —      |
| idiom         | PASS   | —      |

No CRITICAL or HIGH findings. The tier is fully wired on both axes.

## What was verified (per the 5 Step-2c checks)

**1. Scaffold withdrawal deterministic (axis 1).** Code-set fields flip exactly as
`resolveSupportStructure` declares, in ALL four modes:
- `prehighlightInstances`: baseline `undefined` / easy `true` / hard `false`
- `nameStrategyInHints`:    baseline `undefined` / easy `true` / hard `false`
- `classifyTypeChoices` (from `reduceClassifyDistractors`): reduced/near-set where the
  type band permits; `undefined` (full menu) only where reduction is degenerate (see saturation).

**2. Structural lever moves (axis 2).** `resolveProblemShape`:
- Lever A `instanceCount`: easy `3` → hard `5` in every mode (moves clearly).
- Lever B `useNearDistractors` (hard only): advanced hard → `[simile, metaphor,
  personification, hyperbole, idiom, imagery]` (6 of 8, correct + nearest confusables);
  idiom hard → `[metaphor, hyperbole, idiom]` (idiom's NEAR_TYPES). sound_devices hard
  correctly has no near-set (only 2 types exist → degenerate → full menu stands).

**3. Magnitude invariance.** Types stay inside each mode's catalog band at every tier
(sound_devices = alliteration/onomatopoeia; comparison = simile/metaphor; advanced =
personification/hyperbole/imagery; idiom = idiom). instanceCount stays within the grade-5
cap (≤6). Passage lengths comparable across tiers — harder is by shape, not bigger numbers.

**4. No answer leak at any tier.** Instance text is verbatim in the passage (offsets resolve;
0 NOT_VERBATIM across all runs). Type is never rendered until the Review phase (post-classify);
the easy `prehighlightInstances` cue is a dashed underline that does NOT mark spans found and
does NOT reveal the type. No type word appears in any generated title. `classifyTypeChoices`
always contains every correct type present (verified: advanced hard + idiom hard — ALL CORRECT
SELECTABLE = true, with ≥1 genuine distractor). Easy scaffold genuinely helps (prehighlight +
named strategy present).

**5. Null-tier no-op.** Baseline (no `&difficulty=`): `prehighlightInstances`, `nameStrategyInHints`,
`classifyTypeChoices` all `undefined`; instanceCount at grade default (4–5), not the hard target.
Pre-tier behavior unchanged.

## Honest saturation (band-driven, not a bug)

- **Hard instanceCount saturates at 5, not the targeted 6.** Grade-5 cap is 6 and the hard
  ladder target is `min(6,6)=6`, but the LLM authored 5 instances across all repeated runs.
  The generator TRIMS overproduction but never FABRICATES instances (each needs verbatim
  passage text + literal meaning + explanation), so it saturates honestly at the produced count.
  The lever still moves unambiguously (easy 3 → hard 5). Documented, correct behavior.
- **Single-/narrow-type modes skip the easy answer-form (reduced-chip) lever.** sound_devices
  (2 legal types) and idiom-easy (1 legal type) cannot reduce a chip menu below 3 without
  dropping a distractor, so `buildReducedClassifyChoices` returns `undefined` (full menu).
  advanced-easy (3 types) likewise can't reduce below its own 3-type menu. In these modes the
  easy scaffolding is carried by `prehighlightInstances` + `nameStrategyInHints` (both present),
  which is genuine help — so the easy↔hard gradient is real even where the chip-reduction lever
  is a no-op. Band-driven and correct.
