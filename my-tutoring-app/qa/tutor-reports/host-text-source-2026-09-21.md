# Host-written text is no longer learner words (brief 11 item 1)

Date: 2026-09-21 · Executor: `/add-live-tutor-tools` · Scope: every shared-workspace binding with a gesture mode

## The defect

After a checked gesture, `useTeachingWorkspace` sends the tutor "The learner submitted their
selection. Current workspace response: {…}". `LuminaAIContext.sendText` stamped every non-silent
send as `runtime_learner_text`, so the transport received it as learner words. A registry
(`expectHostText`/`consumeHostText`) kept it out of the learner-turn count, but
`DialogueObserver.learnerText` had already stored it, and for a gesture the outcome observer puts
`learner` into JEV's model input (`assignmentOutcomeKind.state`, `responseAuthority: 'activity_check'`).
So JEV judged every checked tap against the host's message as though the child had said it.

The headless driver never reproduced this: its `sendText` stub sent nothing to the transport, so
gesture observations there carried whatever the learner last said. The 2026-09-20 `hear_see`
journeys judged all six first-item taps with `learner: "Can you help me?"`.

## The change

- `sendText(text, { author: 'host' })`. A host-authored non-silent send emits `runtime_host_text`;
  only learner-authored text emits `runtime_learner_text` (`LuminaAIContext.tsx`).
- `RuntimeTransport.hostText()` → `DialogueObserver.hostTurn()`: opens the next exchange (cancels
  pending work, keeps the prior tutor turn) with an empty `learner`. The learner-turn observer is
  not called. Both hosts route the event (`LessonWorkspace.tsx`, `LiveActivitySandbox.tsx`).
- `hostTexts`, `expectHostText`, `consumeHostText` deleted.
- The headless driver's `sendText` stub routes the same way the browser context does.
- Harness: `[LESSON_START]` went through `say()`, which also handed it to the driver as a learner
  utterance, so the learner-turn observer classified the host's start message as turn 1 and
  `learnerTurns` read one high (2 after the first spoken prompt, in the 09-20 baseline as well). It
  now goes to the model only, as both hosts send it silently.

## Measurement

| Check | Before | After |
|---|---|---|
| Verdict probe, checked-tap cases (`--links` tap subset, ×3), `learner` = host message vs `""` | 10/15 | **12/15** |
| `tap_correct_question` ("Yes, sss. How did you know that one?") | 1/3 (`no_transition` verdict `none`) | **3/3** |
| `tap_correct` (bare "Yes, sss.") | 0/3 | 0/3, unchanged: the LA-13 bare-token shape, `uncertain_or_invalid` |
| Connected `--lesson-entry --audio --runs 3`, letter-sound-link `hear_see` | — | **3/3 PASS** |
| … counting-board `give_me_n` | — | **3/3 PASS** |
| … number-sequencer `order_cards` | — | **3/3 PASS** |
| Gesture observations with `learner: ""` and committed (`visible`) | — | **27/27** |

The 09-20 `hear_see` run (a different tutor doctrine, so not a controlled comparison) abstained on
6 of 15 gesture observations; this run abstained on 0 of 9.

Harness `[LESSON_START]` fix, counting-board `give_me_n` re-run (`…-host-text-b-2026-09-21.json`),
3/3 PASS: three spoken prompts give `learnerTurns` 3 beside `tutorTurns` 3 (the first run read 4
beside 3); `learner-turn-1` is now "What do I do?" at help 0.98, where it had been the start
message at help 0.07.

Learner-intent probe: not re-run. Its input is unchanged. The host message was already kept away
from the learner-turn observer; now it never reaches it.

Gates: full frontend suite 7154 passed / 0 failed, `typecheck:lumina` 0, full `tsc` 770 (baseline).
New tests: a checked gesture is judged with `learner: ""` and earlier learner words do not carry
over (`useTeachingWorkspace.test.tsx`); the real `LuminaAIProvider.sendText` with a fake socket
routes host text as `runtime_host_text`, learner text as `runtime_learner_text`, silent text
nowhere, and sends all three to the model without an `author` field
(`contexts/LuminaAIContext.runtime.test.tsx`; fails when the routing line is reverted).

Evidence: `{letter-sound-link-runtime-hear_see,counting-board-runtime-give_me_n,number-sequencer-runtime-order_cards}-host-text-2026-09-21.json`,
`counting-board-runtime-give_me_n-host-text-b-2026-09-21.json`.

## Not verified

The connected journeys stub `LuminaAIContext`; the provider routing is covered by the unit test
above, not by a browser. Browser check owed under HUMAN-CHECKS #167: tap a wrong answer in a lesson
and confirm the inspector's outcome input shows an empty learner field.
