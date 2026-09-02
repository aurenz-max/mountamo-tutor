# Birth Certificate — formula-lab (2026-08-23)

**Lifecycle layer: L0 (born)** — pedagogically sound, measurable, single core mode, generic tutor.

- Core task identity: `predict-and-test`
- Generator fork: Fork A hybrid wrapper + local pool. Gemini authors one validated session formula; local code builds five numeric experiments and recomputes every answer.
- `sendText` tags wired: `[ACTIVITY_START]`, `[PREDICTION_LOCKED]`, `[ANSWER_CORRECT]`, `[ANSWER_INCORRECT]`, `[NEXT_ITEM]`, `[ALL_COMPLETE]`
- Answer-leak audit: before prediction lock, the scene labels the output hidden and the numeric output is `?`; before target reach, the observed-direction marker, expected output, and correct direction are absent. Post-test feedback may show the observed output transition.
- Design gate:
  - Direct manipulation — pass: the student places a prediction on a continuous output track, then moves the changed quantity to its target while other inputs stay fixed.
  - Living simulation — pass: component-owned arithmetic synchronizes the semantic scene, variable control, formula context, and output readout.
  - Production over recognition — pass: the student produces a signed prediction on a continuum instead of choosing an MCQ option.
  - No visible timer — pass: the UI contains no countdown or ticking clock; elapsed time is captured silently by evaluation.
  - No answer-leak by layout — pass: the output/result layers are gated until after the student commits and tests.
- Curriculum home: MATCH — Grade 5 `MEAS005-04` “Volume Formulas” (cosine 0.7572, coherence 3/5). Target Grades 6-12 could not be probed because the live mathematics curriculum currently publishes only Kindergarten through Grade 5; rerun after upper-grade publication.

## Follow-up queue

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 1 | `/add-eval-modes` | L1 eval-dense | Ladder candidates: `free-explore` (observe without a committed prediction), `predict-direction` (current core), `predict-magnitude` (score the prediction marker's distance), `construct-formula` (assemble variables/operators from the living system), and `transfer-apply` (new context with the live output withheld). |
| 2 | `/add-tutoring-scaffold` | L2 tutored | Context candidates: `formula`, `outputName`, `changedVariable`, `currentChallengeIndex`, `totalChallenges`, `predictionLocked`, `predictionDirection`, `currentInputValue`, `targetInputValue`, `challengeComplete`. Struggle candidates: reads every relationship as direct, overlooks denominator/exponent, predicts after moving instead of before, or focuses on arithmetic without holding other variables fixed. Live QA surfaced no generator-contract struggles. |
| 3 | `/add-support-tiers` | L3 tiered | Withdrawable scaffolds: variable-role hint, color-linked variable badges, post-lock numeric output readout, target-value badge, and prediction-strength guidance. Keep the manipulable scene and prediction-before-test sequence at every tier. |
| 4 | `/add-structural-difficulty` | L4 shaped | Requires L3. Progress from two-input direct multiplication to inverse/division, squared effects, then three-input mixed relationships with wider ranges and less symmetric values. |
| 5 | `/add-sound` | L5 polished | Candidate points: prediction lock, target reached/observation reveal, next experiment, and session completion. Slider dragging should remain silent. |
| ✓ | `/eval-test formula-lab` | QA loop | Run after every layer (`/eval-fix` for findings). At L0, pass `evalMode=predict-and-test`; the bare route returns the catalog until L1 adds catalog `evalModes`. |

