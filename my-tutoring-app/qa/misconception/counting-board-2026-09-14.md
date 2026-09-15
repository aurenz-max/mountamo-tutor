# counting-board misconception loop (take_away, add_more, count_on) — 2026-09-14

`/add-misconception-loop counting-board`. Capture repair across all ten modes, and consumers for two task
families: change-then-count (`take_away`, `add_more`) and `count_on`. Fictional evidence only; no canonical attempts.

## Scope

| Mode | Curriculum homes (K atlas) | Consistent error the board can show | Move | Status |
|---|---|---|---|---|
| take_away | COUNT001-02-E | says the count from before the take-away | `contrast_same_start_different_change` | built, verified |
| add_more | COUNT001-02-F | says the start from before adding | same move | built, verified |
| count_on | COUNT001-02-G, Grade 1 | says the start back, or says the start on the first extra object | `count_on_exactly_one_more` | built, verified |
| count | COUNT001-01-A/C, 02-A/B/D | one short or one over on scattered boards | none: arrangement is tier-owned and count is the only other lever | capture only |
| recount_moved | COUNT001-02-C | a new number after the move | none: the move is always a scatter; only the size varies | capture only |
| give_me_n | COUNT001-02-D | hands over one too many | none found | capture only |
| compare | COUNT001-03-A/B, Grade 1 | says the smaller group | blocked: the larger group is always drawn first (CNB-2) | capture only |
| group | COUNT001-01-E, 02-F | says the number of groups | none: equal-group contrasts occur by chance in 40–85% of sessions | capture only |
| subitize, subitize_perceptual | 02-G, Pre-K | — | none | capture only |

## What was broken

| Problem | Effect on the loop |
|---|---|
| Every counted board was described to the distiller as "Count N bears and say how many altogether" | A take_away board of 7 with 3 removed read "count 7, expected four"; count_on, compare and recount_moved were misdescribed the same way |
| Only corrections were recorded | Right answers never reached student work |
| A board right after one correction scores 67 | Mounted: three wrong first answers in five boards submitted `success: true, score: 80`, so the shared gate never fired |
| add_more's random change gave neighbouring boards the same start in most sessions (12 of 20 seeded draws) | The contrast would have been reported `already-targeted` and changed nothing |
| take_away's leak step-off turned 6 take away 3 into 6 take away 4 | Changes outside the 1–3 range the task describes (4 of 44 run1 draws) |

## What was built

**Capture.** `countingBoardEvidence.ts`: `countingObservation` states each board from its own fields (start and
change, covered or visible start, both compare groups) plus what was heard, handed over or tapped;
`countingBoardDiagnosisEvidence` keeps at most 12 phases (every board's first wrong attempt before later ones, emitted in
order) and sets `firstResponseScore` = boards right first time. `CountingBoard.tsx` passes the same function as
`diagnosisObservation` and `responseObservation`, so `learningResponses` in student work hold every judged attempt.
Grading and the submitted score are unchanged. Catalog `misconceptionScope: 'skill'`, `observationDelivery: 'server'`.

**Capabilities.** `countingBoardRemediation.ts`:
- `contrast_same_start_different_change`: two neighbouring boards with the same start and different changes (7 take away 1,
  then 7 take away 3; 4 put 1 more on, then 4 put 3 more on), described for both modes.
- `count_on_exactly_one_more`: one later board with one object beyond the start (five in the basket and one bear), described
  for the covered K start and the visible Grade 1 start.
- Gates `eligibleCountingBoardTeaching` (grade K or 1, one of the three modes) and `countingBoardDeliveryEligible`.
- Selectors keep count, ids, arrangement, tier options, distinct boards, spoken count_on starts, the topic bound and the
  session's largest board; the key is recomputed from start and change. Compiled rechecks read the rendered fields.

**Delivery and execution.** Catalog `learningObservations: { eligible }`; no service or backend edit. The generator runs
the planner in parallel with the board call and applies the selector after per-board validation, only when every board is
the planned mode, then re-authors the instruction and re-runs the answer-leak guard on the rewritten board. Baseline fixes
that serve the move: add_more prefers a start unlike the previous board's; take_away's step-off stays within `MAX_CHANGE`.
Contract R11 added (`docs/contracts/counting-board.md`).

## Verification

