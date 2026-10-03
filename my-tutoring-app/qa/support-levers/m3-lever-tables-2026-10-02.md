# M3 lever tables, 2026-10-02

Handoff 30. Order changed by the user on 10-02: **strategy-picker skipped** (the user doubts its pedagogy), so the class starts with math-fact-fluency.

## math-fact-fluency: DONE, all 5 modes (4 levered, speed_round ruled out)

Contract: `docs/contracts/math-fact-fluency.md` (new; R6-R8 are the levers). Code: `mathFactFluencyLevers.ts`, `MathFactFluency.tsx`; tests `mathFactFluencyLevers.test.ts` (44), `MathFactFluency.levers.workspace.test.tsx` (8).

**Evidence.** No real-learner evidence. Misses come from `mathFactMiss` (observed-synthetic: harness wrong answers on saved payloads), plus the catalog's documented struggles (subtraction facts, missing-number problems). No demonstrations and no remediation module exist for this primitive.

**Dead field found.** The generator's `showVisualAids` is never read by the component, so bare equations had no picture path at runtime. `fact_dots` now provides one.

| Mode (β) | Miss | Lever | Kind | On screen | Leak rule |
|---|---|---|---|---|---|
| visual_fact (1.5) | `printed_number`, `other_operation` | `two_parts` | help | picture redrawn as the fact's two parts in two colours; dots taken away are crossed out | no numeral; total never written |
| | `one_short`, `one_over` | `count_marks` | help | each dot is a tap target that stamps its running count | only tapped dots are numbered |
| | by-more | `smaller_fact` | simplify | ungraded fact with the same type, operation and blank, second number 1 | not the learner's fact or its answer |
| match (2.5), picture → equation | all | `count_marks` | help | as above | never splits the picture into the fact's parts |
| match, equation → picture | all | `fact_dots` | help | dots under the printed fact | nothing for the "?" |
| match | by-more | `far_match` | simplify | ungraded 2-choice match, totals ≥3 apart, different fact | as above |
| equation_solve (3.5) | all | `fact_dots` | help | as above | as above |
| | by-more | `smaller_fact` | simplify | as above | as above |
| missing_number (4.5) | all | `part_whole` | help | known part shaded, missing part hollow and unnumbered | no numeral on the missing part |
| | by-more | `smaller_fact` | simplify | blank of 1 or 2, same form | as above |
| speed_round (5.5) | all | **none, ruled out** (user 10-02) | | | aid-free recall: a picture makes it equation_solve, and recall has no step to make simpler |

Fingers pictures get no dot lever (the emoji hands cannot be tapped or split); `smaller_fact` still applies there. Starting positions: easy starts the mode's first help lever on screen, which is not recorded as a pull; medium and hard start with all levers released.

**Gate (vitest, per handoff 30):** miss → lever `it.each` table; leak rules on every saved payload (no digit in any lever text or scene fact); builder sweep over every fact within 5/10/20 in every form (more than 1000 simpler items: same mode, answer recomputed, options hold the answer exactly once, never the source fact or its answer); mounted pull (DOM changes with `data-lever`, the next attempt carries the lever, a refused pull is blocked, simplify is ungraded, stays on Try again, returns to the full item, and only the unaided answer is credited); journey sweep: all math-fact-fluency rows green, J9 included; `typecheck:lumina` 0; tsc 771 (baseline 771). Two sweep rows fail in di-math-facts: another session's uncommitted di-math-facts lever work, not this slice.

**Not verified:** how the dots look in a browser (HUMAN-CHECKS row).

## Next in M3

math-fact-fluency → addition-subtraction-scene → equation-builder → bar-model. strategy-picker stays unlevered unless the user reopens it.
