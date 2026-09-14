# area-model: same-fact and equal-area contrasts — 2026-09-13

Result: IMPLEMENTED, machine-verified with fictional evidence. Uncommitted. Executor `/add-misconception-loop area-model`; verification half `/misconception-test area-model` not yet run.

A learner who writes 30 × 40 as 120 now produces a saved observation, and the next grid activity on the same skill contains a model whose largest and smallest cells use the same fact at different place values (23 × 32: 20 × 30 = 600 beside 3 × 2 = 6). A learner who multiplies the sides for a perimeter gets two consecutive rectangles with the same area and different perimeters (24 by 6 and 18 by 8: both 144, perimeters 60 and 52).

## What was broken before

1. **No evidence.** `AreaModel.tsx` recorded no responses and submitted no `DiagnosisEvidence`, so capture could never run.
2. **The score hides the error.** Entries retry until correct, and a model with one wrong cell of four scores 100 (`phaseScore(Math.round(5/4))`), so the tens × tens slip is invisible to `success`, score and `firstTryCount`. Reproduced in `AreaModel.capture.test.tsx`. The evidence carries its own `firstResponseScore` (models with no wrong entry) for the shared gate; the submitted score is unchanged and queued as **AM-3**.

## What was built

| Station | Implementation |
|---|---|
| Capture | Every checked cell, sum, perimeter and dimensions entry is kept (`student_work.responses`). `areaModelEvidence.ts` builds factual phases — "Area model (20 + 5) × (30 + 6): the cell in column 20 and row 30", "Incorrect: entered 60", with the on-screen scaffold and try number — at most 12, wrong entries first. No error type is named in code. Catalog `misconceptionScope: 'skill'`, `observationDelivery: 'server'`. |
| Delivery | Catalog `learningObservations: { eligible: areaModelDeliveryEligible }` (build_model, find_area, multiply, perimeter). No service edit. |
| Capabilities | `areaModelGridTeaching` → `contrast_same_fact_across_places`; `areaModelPerimeterTeaching` → `contrast_equal_area_perimeters`. The pinned mode picks the capability. Generator gate: grades 3-5, those four modes, any tier. `factor` is excluded: its answer is not unique (**AM-4**). |
| Execution | One `planLearningAdaptation` call in parallel with the number-free wrapper call. Grid: `selectSameFactContrast` replaces the second model's factors with a pair from the mode's full legal operand list (`OPERAND_BOUNDS`, now shared with the random pickers). Perimeter: `selectEqualAreaContrast` reorders an existing equal-area pair, else replaces the neighbour of one rectangle. Both run before tier flags are applied. |
| Metadata | `learningAdaptation` = move, status, comparisonCount; `source: 'saved-observation'` stamped only by the delivery server. No receipt, no resolution. |

Held: item count per mode, grid shape and operand windows, uniqueness by unordered totals, support flags, wrapper text. The component derives every answer from the parts, so no key can desync; the oracle was run on every draw.

## Verification

**Deterministic** (all pass): `areaModelRemediation.test.ts` (7), `gemini-area-model.adaptation.test.ts` (6; seeded causal change — 4 fail with the selector removed, checked), `AreaModel.capture.test.tsx` (2, mounted), `areaModelEvidence.test.ts` (1, 12-phase cap), `areaModelObservationServer.test.ts` (2, real registry path: scope body, private text, factor mode and anonymous requests never read, abstention claims no origin). Existing area-model oracle and catalog dispatch suites pass. Full frontend suite **6,168 passed / 10 skipped, 0 failed** (`artifacts/learning-applicability/area-model/full-tests.log`, taken before the last capability-text edit; the eight focused suites, 37 tests, and `typecheck:lumina` were rerun after it). `typecheck:lumina` 0; full `tsc` 771, unchanged from the 09-13 baseline and none in touched files.

**Real engines** (`scripts/probe-area-model-applicability.mjs`; expected outcomes fixed in the script before running; every draw under `artifacts/learning-applicability/area-model/`):

Final run `final2/`, after both repairs below:

