# Number Train on the teaching workspace: third adopter

Date: 2026-09-19. Executor: `$add-live-tutor-tools`, continuing
[08-lesson-workspace-follow-through](../live-runtime-handoffs/08-lesson-workspace-follow-through.md)
after the completion-stall repair. Scope: one primitive, its five spoken modes, the
development live host and ordinary lesson entry. No backend change.

## What now reaches the student

`number-sequencer` runs on the shared tutor/JEV workspace in `count_from`,
`before_after`, `fill_missing`, `spot_error` and `decade_fill`, in the development
live host and in ordinary Kindergarten and scroll lessons. The tutor teaches; the
train defines the assignment and the legal scene actions; JEV observes completed
feedback; the runtime commits scoped outcomes. Submission goes through the existing
evaluation provider, as Counting Board and Shape Sorter already do.

`order_cards` is **withheld** — see "What is not closed". It keeps its standalone drill.

| Layer | File | What it owns now |
|---|---|---|
| Domain | `math/numberSequencerDomain.ts` (new) | Validity gates, item builders, asks, harness answers, misstep inventory, the mode maps |
| Cue protocol | `math/numberSequencerScript.ts` | Only the retiring wording: affirm, correction, judging contract, cues, pack base. Re-exports the domain |
| Teaching binding | `math/NumberSequencerTeaching.tsx` (new) | Scene objects, facts, the drawn train, gesture checker |
| Mode gate | `math/NumberSequencer.tsx` | A live runtime plus a bound mode mounts the workspace; otherwise the standalone drill |
| Live registry | `adapters/numberSequencerLive.ts` | `teachingOwner: 'tutor'`, workspace guidance, `canAdvance: false` |
| Lesson entry | `live-activity/lessonWorkspacePlan.ts` | Eligibility derived from the bound-mode list, not restated |
| Journey | `live-activity/liveJourneySpec.ts` | `execution: 'workspace'`, inputs derived from the domain |

The domain split follows S1 for the other two pilots: the teaching binding no longer
imports the sentinel engine to learn what a train asks. `SequencerItem` now extends
`TeachingItem` and keeps `DiActionContract` as a type-only import.

### One shared observer change

`observeDialogue.ts`, `correct` criterion, one sentence added: *"Agreement that names
the expected final answer credits the learner even when the reply is very short and
adds nothing else."* A tutor replying "Yes, eight." to a correct spoken answer scored
`correct` 0.89 against the 0.9 threshold, three replays out of three, and the
assignment stayed open — the same failure family the previous slice repaired, at the
short end. This is a clarification of what agreement means, not a phrase rule or a
primitive-specific threshold, and it was kept only because it regressed neither
existing case set.

## Evidence

Real JEV, 3 repetitions per case, against the running service:

| Set | Before the criterion change | After |
|---|---|---|
| Number train (new, 14 cases) | 39/42 — `next_number` failed 3/3 at 0.89 | **42/42** |
| Shape sorter (baseline 14 cases) | 42/42 | **42/42** |
| Counting board (baseline 18 cases) | 54/54 | **54/54** |

Reports: [trains before](number-sequencer-workspace-jev-2026-09-19.json),
[trains after](number-sequencer-workspace-jev-criterion-2026-09-19.json),
[shapes](shape-sorter-jev-after-train-criterion-2026-09-19.json),
[counting board](counting-board-jev-after-train-criterion-2026-09-19.json).

The train cases include the two this domain is most likely to get wrong:
`spot_error_named` (affirming the number that breaks the count → success) and
`spot_error_repair` (affirming the replacement instead → no success credit).
`read_back_visible` and `counting_along` cover the intermediate steps this primitive
actually produces — reading back the printed number, and counting along with the tutor.

Connected `--lesson-entry --audio` journeys, real websocket and provider:

| Mode | Runs | Result |
|---|---|---|
| `before_after` | 3 | **3/3** — [report](number-sequencer-workspace-audio-2026-09-19.json) |
| `spot_error` | 3 | **3/3** — [report](number-sequencer-workspace-spot-error-audio-2026-09-19.json) |

Every runtime receipt `visible`, every run `completed`, `begin_help` and a visible
`demonstrate` in all six, zero evaluation writes from the isolated driver. In all
three `spot_error` runs the tutor affirmed the breaking number, never the repair.

Deterministic: 24 new mounted cases in `NumberSequencer.teaching.test.tsx` against the
real component, session, runtime, transport and rendering shell — the TW behavioural
matrix in this domain: per-mode factual state, no scripted cue in the task, no tutor
progression tool, demonstration without grading, refused unknown targets, speech as
context until observed feedback, stale response id, duplicate command, stale retry
after advance, multi-ask trains filling their answered slots, settled-speech
observation through to a single completion and one submission. 252 tests pass across
the changed and regressed areas; full suite 7018 pass. `typecheck:lumina` 0.

## What is not closed

- **`order_cards` is withheld, and the reason is a shared gap.** The arrangement is
  checked by the activity, correctly — a connected run placed 3, 2, 1 and the train
  recorded `incorrect` — but a checked-wrong arrangement leaves the session in
  `checked`, which locks the cards until an observer transition reopens the item. The
  observer abstained on that transition twice in a row ("Let's try again by finding
  the smallest number" → `transition_uncertain`), and the explicit learner
  **Try again** control exists only in `LiveActivitySandbox`, not in the ordinary
  lesson host. Trace retained: [smoke run](number-sequencer-workspace-cards-smoke-2026-09-19.json).
  This is not a train-specific defect — it blocks every gesture mode from ordinary
  lesson entry, including Counting Board's. **Next bounded slice: give the lesson
  workspace shell the learner-owned retry/advance controls the dev host already has,
  then admit `order_cards`.** The binding and its checker are built and tested; only
  the registry entry is withheld.
- **Two spoken modes are bound but not journeyed.** `count_from`, `fill_missing` and
  `decade_fill` are covered by mounted tests and the shared JEV cases, not by a
  connected run: the journey harness mounts two generated challenges and drives two
  answers, so a mode whose challenge expands into several asks cannot reach completion
  in it. Closing that needs either a harness that drives every open ask or a
  single-ask payload per mode. Recorded in the journey row.
- **The legacy live branch for this primitive is now unreachable.** Every mode the
  live registry offers is a workspace mode, so `useNumberSequencerRuntime` and the
  scripted runner are only reached by the standalone drill and by
  `NumberSequencer.runtime.test.tsx`. Deletion belongs to LA-14 S3 with its caller
  audit; both are left in place.
- **One transcript artifact.** `before_after` run 3's opening turn leaked model
  reasoning into speech ("The user has provided the initial lesson context and the
  goal… I need t"). Provider-side, not a runtime or scope failure, and the run passed.
- **HUMAN-CHECKS #167 stays open.** Synthetic speech, JSDOM paint and a mounted host
  are not a browser and microphone sitting.
