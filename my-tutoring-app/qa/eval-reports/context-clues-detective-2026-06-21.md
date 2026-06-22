# Eval Report: context-clues-detective — 2026-06-21

Step 2c support-tier / structural-difficulty sweep. Modes: definition, synonym_antonym, example, inference. Tiers: baseline / easy / hard. Topic "Using context clues to find word meaning", grade 4. synonym_antonym re-swept x5 + once at grade 6 to confirm saturation.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| definition | PASS | — |
| synonym_antonym | FAIL | 1 (HIGH — structural lever flat) |
| example | PASS | — |
| inference | PASS | — |

## What was verified (all modes)

- **Scaffold withdrawal deterministic (Check 1): PASS.** Code-set fields flip exactly per `resolveSupportStructure` in all 12 baseline/easy/hard responses: baseline → `showClueHints/showClueTypeDescriptions/strategyHint` all undefined; easy → `true/true/<hint set>`; hard → `false/false/undefined`. No LLM variance, deterministic.
- **Magnitude invariance (Check 3): PASS.** Passages stay 4 sentences at every tier; target vocabulary stays grade-band (ancient, fragile, luminous, perilous, exhausted, pervasive). Hard never lengthens the passage or raises word grade. No scope breach.
- **No answer leak (Check 4): PASS.** `correctMeaning` is always one of the 4 `meaningOptions` but never visually marked until after submit (`showDictionary`). Withdrawn scaffolds (clue tint, type descriptions, strategy hint) are search/how-to aids, not the answer — withdrawing them at hard does not expose it. Easy scaffolds genuinely present.
- **Null-tier no-op (Check 5): PASS.** Baseline has all scaffold fields undefined; component defaults render the clue-type descriptions ON (`!== false`), no clue tint, no strategy hint, gap at the LLM's un-tiered placement (0). Matches pre-tier behavior.

## Structural lever (Check 2) per mode

- **definition: PASS.** clueGap easy 0/0/0 → hard 2/2/1. Moves up.
- **example: PASS.** clueGap easy 0/0/0 → hard distribution 3/0/0 (one dispersed); distractor field tightens. Lever moves across the distribution.
- **inference: PASS (strongest).** Both levers move: clueGap easy 0/0/0 → hard 1/1/1, AND `clueCountTarget` synthesis breadth easy 1/1/1 → hard 3/3/3 (clueSentenceIds list 3 sentences at hard). Identity-correct.
- **synonym_antonym: FAIL — see issue below.**

## Saturation notes

- definition/example hard gap saturates partly at the grade-4 cap (passageLen returned = 4 → gapCap 2); the LLM ignores the grade-context's requested length and emits 4-sentence passages even at grade 6. Where it does disperse (definition hard 2/2, example hard 3), the lever is working; the small end is honest band saturation, not a bug.
- inference clueCount is the dominant lever for that mode and moves the full 1→3 ladder cleanly.

## Issues

### synonym_antonym — structural lever does not move easy→hard
- **Severity:** HIGH
- **What's broken:** Neither axis-2 lever produces an observable easy-vs-hard difference for synonym/antonym. `clueGap` sits at 0 (occasionally 1) at BOTH tiers across 5 grade-4 runs and again at grade 6 (LLM keeps passages at 4 sentences and co-locates the synonym/antonym clue, which is intrinsic to the clue type — dispersing it 2 sentences away would stop it being a synonym/antonym clue, which TIER_GUARDRAIL forbids). The only remaining lever, `nearDistractors` (hard-only, prompt-shaped), is not reliably reflected in output: hard distractor sets are no closer to the correct meaning than easy ones (e.g. hard "ancient" → [Very old, Very small, Very green, Very bright] is no tighter than easy "ancient" → [Very old, Very young, Very colorful, Very tall]). Net: for synonym_antonym the student's only real difference across tiers is the scaffolding withdrawal (Check 1 passes), not the problem shape.
- **Data:** `gap easy={0,0,0 / 1,1,0 / 0,0,0}` vs `gap hard={0,0,0 / 0,0,0 / 0,1,0}`; grade-6 hard also all gap 0. `nearDistractors` hard distractors not measurably closer than easy across runs.
- **Fix in:** GENERATOR (the gap lever is structurally inapplicable to co-located synonym/antonym clues; consider making `nearDistractors` the primary, schema-enforced lever for this mode — e.g. require the correct + nearest-distractor meanings to share a semantic feature — rather than relying on prompt prose, or honestly document synonym_antonym as scaffold-only on axis 2).

## Verdict

3 of 4 modes pass all five Step-2c checks. Scaffold withdrawal, magnitude invariance, no-leak, and null-tier no-op are clean across every mode. The one real finding is HIGH: synonym_antonym's structural difficulty axis is effectively flat (clue type forbids the gap lever from moving; the distractor-proximity lever is prompt-shaped and not landing). The tier is still wired (scaffolds flip), so adaptivity is not a total no-op for that mode — the problem-shape half just doesn't differentiate.