| Layer | Result |
|---|---|
| `countingBoardRemediation.test.ts` | gates; legal changes; compiled positives/negatives; selectors keep ids, other boards, largest board, askability, distinct boards; bound; already-targeted / no-focus / capacity miss return the baseline |
| `gemini-counting-board.adaptation.test.ts` | seeded take_away baseline gains the contrast; add_more and count_on in K and Grade 1, 20 seeds each, ≥ 18 targeted, oracle clean; abstain and foreign moves byte-identical; no planner call without observations, in `count`, or at Grade 2; private text absent. **2 of 4 fail with the selector removed** (the other two test abstention) |
| `CountingBoard.capture.test.tsx` | mounted on the real runner: three pre-change answers → facts per board, submitted `true / 80`, `firstResponseScore` 40, distiller and store called with skill scope; one wrong → 80, no model call; all right → no evidence, 5 learning responses |
| `countingBoardEvidence.test.ts` | 16 wrong attempts over 8 boards → 12 phases, all first tries kept, in order |
| `countingBoardObservationServer.test.ts` | real registry path with a signed packet: planner sees the evidence, output and board prompt do not; `count` mode, no packet and a forged client observation never plan; abstention claims no origin |
| Gates | `typecheck:lumina` 0; full tsc 771 vs 770 baseline, the one new diagnostic in Next's generated `.next/types/.../eval-test/route.ts` (untouched route); vitest 457 files / 6,275 tests before the take_away step-off fix; the counting-board suites (126 tests) rerun after it |

**Real engines** (`scripts/probe-counting-board-applicability.mjs`, expectations fixed before running; artifacts
`artifacts/learning-applicability/counting-board/{run1,run1-rates,run2-take,run2-rates}`):

| Stage | Result |
|---|---|
| Positive planner case per task shape (K take_away, K add_more, K count_on, Grade 1 count_on) | 4/4 |
| Distiller | 8/8 as expected, twice. Hypotheses for before-change, add-start, start said back, start counted on the first extra, one-short counting, conservation; abstained on scattered wrong numbers; the single slip (first response 80) was stopped by the gate |
| Planner with delivered-shape evidence | 20/20: before-change (alone and with an unrelated observation), add-start, start-back (K and Grade 1), start-twice → move; one-short counting on take_away and count_on, conservation, unrelated → abstain |
| Registry generation, run1 | 44/44 `pass`: take_away distilled / two paraphrases / hard / easy / Grade 1, add_more, count_on start-back / start-twice / Grade 1 / hard → targeted with compiled contrasts; unrelated, tracking, conservation, contradictory, `count`, `give_me_n` → unadapted |
| Registry generation, run2 (take_away cases after the change fix) | 23/23 `pass`; no change of 4 |
| Exploratory (take_away observation delivered to add_more and to count_on) | 4/4 abstain (no pass criterion) |
| Delivery replay, Python-signed packet, no login | packet opened at the task scope, 2/2 adapted with `source: saved-observation`, anonymous / forged / tampered / foreign-key unadapted, 0 backend calls, no private text |

**Rates.** Real baselines: 0 of 12 take_away/add_more and 0 of 2 count_on sessions already had the contrast. Simulated
over the real generator with the model call replaced (20,000 sessions each, run2):

| Mode | Model counts | Chance contrast | Capacity miss |
|---|---|---|---|
| take_away | ascending (what flash-lite returned) | 0% | 0% |
| take_away | uniform 3–10 | 26.2% | 0% |
| take_away | narrow 5–7 | 58.0% | 0.1% |
| add_more | ascending / uniform / narrow | 0% | 0–0.4% |
| count_on | K and Grade 1 | 0% | 0% |

take_away's start is the model's board size. When the model repeats neighbouring sizes, the contrast is present by chance
(or the boards would be duplicates), so narrow lessons will often report `already-targeted`.

**Failed or corrected runs, kept.** The first seeded adaptation test found add_more's contrast already present in 12 of 20
sessions; the baseline draw was changed and the threshold rerun. run1 showed take_away changes of 4 on 4 of 44 draws; the
step-off was capped and every take_away case rerun (run2). A capacity-miss unit case was wrong about which change was
legal and was replaced with a real one.

## Limits

- Transcripts in every fixture are clean number words; real ASR on a five-year-old is unmeasured here.
- `judgeFeedback` is the tutor's scripted correction line, not an explanation of the error.
- Planner selection and delivered content are not learning, transfer or resolution.

## Residual

- `/misconception-test counting-board` station inventory.
- CNB-2 compare's larger group always drawn first (`/eval-fix`, HIGH), then a compare move; CNB-3 metrics `evalMode`
  `count_all`/`group_count` vs catalog `count`/`group` (`/eval-fix`).
  **2026-09-14: both RESOLVED** ([fix report](../eval-reports/counting-board-compare-side-evalmode-2026-09-14.md)); the compare move is
  no longer blocked and is not built. New: CNB-4 (compare above the K window), CNB-5 (group_count repeats boards).
- No legal move for count, recount_moved, give_me_n, subitize, group.
- HUMAN-CHECKS #163.

Lines: production about 390 (new 270, generator +98/−41, component +17/−26, catalog 4), tests 435, probe 318.
