# Eval Report: text-structure-analyzer — 2026-06-21

Step 2c support-tier / structural-difficulty sweep against the running dev server
(localhost:3000). Modes swept: chronological_description, cause_effect,
compare_contrast, problem_solution. baseline / easy / hard each.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| chronological_description | PASS (tier) | — (1 pre-tier leak, see below) |
| cause_effect              | PASS (tier) | — (1 pre-tier leak, see below) |
| compare_contrast          | PASS (tier) | — (1 pre-tier leak, see below) |
| problem_solution          | PASS (tier) | — (1 pre-tier leak, see below) |

**Tier verdict: the structural-difficulty work is correctly wired on all four modes.**
The one CRITICAL below is a pre-existing component leak present at baseline (not
introduced by the tier work) — the tier axis itself passes all five Step-2c checks.

### Per-mode Step-2c assertions (all four modes)

1. **Scaffold withdrawal deterministic — PASS.** Every mode flips exactly per
   `resolveSupportStructure`: easy → `prehighlight=true, nameStrategy=true,
   maxStructureOptions=2, anchorIdeaId=set`; hard → `prehighlight=false,
   nameStrategy=false, maxStructureOptions=undefined(full set), anchorIdeaId=undefined`.
   Code-set, no LLM variance observed across runs.

2. **Structural lever moves (distractor confusability) — PASS.** The axis-2 lever
   (near-distractor ordering at the Identify step) moves easy→hard exactly per
   `resolveProblemShape` + `buildDistractorOrder`:
   - chronological_description: easy options `[chronological, +far cause-effect]`
     (trimmed to 2); hard leads with the near sibling `description`. nearTarget
     saturates at 1 (chronological has only 1 near sibling — band-driven, correct).
   - cause_effect: easy → correct + FAR `chronological`; hard leads with the two
     near siblings `[problem-solution, compare-contrast]` (the d=1 / d=2 confusables).
   - compare_contrast: easy → correct + FAR `chronological`; hard fills with the
     three near siblings `[description, cause-effect, problem-solution]` (all d=2).
   - problem_solution: easy → correct + FAR `chronological`; hard leads with
     `cause-effect` (d=1, the exact "both this-leads-to-that" pair the prompt cites).

3. **Magnitude invariance — PASS.** passageLen, signalWord count (4-6), and
   keyIdea count (4-6) stay inside the grade-4 band at every tier. Hard is often
   SHORTER, not bigger (e.g. cause_effect hard passageLen=345 vs easy=442). No
   magnitude inflation; nothing crosses the scope ceiling. The only thing that
   reshapes is the distractor SET, as intended.

4. **No tier-introduced answer leak — PASS.** The easy worked-anchor pre-places
   exactly ONE key idea via `anchorIdeaId`; the answer key (`correctRegionId`) is
   byte-identical across tiers, and the correct structure option is always retained
   in the option set. The easy scaffolds (fewer options + a far distractor +
   pre-highlight + strategy naming) genuinely help; hard withdraws all. The tier
   axis exposes nothing. (See CRITICAL below for a SEPARATE pre-tier leak.)

5. **Null-tier no-op — PASS.** Baseline (no `&difficulty=`) returns
   `supportTier=undefined`, all scaffold fields undefined, full option set, lever at
   un-tiered default. Component defaults `nameStrategy` ON and shows all options —
   pre-tier behavior unchanged.

### Honest saturation (confirmed, not a bug)

chronological's `nearDistractorTarget` saturates at **1** at hard because, in the
grade-4 band, chronological has only one near (distance ≤ 2) sibling: `description`
(d=2); cause-effect/problem-solution/compare-contrast are all far (d=3). The clamp
`min(nearWanted, nearAvailable, distractorCount)` correctly caps at the real band
ceiling rather than inflating. This matches `STRUCTURE_DISTANCE` exactly. The other
three modes (relational structures) have 2-3 near siblings and show the fuller near
ladder at hard. No higher-grade re-sweep needed — saturation is structure-intrinsic,
not grade-limited (grades 4-6 share the same 5-structure band).

## Issues

### chronological_description, cause_effect, compare_contrast, problem_solution — structureType shown in header at ALL tiers
- **Severity:** CRITICAL
- **What's broken:** The component header renders the correct answer unconditionally
  (`<LuminaBadge>{structureType.replace('-', ' ')}</LuminaBadge>`,
  TextStructureAnalyzer.tsx:536-538). Phase 2 (Identify) asks the student to choose
  the organizational structure, but that exact answer ("chronological", "cause
  effect", etc.) is visible in the header badge before and during the Identify step.
  This defeats the primary assessment at every tier — including hard, where every
  scaffold is supposedly withdrawn.
- **Data:** baseline/easy/hard all render `structureType` in the header
  (e.g. `cause_effect` hard → header badge reads "cause effect" while Phase 2 asks
  the student to pick it from the full option set).
- **NOT a tier regression:** this leak is present at the un-tiered baseline too, so
  it is pre-existing component behavior, NOT introduced by the structural-difficulty
  work. The tier axis is correctly wired (all five Step-2c checks pass above). Flagging
  it because it is a genuine answer leak the sweep surfaced.
- **Fix in:** COMPONENT (gate the structureType badge so it only renders after the
  student commits in Phase 2 / in the review phase, or remove it from the pre-answer
  header).
