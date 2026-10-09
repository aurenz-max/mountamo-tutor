# letter-workshop — support levers, 2026-10-09

Bound at W1 the same day (`qa/tutor-reports/letter-workshop-w1-2026-10-09.md`). Modes: `trace` (β1.5), `copy` (β3.5), `write` (β5.0).

## Failure inventory
No real-learner evidence (no demonstrations, no misconception records for this id). Synthetic: the dry sweep's backwards strokes (`start_or_order`). Documented: the catalog's `commonStruggles` (start away from the dot, against the arrow, part of the model left out, extra strokes, cue not heard) and the 09-21 judge probe (q-for-p, P-for-p, b-for-d). Inferred: the rest.

| Mode | Miss (`letterWorkshopMiss`) | Class |
|---|---|---|
| all | `start_or_order`, `stroke_count`, `part_left_out`, `extra_ink`, `direction_or_shape` | documented (struggles) / synthetic (start_or_order) |
| copy, write | `reversed`, `wrong_case`, `other_letter` (judge's reading) | documented (judge probe) |

## Lever table
| Mode | Lever | Kind | Carrier | Answers | Leak rule (code) |
|---|---|---|---|---|---|
| trace | `start_dots` | help | shown | start_or_order, stroke_count, reversed | points only (`startDotsLeak`) |
| trace | `stroke_arrows` | help | shown | direction_or_shape, start_or_order, part_left_out | the path is drawn by design |
| all | `writing_lines` | help | shown | wrong_case, extra_ink, part_left_out, direction_or_shape | letter-independent |
| copy | `model_strokes` | help | shown | stroke_count, start_or_order, direction_or_shape, part_left_out, other_letter, reversed | on the model, never the paper |
| copy, write | `start_dots` | help | shown | as trace | points only |
| write | `first_part` | help | shown | other_letter, reversed, part_left_out, direction_or_shape, start_or_order | ≤ ⅓ of the letter and ½ its first stroke, a prefix of it (`firstPartLeaks`) |
| trace / copy | `trace_part` / `copy_part` | simplify | shown | all | the first stroke or half of a one-stroke letter, never the whole (`practiceLeaks`) |
| write | `simpler_letter` | simplify | voiced | all | same case, lower complexity, never this letter, its mirror or another item's letter |

Every miss in every mode has a help lever on every item (unit test over all 52 templates × 3 modes), so the catalog lists nothing `unanswered`. Starting positions: the existing tiers (trace starts/arrows, easy/medium line labels) become the levers' starting state; no generator change.

K carrier note: every help lever is a shown change (dots, arrows, shading, a dotted part). `simpler_letter` is voiced by necessity: on write the tutor says the practice letter's name, as it says the item's.

## Built
`letterWorkshopLevers.ts` (+ `letterWorkshopLevers.test.ts`, 226 cases), `LetterWorkshop.tsx` (lever state, `pullLever`/`endPractice`, `StartMark`, practice item on the paper), `letterWorkshopWorkspace.ts` (`templateOf`, `partOf`, part-aware task), `LetterWorkshop.levers.workspace.test.tsx` (4), journey row rebuilds `~simpler` items, catalog `levers: true`, contract section. Shared: `replay_checks.said_fix` no longer reads "dot 1" / "dot number 1" as an amount (pinned in `test_replay_checks.py`).

## Gates
| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| LetterWorkshop tests (7 files: levers unit, levers workspace, workspace, component, difficulty, formation, geometry) | 442/442 |
| journeySweep + workspaceContract, -t letter-workshop (J1–J13) | 16/16; J10/J11 baselined on copy/write (localOnly, W1 report) |
| misses.test, activityContract.test, lessonWorkspacePlan.test | 229/229 |
| `test_replay_checks.py` | 48/48 |

## Replay (text, 5 samples, `replay/letter-workshop-2026-10-09-r2.json`)
Moments: copy → `model_strokes`, write → `start_dots`, trace → `trace_part` (stopped at the practice item, as designed). Before the check fix: 2/30 `no_fix_before_try`, both "put your finger on dot 1" pointing at a pulled lever's dots; rescored 0. Every narration of a change came after the pull's call (`before` empty); no reply named a write letter's shape. Tutors pulled levers themselves on `stuck` 15/15.

## No lever
None. Weakest link: `extra_ink` on trace is answered only by `writing_lines` and `trace_part`.