| Stage | Case | Expected | Result |
|---|---|---|---|
| Distiller | tens × tens cells with one zero missing in 4 of 5 models, score 100 | hypothesis | "…multiplying two multiples of ten requires appending only one trailing zero…" |
| Distiller | 4 of 5 perimeters entered as length × width | hypothesis | "…multiplying the two given side lengths together rather than adding…" |
| Distiller | four unrelated slips (added cell, sum, two facts) | abstain | abstained |
| Distiller | one wrong cell in 5 models (first-response 80) | gate abstains, no call | abstained at gate |
| Planner (delivered evidence) | zeros on grid; zeros + unrelated; zeros on perimeter; area on perimeter; area on grid | move, move, abstain, move, abstain | 10/10 |
| Generation, grid | distilled ×2, two paraphrases ×2 each, hard tier, multiply, build_model | move | 9/9 (8 targeted, 1 already-targeted) |
| Generation, grid | baseline, unrelated ×2, left-out partial product ×2, fact recall ×2, contradictory ×2, perimeter observation ×2, factor mode | no adaptation | 11/12; the 12th (fact recall #1) was a Gemini 503 on the wrapper call, no content |
| Generation, perimeter | distilled ×2, paraphrase ×2, hard tier | move | 5/5 targeted |
| Generation, perimeter | half-perimeter ×2, zeros observation ×2, contradictory | no adaptation | 5/5 |
| Exploratory | "gives the bare digit for its worth regardless of position" ×3 | no criterion | grid move 3/3 |

Compiled outputs were read, not only metadata. Grid targets: 44 × 33 (40 × 30 = 1200, 4 × 3 = 12), 23 × 32, 42 × 24, 22 × 33, 34 × 43, 312 × 23 (300 × 20 = 6000, 2 × 3 = 6), 5 × 22 (100 and 10). Perimeter pairs: 18 by 20 and 30 by 12 (360; 76 and 84), 8 by 14 and 16 by 7 (112; 44 and 46), 13 by 16 and 8 by 26 (208; 58 and 68), 20 by 15 and 25 by 12 (300; 70 and 74), 7 by 20 and 5 by 28 (140; 54 and 66). Oracle `answer-key-desync` and `schema` clean on every draw.

Earlier runs, same fixtures: `registry/` (before the capability repair) distiller 4/4, planner 10/10, generation 31/31, 14 targeted; `final/` 28/31 plus a 20-draw repeat, failures below.

**Authenticated** (`backend/scripts/probe_area_model_authenticated.py`): **PASS**, run `am-http-qa-ccd668ba023144b9aaa2ca29e074cc8c`, cleanup verified absent. Real Firebase user and distiller (hypothesis from first-response 20 on a success, score-100 activity); authenticated capture stored an active hypothesis with published scope Grade 4 `NBT004-06-d`; unsigned learner token rejected (403, invalid signature); signed delivery returned exactly that observation without attempt IDs; unauthenticated and client-forged (`learningObservations` + `remediationFocus` in config) generations unadapted; authenticated factor mode unadapted; two authenticated find_area draws carried `source: saved-observation`, both `targeted`, five 2 × 2 models each, no private text; hypothesis still active, no receipt. The same probe also passed before the capability repair (`am-http-qa-034363aa…`).

## Failures kept and what they showed

1. **Run 1 (`run1-eval-test-tap-stripped/`): every positive generation came back unadapted.** The probe used the eval-test `?remediationFocus=` tap, which `generateWithLearningObservations` strips from every declared consumer since the 09-13 hardening. Harness, not planner: the direct planner stage in the same run was 10/10. Stage G now calls the registry generator with `config.learningObservations`, as the consumer branch does after signed delivery. `probe-bar-model-applicability.mjs` still uses the tap.
2. **Authenticated run 1 (`am-http-qa-386d4595…`): store returned 422.** The evidence emitted up to 16 phases; the store accepts 12. Production capture trims with `slice(-12)`, so live captures would have stored, but without the first models' errors. The builder now emits at most 12, wrong entries first.
3. **Run `final`: grid-build-model abstained, and 0/4 on repeat with a corrected one-digit objective.** A diagnostic (`build-model-diagnostic/`) showed the task caused it: in build_model even the text that selected 4/4 in find_area abstained 3/3. The move was described only through two-digit × two-digit factors, which is wrong for a one-digit factor. The capability now states that a one-digit factor is both its first and last part (7 × 22: 140 and 14). After: 3/3, 3/3, 3/3 on the three affected cases; a tens × tens observation still abstains 3/3 in build_model, which has no tens × tens cell. Everything was rerun as `final2`.
4. **Run `final`: perimeter-hard-tier abstained once;** 4/4 on repeat (1 of 6 draws at that point).
5. **Run `final`: perimeter-distilled draw 0 was `insufficient-capacity`.** Right move, but all five areas (35, 117, 384, 91, 338) had one side pair within 5-30. A 20,000-session simulation of the picker and selector: 94.0% targeted, 0.9% already paired, 5.1% no legal partner. Kept as a bounded outcome; the move was not widened to two rectangles.

## Findings and limits

- **Yield.** Every adapted grid draw was `targeted`, none `already-targeted`: the corner-cell fact rarely occurs by chance, so the move changes content.
- **Cross-representation.** "Gives the bare digit for its worth regardless of its position" (a place-value-chart style observation) selected the grid move 3/3 in every run (exploratory, no criterion). Delivery is skill-scoped, so a NBT004-01 chart observation never reaches a NBT004-06 area-model lesson.
- **Curriculum fit, not changed here.** Grade 3 `NBT003-05-c` (one-digit × multiples of ten) and Grade 4 `NBT004-06-a/b` (two- and three-digit × one-digit) point at area-model, but build_model draws 11-25 and no mode multiplies three digits by one.
- Browser acceptance, teaching effectiveness and transfer are unverified: HUMAN-CHECKS **#160**.

## Residual (queued)

- **AM-3** score 100 with a wrong cell, **AM-4** factor answers not unique, **AM-5** build_model draws 1 × 1 models (`/eval-fix`, EVAL_TRACKER).
- `/misconception-test area-model` station inventory; factor mode records evidence but has no move (blocked on AM-4) — BACKLOG item 18.
- `/topic-fidelity area-model` for the one-digit-factor curriculum homes above — BACKLOG item 18.

Ratio: about 350 production lines (remediation 160, evidence 83, generator +78/−20, component +27, catalog +4) under 332 test lines, 426 probe lines and this report.
