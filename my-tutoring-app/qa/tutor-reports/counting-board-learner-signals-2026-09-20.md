# Learner signals and observation kinds: Counting Board pilot (2026-09-20)

Scope: shared live runtime. Piloted on Counting Board behind an opt-in, then made general the
same day at the user's request: see "General availability" below. The sections before it
describe the pilot as it ran.

## What shipped

| Piece | Where | What it does |
|---|---|---|
| Learner signals | `runtime/learnerSignals.ts`, on `LiveLessonRuntime.learner` | Per-item facts from code: elapsed seconds (on item, since ready, since tutor settled, since learner spoke), learner and tutor turns, attempts, wrong attempts, repeated wrong response, recorded help, help and stop requests, consecutive turns without an answer. No model call. |
| Observation kinds | `service/typesafe/observationKinds.ts` | One runner for a question set, a bounded model input, a pure decision and a budget. `assignment_outcome` is the existing verdict trio, registered unchanged. |
| Learner-turn kind | `service/typesafe/observeLearnerIntent.ts`, `runtime/LearnerObserver.ts`, route `api/lumina/observe-learner` | Three Nouls on a finished learner turn: asks for help, wants to stop, attempts an answer. Advisory. The expected answer is not in its model input. |
| Packet | `runtimeTransport.ts` | `liveRuntime.learner = { signals, observations }` for an opted-in binding. Beside the snapshot, so the clock never moves a revision. A newly raised help or stop request sends one packet at the same revision. |
| Inspector | `JevInspector.tsx` | Signals block, and "Observe learner turn" entries with the exact model input and P(yes) per question. |
| Opt-in | `useTeachingWorkspace({ observeLearner: true })` | Set by `useCountingTutorController` only. |

Not built, on purpose: no timer publishes signals or prompts the tutor, no kind chooses a
hint, and nothing here writes attempts, evaluations or mastery.

## Verification

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| Full `tsc --noEmit` | 770 errors, none in a touched file |
| Vitest, live-activity + math + DI primitives + typesafe | 1784 / 1784 |
| Existing Counting Board verdict cases on the refactored observer, real JEV | 54 / 54, same as the 09-19 baseline (`counting-board-jev-after-observation-registry-2026-09-20.json`) |
| Learner-turn cases, real JEV, 29 cases x 3 | 87 / 87, 0 false help or stop requests, median 213 ms, p90 267 ms (`counting-board-learner-intent-2026-09-20.json`) |
| Connected journeys, real tutor + real audio transcription + real JEV | 3 / 3 PASS with `--startup --audio`: 1 before the turn-count fix (`counting-board-learner-signals-journey-2026-09-20.json`), 2 after (`...-journey-run2-2026-09-20.json`, `tutorTurns` 2 and 3 beside `learnerTurns` 2 and 3) |

Run 1 of the learner-turn cases was 81 / 84 (`counting-board-learner-intent-run1-2026-09-20.json`).
All three misses were one case: "no more fish", labelled as a stop request. On a fish-counting
task it can also mean "there are no more fish", and the model split it that way (stop 0.24 to
0.37). The label was wrong, not the criteria; the case is now marked ambiguous and an
unambiguous stop sentence took its place. No question wording changed between the runs.

What the first connected journey showed, from its saved packets: the synthesized "Can you
help me?" was transcribed by the provider, classified at 0.98, and the tutor's next packet
read `helpRequests: 1`; "Can you show me what you mean?" classified at 0.99 and the count
went to 2. Progression, the verdict commits and the completion were unaffected.

That journey also exposed a defect the unit tests had not: `tutorTurns` read 8 after 14
seconds, because audio-idle events repeat after a turn has settled and each one was counted.
It now counts once per held turn, with a transport test, and the journeys were re-driven.

## General availability (same day)

The opt-in flag is gone. Every `useTeachingWorkspace` binding carries `liveRuntime.learner`
and gets the learner-turn observation: Counting Board, Shape Sorter, Number Train,
di-letter-sounds and di-word-reading. No binding file was edited. Legacy runner adapters are
unchanged, because a runner owns its own judge and clock.

The tutor's instruction moved into the packet as `learner.about`, one sentence. It could not
go in adapter guidance: the backend rejects guidance over 2000 characters, and
di-letter-sounds is at 1896 and di-word-reading at 1994. Counting Board's added guidance
sentence was removed again.

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| Vitest, same four suites | 1785 / 1785, including a nonnumeric second-domain test of the unwired packet |
| Learner-turn cases, real JEV, per adopter domain | Shapes 27 / 27, letters 36 / 36, words 30 / 30, trains 24 / 27. False help or stop requests: 0 in every domain |
| Connected `--audio` journeys on newly covered adopters | Shape Sorter `identify` 1 / 1 PASS, Number Train `before_after` 1 / 1 PASS. Both packets carry `about`, signals and rising `helpRequests` with no binding edit |
| di-letter-sounds connected journey, text mode | letter_sound 1 / 1 PASS, packets carry the block. One run against a 7 / 10 text-mode baseline is weak evidence on its own |
| di-word-reading connected journey | Not run. Another session is mid-change on that pack; its mounted tests pass here |

The three train misses are one case, 3 of 3: "I am done with the train" reads 0.68 for stop,
under the 0.8 policy, because "done" also means finished. It is left failing in the probe with
a comment. A missed stop raises nothing; the measured risk is a false request.

The risk case for the DI packs held: a held phoneme transcribed as "hmm" reads as an unclear
turn on a letter-sound task (answer 0.34), so it neither raises a request nor counts as a turn
without an answer. On the train task the same "hmm" reads as no answer (0.05), which is right there.

A fresh-context dry run of the updated `/add-live-tutor-tools` answered seven usage questions
correctly from the skill text. Its gap list drove one code fix (the host-message registry held a
single string, so a second registration overwrote the first; it is now a short queue) and five
wording fixes in the skill.

## Limits

- The journeys prove the packet reaches the model and nothing regressed. They do not prove the
  tutor teaches better with it. That needs transcript comparison on the roadmap's replay
  sequences (isolated miss, repeated same error, productive silence), which is the next slice.
- A help request is also audible to the tutor in the turn itself. The per-turn flag is mostly
  redundant for that turn; the value is the running counts and any consumer outside the tutor.
- "This is hard" classifies as a help request at about 0.89. The cases accept either reading.
- Synthetic audio and JSDOM paint are not a human sitting. HUMAN-CHECKS #167 stays open.
- Latency was measured from the dev server on one machine.

## Size

362 production lines (six new files) plus about 40 changed lines in shared runtime files;
274 lines of new tests and cases, plus about 60 added to existing test files.

## Next

1. Behavioral comparison on Counting Board: same replay sequences with and without `liveRuntime.learner`.
2. If it helps, flip `observeLearner` on for Shape Sorter and Number Train and re-run their journeys.
3. Candidate kinds, each needing its own false-positive study first: same-error-as-last-time, tutor over-talking.
4. `seconds` in `teachingEvaluation` is still `null`; the tracker now has the number, but writing it is a student-data change.
