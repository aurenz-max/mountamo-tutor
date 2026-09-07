# Requirements and supported config binding: exploratory follow-up

The follow-up produced 7/10 provisional common-objective coverage passes, versus 3/10 in the historical flat-pair pilot. Ten fresh lessons used the same five frozen kindergarten curriculum objectives and briefs, two repetitions each. This is not a new randomized A/B: retrieval, requirements presentation, capability notes and config binding changed together. No production generator or coverage-scorer source was changed.

| Objective | Prior flat-pair passes | Follow-up passes |
|---|---:|---:|
| Name ordinal positions first–fifth | 0/2 | 2/2 |
| Extend ordinal positions sixth–tenth | 0/2 | 0/2 |
| Represent 16–19 as ten and extra ones | 0/2 | 2/2 |
| Decompose 16–19 with visual models | 1/2 | 2/2 |
| Compose/decompose 11–19 with equations | 2/2 | 1/2 |

Median planning was 4.44 seconds, compared with 3.57 seconds including index work in the previous flat-pair run. Median full generation was 13.09 seconds, versus 13.30 seconds previously. Median planning input was 10,658 tokens, versus 9,898 previously. The follow-up still used one manifest model call, plus embedding retrieval; the coverage calls are evaluation overhead. These small-sample historical timings are not service-level guarantees.

## What changed

- Retrieve primitive families through protected semantic matches plus lexical/fused complements; retain all modes within the selected families. Render shared family metadata once. The separate [22-query retrieval probe](../retrieval-bench/REVIEW.md) found a mode-recall improvement but no overall family-recall improvement.
- Supply the existing fixture's explicit learner-evidence requirements. Ask each selected component to state its assigned requirements and actual learner action. These requirements were previously authored for the tester; no new runtime objective-decomposition model was introduced.
- Include source-grounded capability notes about ordinal response forms, the kindergarten ordinal cap, single ten-frame limits, base-ten task behavior, and the observed knowledge-check mismatch.
- Compile explicit whole-number ranges into the **existing** `base-ten-blocks` `config.numberRange` field. For this range parser, unmatched or ambiguous scope stays unknown. Ordinal ranges are kept distinct from whole-number ranges; parts and operands are not treated as target wholes.
- Inspect generated target fields without rewriting payloads, hiding failed blocks, adding automatic retries, or changing the judge. Missing target fields remain unknown.

All 28 inspected base-ten targets were within the objective's range. This is a bounded target-field check, not a claim that all primitive data or assessment semantics are valid. All ten lessons generated their planned blocks successfully. One raw coverage call failed; all ten separate common-objective evaluations completed. Recorded source hashes were unchanged during the run.

## Actual selected streams

- **Ordinal naming, repeat 1:** feature-exhibit → ordinal-line/identify → ordinal-line/sequence_story → knowledge-check/recall. Repeat 2 used identify → sequence_story → build_sequence → knowledge-check/recall. Both now included the ordinal-word response mode and passed provisionally.
- **Ordinal sixth–tenth:** feature-exhibit → take-home-activity or flashcard-deck → knowledge-check/apply. Both plans explicitly reported the missing K capability; neither selected an ordinal-line activity capped at fifth as a purported solution. A reported gap remains a failed objective, not a pass.
- **Represent 16–19:** base-ten-blocks/build_number → take-home-activity → knowledge-check/apply; repeat 2 also included digital-skills-sim/drag. Both base-ten builders included all four target values. The extra drag activity and caregiver reliance still need holistic human review; a coverage pass does not certify lesson composition.
- **Decompose 16–19:** how-it-works/guided → base-ten-blocks/build_number → comparison-panel → knowledge-check/analyze; repeat 2 used read_blocks plus build_number. Both passed. The judge credits standard-form construction as decomposition evidence; the stricter fixture language about partitioning a shown whole still deserves human assessment.
- **Equations, repeat 1:** base-ten-blocks/build_number → equation-builder/build-simple → math-fact-fluency/match → knowledge-check/apply, provisional pass. Repeat 2 selected base-ten-blocks/read_blocks → balance-scale/equality → equation-builder/balance-both-sides → knowledge-check/apply and was insufficient. Retaining all modes restored the appropriate candidate but did not ensure its selection.

## What this supports

Explicit evidence requirements and existing typed config are productive next steps. The remaining defects are not all embedding problems: runtime capabilities, mode selection, lesson composition and generated evidence each need distinct checks. A calibrated evaluation set should measure those stages separately and include partial, incompatible and unknown cases.

The proposed exemplar pipeline is a next experiment, not part of this run. Ground exemplars in verified task behavior and grade conditions; retain descriptions as another retrieval view. Preserve many-to-many requirement coverage and evaluate positive/partial/no-match relationships rather than reducing primitive modes to Bloom's verbs. Retrieval/chooser agreement and self-reported confidence are features to calibrate, not sufficient conditions for auto-acceptance.

## Artifacts and reproduction

[Metrics](family-evidence-v2/metrics.json), [per-run streams and verdicts](family-evidence-v2/summary.json), [full protocol](family-evidence-v2/protocol.json), and [packages for human playback](family-evidence-v2/BLIND-REVIEW.md). No human ratings have been collected.

From the app directory, use a fresh output path for a fresh run:

```powershell
node --test scripts/lib/lesson-planner-family-search.test.mjs scripts/lib/lesson-planner-requirements.test.mjs
node scripts/lesson-planner-requirements-ab.mjs --run --out qa/lesson-planner/requirements-ab/<fresh-run>
node scripts/lesson-planner-common-objective-eval.mjs qa/lesson-planner/requirements-ab/<fresh-run>
```

Eight focused tests passed for retrieval selection, fusion, lexical scoring, requirement/range compilation, target inspection and grouped task identity. Prior task-binding tests also remain applicable. Keep the unresolved cases in the denominator and assess new objectives before claiming generalization.
