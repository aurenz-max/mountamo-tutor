# letter-spotter find_it / match_it levers — 2026-09-28

Handoff 22 L1, primitive 3 of 5. Executor `/add-support-tiers`. Contract: `docs/contracts/letter-spotter.md` (derived this slice, R10 added).

## Failure inventory

No real-learner evidence exists for this primitive. All misses come from `letterSpotterMiss` (miss-function evidence).

| Mode | Miss | Lever |
|---|---|---|
| find_it | `same_shape_family` | `other_case_reference`, then `small_far_grid` |
| find_it | `other_letter` | `row_scan`, then `small_far_grid` |
| match_it | `mirror_form`, `same_shape_family`, `other_letter` | `wrong_choice_partner`, then `two_far_choices` |

name_it (spoken) is left for L2.

## Built

~240 production lines: `letterSpotterLevers.ts` (new), plus the lever state, render, row clock and pull wiring in `LetterSpotter.tsx`. ~190 test lines.

The user approved one swap from the draft. `formation_start` (a stroke animation, for which there is no stroke data) and `mirror_model` are replaced by `wrong_choice_partner`: the capital of each letter the learner tapped wrongly appears on that tile. It is declared only after a wrong tap, never shows the target's capital, and stays through Try again.

Every lever is visual, because shape talk is banned in the tutor's voice (R4).

## Measured

| Gate | Result |
|---|---|
| `letterSpotterLevers.test.ts` + `LetterSpotter.levers.workspace.test.tsx` | 16 pass |
| All literacy tests | 85 files, 1787 pass |
| Dry journey, all payloads | 340/340. New payload `letter-spotter.match_it.json` (hand-authored, group 3), because no match_it payload existed. |
| `typecheck:lumina` | 0 |
| Tutor replay, 5 samples (`qa/tutor-reports/replay/letter-spotter-2026-09-28.json`) | At "stuck" the tutor pulled the lever itself in 5/5 samples on find_it (`row_scan`) and 5/5 on match_it (`wrong_choice_partner`), and described the change after the call. match_it: 0 misses on every check. find_it's flags are checker false positives (below). |

## Found, queued in `SUPPORT_LEVERS_BRIEF.md`

- **name_it states the answer.** At "stuck" the tutor says the onset sound ("/s/ ... what letter is that?") in 4 of 5 samples. The sound counts as the answer on this mode. Queued for L2 (`/add-live-tutor-tools`).
- **Checker false positive.** `replay_checks` reads find_it's key (cell index 1) in "one line at a time".
- **Contract C1 is still open.** The easy/medium `showTargetReference` shows the target in the grid's own case, which turns the task into glyph matching.
