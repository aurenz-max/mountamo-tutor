# Completion stalls in the tutor workspace: repair and evidence

Date: 2026-09-19. Executor: `$add-live-tutor-tools`, LA-13 first slice of
[08-lesson-workspace-follow-through](../live-runtime-handoffs/08-lesson-workspace-follow-through.md).
Scope: the shared observer and one primitive's scene facts. No new mode, adapter or backend branch.

## What was wrong

Both saved stalls were the same mechanism at different distances from the threshold:
JEV chose `correct` but under 0.9, so the verdict was refused and the assignment
stayed open. The decision then reported `confidence: 0.95` — the transition score
surviving into a refusal whose transition had been forced to `none`. Read at face
value that number said the answer was recognized; it never was.

Replaying the exact saved observation inputs against the unchanged criteria:

| Exchange | verdict probability, 3 replays |
|---|---|
| Counting Board run 3 — "Fantastic job counting all the blocks correctly!", expected 5 | correct 0.80 / 0.73 / 0.78 |
| Shape Sorter run 2 — "Fantastic job, that red shape is indeed a triangle!", expected triangle | correct 0.88 / 0.90 / 0.88 |

Two independent causes, both measured rather than inferred:

1. **The `correct` criterion read as requiring the answer to be restated.** "A stated
   total or final result must match that answer" made a whole-task affirmation that
   names no number ambiguous. Passing runs in the same batch all recited the number
   and scored 0.99–1.0.
2. **Counting Board published `counted: 0` as a scene fact.** It means "objects
   carrying a count mark", which is always zero when the child answers out loud —
   truthful, but it reads as "the learner counted zero" and contradicts a tutor who
   just affirmed a correct count. Same exchange, key renamed: 0.89–0.90 → 0.91–0.92.
   Dropping it entirely scores the same, so the aggregate is the cost, not the value.

A third candidate was tested and rejected. Supplying the learner transcript for
attribution raised the shape substep case 0.57 → 0.73–0.77, still short of threshold,
and lowered `contradictory_transcript` from 1.0 to 0.89–0.91. It buys nothing and
costs the multilingual/noisy guarantee, which is why the contract excludes it.

## What changed

- `service/typesafe/observeDialogue.ts` — `correct` now says restating the answer is
  not required and that a stated result must match only when one is stated; `none`
  names a tutor-supplied example and keeps bare substep praise out. The attribution
  instruction is unchanged: rewriting it to let the reply override the prior turn
  made the shape cases worse (0.57 → `none` 0.70), so it was reverted.
- `observeDialogue.ts` — a refused observation reports `confidence: 0`, and
  `feedbackComplete` is published on its own so a stall can be attributed to the
  layer that produced it.
- `runtime/DialogueObserver.ts` — when a tutor turn settles with complete feedback and
  nothing is committed, one factual cue per learner turn says the task is still open.
  It grants no credit, prescribes no wording, and does not fire on an unfinished turn,
  a committed outcome, or a service outage.
- `math/CountingBoard.tsx` — `counted` → `markedOnBoard`.
- Four CountingBoard test files had stale `evaluation` mocks left by the S2 slice
  (`useEvaluationContext` missing); 18 failures, unrelated to this repair, now fixed.

## Evidence

- Semantic, real JEV, 3 repetitions each. Counting Board **54/54**
  ([report](counting-board-follow-through-jev.json)), including the exact failed
  exchange added as a case (`wrong_then_corrected_board`, 0.74 → 0.90–0.94).
  Shape Sorter **42/42** on the baseline set
  ([report](shape-sorter-follow-through-jev.json)). Pre-repair reproductions retained:
  [counting-board](counting-board-follow-through-repro.json) 51/54,
  [shape-sorter](shape-sorter-follow-through-repro.json) 42/48.
- Connected `--lesson-entry --audio` journeys, real websocket and provider:
  Counting Board **3/3** ([report](counting-board-follow-through-audio.json)),
  Shape Sorter **3/3** ([report](shape-sorter-follow-through-audio.json)).
  Every runtime receipt `visible`, every run `completed`, `begin_help` and
  `demonstrate` executed in all six.
- 6975 frontend tests pass, 0 failures; `typecheck:lumina` 0; full `tsc` 770 errors,
  none in `components/lumina/`. Backend `test_lumina_tutor_session_units` +
  `tutor_live/test_live_activity_tools` + `test_live_runtime_tools`: 89 pass.

## What is not closed

- **The shape substep family still abstains.** `final_after_substep` sits at
  correct 0.60–0.66 and its live-worded twin at 0.81–0.87 — below threshold under
  every wording tried, including the base one. A tutor affirmation that names the
  answer right after an intermediate question is genuinely ambiguous without the
  learner's words, so abstaining is the correct behaviour; the cue is what keeps the
  lesson moving. Both cases stay in the probe under `--final-after-substep`.
- **The open-assignment cue has one live observation.** In an interim run it reached
  the tutor over the real socket and drew a reply, but the tutor re-affirmed instead
  of asking, and the item did not close. It never fired in the six passing journeys.
  Delivery is covered deterministically; its effect on the tutor's next move is not
  certified, and the driver has no flag to force an abstention. Follow-up for
  `$add-live-tutor-tools`.
- **Teaching-quality notes from the six transcripts**, neither a stall: one Counting
  Board `show` turn said "Watch me count: one, two, three, four, five", exposing the
  answer; one Shape Sorter run drew a round purple demonstration ring on a
  shape-naming task and the child answered "circle".
- HUMAN-CHECKS #167 stays open. Synthetic speech and mounted tests are not a human
  sitting.
