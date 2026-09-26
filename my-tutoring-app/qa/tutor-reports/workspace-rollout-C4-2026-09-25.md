# Workspace rollout C4: addition-subtraction-scene, 3d-shape-explorer, calendar-explorer, push-pull-arena (2026-09-25)

Queue: [`qa/workspace-rollout/ROLLOUT.md`](../workspace-rollout/ROLLOUT.md) row C4. Executor: `/add-live-tutor-tools`.

## What shipped

All four K math and science families now run only on the teaching workspace, with every catalog mode bound
(one-path ruling 09-23).

| Primitive | Commit | Shape | Items | Production (+/−) |
| --- | --- | --- | --- | --- |
| addition-subtraction-scene | `e200a155` | R | Spoken numbers (solve-story, Grade 1 act-out); act-out at K, create-story and build-equation commit on stillness and are checked by the activity | +261 / −113 |
| 3d-shape-explorer | `ba74b08c` | R | One spoken answer per item (solid name, flat or solid, a property, a face shape, a riddle) | +181 / −50 |
| calendar-explorer | `72556db8` | P + R | Grid: date or option pick plus Check, checked by the activity. Chain: spoken day or month successor | +387 / −235 |
| push-pull-arena | `68c70a35` | R | One spoken word per item, computed from the sim | +170 / −66 |

Each family has a `<X>.workspace.test.tsx` and two w1 payloads. Nine runner-mock or click-era suites were deleted,
and every render pin they held now runs on the real runtime:
- addition-subtraction-scene: reader-fit (609 lines) and Pip.
- 3d-shape-explorer: Pip.
- calendar-explorer: day-sequence, extended-modes, support-tiers and Pip.
- push-pull-arena: its case in the shared `StimulusRunners` Pip suite.

Carried over and now tested on the workspace:

- **addition-subtraction-scene:**
  - A hands turn still commits on stillness, right or wrong. Try again reseeds the picture.
  - The change group that waits for the story is a stimulus. The tutor's `present` or the learner's Show me brings
    it in, and `readyForResponse` is false until then (ten-frame's pattern).
  - The picture's count is a fact only on the enacted hands items, never beside a spoken answer.
- **calendar-explorer grid:**
  - The seven improvised tutor sends are gone. Below the hard tier they handed the tutor the answer.
  - The key never reaches the tutor. The tier's reveal policy rides in the scene facts.
  - The three-miss answer reveal and Next are gone.
- **push-pull-arena:** observe is ready for an answer only after the learner presses Go.

## Behaviour changes (recorded)

- **push-pull-arena predict and compare reveal on credit.** The runner played the push when an attempt opened, so
  the physics showed the truth while the answer was judged. It did this through an emission the workspace does not
  have. The push now plays once the answer is credited, so a Try again never sees the physics before the second
  answer.
- **calendar-explorer: only a correct result closes a question.** A recorded miss used to hide Check. On the
  workspace a miss reopens on Try again, so Check has to come back.
- **Adapters import pure modules only.** calendar-explorer's adapter imported the component, which pulled Firebase
  into the live-activity test graph. The two helpers it needed moved into `calendarExplorerWorkspace.ts`.

## Smoke drives (`--lesson-entry --progression-only`)

| Row | Result | Raw file |
| --- | --- | --- |
| addition-subtraction-scene act_out text (hands) | FAIL r1, PASS r2 | `addition-subtraction-scene-w1-act_out-text-2026-09-25(-r2).json` |
| addition-subtraction-scene solve_story `--audio` | PASS | `addition-subtraction-scene-w1-solve_story-audio-2026-09-25.json` |
| 3d-shape-explorer identify_3d text | PASS | `3d-shape-explorer-w1-identify_3d-text-2026-09-25.json` |
| 3d-shape-explorer shape_riddle `--audio` | PASS | `3d-shape-explorer-w1-shape_riddle-audio-2026-09-25.json` |
| calendar-explorer identify text (grid) | PASS | `calendar-explorer-w1-identify-text-2026-09-25.json` |
| calendar-explorer day_sequence `--audio` | PASS | `calendar-explorer-w1-day_sequence-audio-2026-09-25.json` |
| push-pull-arena observe text | PASS | `push-pull-arena-w1-observe-text-2026-09-25.json` |
| push-pull-arena predict `--audio` | PASS | `push-pull-arena-w1-predict-audio-2026-09-25.json` |

The act_out r1 failure was in the harness. The journey's wrong scene was "one short", and for a K addition story
that is the starting picture, so it made no move and nothing committed. The journey now goes one past instead.

## Findings (recorded, not patched)

- **The second riddle was not read aloud.** On shape_riddle `--audio`, the tutor opened item 2 with "Let's see if you
  can guess this next solid shape." It did not read the clues. They are printed, but a K-1 learner may not read
  them. This is the same shape as C3's summarised stories: guidance says what to read, and on a later item the
  tutor sometimes does not.
- **A leading hint after a wrong answer.** On identify_3d, after "triangle" the tutor said "What solid shape is a
  block made of flat square faces?" That is allowed after an attempt, but it nearly gives the answer.
- **addition-subtraction-scene uses `present`,** which is beyond strict W1. It is ten-frame's precedent, and without
  it a K-1 join story would either never show the join or show it before the story is told.

## Checks

- `typecheck:lumina` 0.
- Affected suites pass: math, calendar, physics, live-activity, pip, service and evaluation.
- The generic W1 contract passes on every saved payload, including the observer-request check added in C3.

Human acceptance (browser and mic) remains open under HUMAN-CHECKS #167.
