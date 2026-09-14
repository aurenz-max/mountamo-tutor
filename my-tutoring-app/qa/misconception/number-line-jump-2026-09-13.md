# number-line jump: start-position contrast — 2026-09-13

Result: IMPLEMENTED, machine-verified with fictional evidence. Uncommitted. Executor `/add-misconception-loop`; verification half `/misconception-test number-line` not yet run.

A Grade 1 learner who counts the start number as the first hop now produces a saved observation, and the next jump activity on the same skill pairs a zero-anchored jump with the same hop from another start. Three repairs were needed before the loop could work.

## What was broken before

1. **A landing one hop short was graded correct.** Jump grading used `tolerance = getSnapPrecision(integer) = 1`, the same size as the snap step, so tapping 10 for 8 + 3 passed. The error this loop targets was rewarded and never recorded. Jump grading now requires the exact snapped landing (`isSnappedPlacementExact`). `plot_point` has the same defect and is queued as **NL-2** (`/eval-fix`), not changed here.
2. **No session could reach the distiller.** Challenges advance only when correct, so every submission is `success: true, score: 100`, and the shared gate (`success === false || score < 60`) never fired. Fraction-bar, bar-model and fraction-circles had the same problem. Added an opt-in, shared `DiagnosisEvidence.firstResponseScore` (percent of items right on the first try) read by the same `< 60` threshold through one helper, `isDiagnosableFailure`, used by both the client capture and the server distiller. The distiller prompt adds one line explaining first responses when the field is present. The submitted score, IRT and mastery inputs are unchanged. **Flag for the user:** this extends the PRD S2 gate. All four affected sessions agreed on it; it is reversible and inert for primitives that do not set the field.
3. **Hints named the landing (NL-3).** Across 29 real jump draws before the fix, 17 of 116 LLM hints named in-between landings ("17, 16... keep going" for 18 − 4) and 2 named the landing itself ("15, then 14." for 16 − 2). Instruction and hint text that names a position the hops pass or land on now falls back to the code template (`jumpTextNamesPosition`, digits and number words). After the fix: 0 of 72 hints and 0 of 72 instructions named a position; 12 of 72 hints used the template.

## What was built

| Station | Implementation |
|---|---|
| Capture | Every jump Check kept in `student_work.jumpResponses` (start, operation, expected and placed landings, try number, arc shown). `numberLineEvidence.ts` builds factual phases ("landing placed at 10, 2 spaces right of 8"); no error type is named in code. Evidence attaches only when a try was wrong. Catalog `misconceptionScope: 'skill'`. |
| Storage / delivery | `number-line` added to `SERVER_DELIVERED_SOURCES` (published scope stamped on write, no score/tag resolution). Shared `generateWithLearningObservations` → signed `/learning-observation-context` (owned by the fraction-bar session). `numberLineObservationScope` requests observations only for Grade 1 `OPS001-03-a` / `OPS001-04-a`, jump, medium. |
| Capability | `numberLineTeaching`, move `contrast_start_positions`. Eligibility: grade 1–2, jump, medium, no named equation or start in topic/intent. |
| Execution | One `planLearningAdaptation` call before content generation. `selectStartContrast` replaces at most one tuple with the zero-anchored twin of a neighbour (add from 0, or subtract down to 0), before instruction text is written. No zero in range → `insufficient-capacity`, baseline kept. |
| Metadata | `learningAdaptation` = move, status, comparisonCount; `source: 'saved-observation'` stamped only by the delivery server. No receipt, no resolution. |

Count 4, every other challenge, the `[1..5]` jump table, range, uniqueness, arithmetic (contract R4) and tier scaffolds hold. Contract updated: R4 grading note, new R13.

## Verification

**Deterministic** (all pass): `numberLineRemediation.test.ts`, `numberLineEvidence.test.ts` (grading, evidence facts, gate helper incl. server `shouldDistill`), `gemini-number-line.remediation.test.ts` (seeded; the targeted test fails with the selector removed — checked), `gemini-number-line.jump-text.test.ts`, `numberLineObservationServer.test.ts` (real registry path, ineligible objectives, no credentials, abstention), `NumberLine.jump-evidence.test.tsx` (mounted: a one-hop-short tap is graded wrong and submitted with `firstResponseScore: 50`; fails against the old tolerance), backend `test_number_line_observation_scope.py` (3). Existing number-line suites (grade band, reader-fit 14k, session distinctness, oracle) pass. Full frontend suite after every change **6,082 passed / 10 skipped** (`artifacts/number-line-loop-full-tests-final.log`). `typecheck:lumina` 0. Full `tsc` 771 errors, none in files this slice touched (no clean baseline: four sessions were editing the tree). Backend observation/opportunity tests 62 + 3 pass.

**Real engines** (expected outcomes fixed in `scripts/probe-number-line-applicability.mjs` before running; all draws saved under `artifacts/learning-applicability/number-line/`):

| Stage | Case | Expected | Result |
|---|---|---|---|
| Distiller | 3 of 4 first tries one short, score 100 | hypothesis | "counts the starting tick mark as the first count…", high |
| Distiller | scattered wrong landings | abstain | abstained |
| Distiller | hops the wrong way | direction hypothesis | direction hypothesis |
| Distiller | one slip (first-response 75) | gate abstains, no call | abstained at gate |
| Planner (delivered evidence) | saved start-counting; with an unrelated observation beside it; saved direction | move, move, abstain | 6/6 |
| Generator | baseline, distilled, 2 paraphrases, unrelated, plotting accuracy, direction, contradictory | 3 moves, 5 abstain | 8/8 first draw |
| Generator repeats | distilled, paraphrase, plotting, direction, contradictory ×3 | as above | 15/15 |
| Generator repeats | "lands one space past" (exploratory, no criterion) | — | abstained 3/3 |
| After NL-3 guard | same repeat set | as above | 18/18 |
| After first-response wording change (base-ten-blocks request: judged loops can end items unsolved) | full set: 4 distiller packets, 6 planner calls, 8 generation cases | as above | all as expected (`gate-wording/`) |

Compiled outputs were read, not only metadata: every targeted pair is two single jumps with the same hop and direction, one anchored at zero (0 + 2 = 2 beside 5 + 2 = 7; 3 − 3 = 0 beside 9 − 3 = 6), the zero-anchored instruction names 0, and the oracle reports no answer-key desync.

**Authenticated** (`backend/scripts/probe_number_line_authenticated.py`, run `nl-obs-qa-dbddafe9b9004531a0920984e736c843`): PASS. Signed request accepted and unsigned rejected; real distiller diagnosed a score-100 session from first responses; count-on and count-back hypotheses stored with published scope; signed delivery kept them apart by skill and refused grade 2; unauthenticated and client-forged observations left generation unadapted; two authenticated draws carried `source: saved-observation` with the compiled contrast (one targeted, one already contained it); hard tier ineligible; hypothesis unchanged; cleanup verified absent. This run predates the NL-3 guard (content path only; delivery unaffected).

## Findings and limits

- The pair occurs by chance rarely: 1 of 30 unadapted draws contained it, and 2 of 17 adapted draws were `already-targeted`. The other 15 adapted draws gained the contrast from the selector. No draw hit `insufficient-capacity`; every lesson range resolved to 0–20.
- `0 + n` does not practise counting on from the larger addend, which `OPS001-03-a` names. Counting back to 0 fits `OPS001-04-a` without that tension.
- The planner abstained on "lands one space past" 3/3. The plans.json draft had named one-past as part of this error; the capability describes one-short only, and that was not changed to force a match.
- Browser acceptance, teaching effectiveness and transfer are unverified: HUMAN-CHECKS **#159**.

## Residual (queued)

- **NL-2** `plot_point` accepts a point one tick off — `/eval-fix` (EVAL_TRACKER).
- `/misconception-test number-line` station inventory — BACKLOG item 18.
- The plot-mode variant (reads a sparse label as a tick count) would be a second move; not built.

Ratio: about 300 production lines (two new modules of 94 and 78, 65 in the generator, 23 in the component, 25 in the shared gate, single lines in hub files) under about 545 test lines, 350 probe lines and this report.
