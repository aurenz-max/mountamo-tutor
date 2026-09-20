# Tutor-owned teaching on a shared workspace

Implemented first slice: Counting Board in `/lumina/live-activity`, 2026-09-19.

**Architecture direction, subsequent user instruction 2026-09-19:** the legacy
scripted approach is to be sunset. Existing standalone controllers described here
are temporary compatibility, not the permanent end state. Follow the
[LA-14 retirement handoff](../../../../qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md)
for extraction, real-entry migration, evidence parity and deletion gates.

## Ordinary lesson wiring and completion (S2)

Counting Board `count` and Shape Sorter `identify` now use this runtime through
`LessonScreen` and `OrderedSection`, in both Kindergarten and scroll layouts.
**User clarification:** completing an assignment with the tutor counts as ordinary
primitive completion. The primitives submit through the existing evaluation provider,
with attempts, corrections and assistance preserved. There is no separate practice-only
completion or mastery-eligibility gate. The earlier bench-only/no-write descriptions
below are historical. See [S2 wiring report](../../../../qa/tutor-reports/lesson-workspace-wiring-2026-09-19.md)
for exact mode scope, data mapping and verification limits.

## What changed, and what carries forward

| Step | Counting Board change | Reusable responsibility |
|---|---|---|
| Executable workspace | The tutor sees the current objects and can mark them without selecting for the learner. | Primitive supplies truthful scene facts and legal operations; runtime supplies scoped execution and visible receipts. |
| Tutor-owned teaching | Live lessons bypass the scripted correction/re-ask/miss-cap runner. | One tutor chooses explanations, questions, and demonstrations. Standalone drills can keep their own controller. |
| Natural progression | Retry and advance disappeared from the tutor's advertised tools. | JEV observes a completed exchange; runtime commits an allowed outcome. Fluent narration alone changes nothing. |
| Tutor-first speech | The English-number parser and separate source-answer interpretation call were retired. | Speech opens a pending turn. JEV interprets the tutor's feedback; the fallible transcript is diagnostic, not a second speech judge. Structured gestures retain activity checks. |
| Whole-assignment grounding | Praise for eight objects in one row cannot finish an eighteen-object assignment. | Stable assignment + success condition + prior tutor question distinguish a substep from final success. |
| Browser turn settlement | Raw microphone activity stopped cancelling semantic observations; actual playback drain became an explicit signal. | Observe only after provider turn end and drained playback. New recognized words or a confirmed interruption cancel pending work. |
| Inspection | The JEV panel shows the assignment, model input, probabilities, and applied/refused result. | Keep the evidence chain inspectable across every adopted surface. |

The latest user session (`2026-09-19-190241-lumina-tutor-4aca92f0ac84`)
completed seven assignments: 4, 6, 7, 8, 5, 9, and 10 blocks. Seven observer
advances reached visible receipts, including noisy and multilingual transcripts;
five other observations abstained without granting success. The final runtime
settled as completed. This matches the user's positive experience report for this
sitting; it does not close every mode or the combined-lesson gate. Provider output
also contains a post-completion `<!-- silence -->` transcription; the logs alone
do not establish whether that was audible. See the compact evidence in
[the adoption report](../../../../qa/tutor-reports/shape-sorter-teaching-2026-09-19.md).

## Invariants for every new surface

| ID | Principle | Enforced or assessed by |
|---|---|---|
| TW-1 | Teaching may change the path; the original assignment and success condition stay fixed. | Domain assignment construction; JEV whole-assignment cases. |
| TW-2 | Teaching progress, a graded verdict, and permission to advance are separate. | JEV verdict/transition fields; observer and session tests. |
| TW-3 | Evidence authority follows the response channel: activity for gestures, tutor feedback for speech. | Shared workspace binding; real-model semantic probes. No transcript parser in front of speech. |
| TW-4 | Tutor demonstrations and examples never become learner work or attempts. | Separate scene/mark state; real-component assertions. |
| TW-5 | One tutor owns the conversation. An observer may classify an exchange but does not plan teaching or speak corrections. | Shared observer service and adapter guidance; transcript inspection. |
| TW-6 | Outcomes belong to one item and one response. Stale, interrupted, duplicate, or uncertain observations award no new success. | Epoch/instance/item/revision checks, response deduplication, cancellation tests. |
| TW-7 | Completion follows settled speech, committed state, and a visible receipt. These are different events. | Playback callback, transport/surface, mounted-host completion tests. |
| TW-8 | Assistance is monotonic within an item; hiding an aid or retrying does not erase it. | TeachingSession and runtime history. A fresh item starts fresh. |
| TW-9 | Every advertised action has a real, bounded visible effect; scene facts describe what is actually drawn. | Domain validation, synchronous command boundary, DOM checks. |
| TW-10 | New domains add task meaning and real operations, not new observer phrase rules or backend primitive branches. | Second adopter, unchanged shared observation lifecycle, registry-based journey. |
| TW-11 | Practice evidence is not automatically mastery evidence. Unrecorded help does not prove independence. | Dev host has no mastery writes; persistence requires its own data contract. |

**Scope refinement from the second adopter:** finalizing a pending spoken turn
changes conversational context, not the drawing or the legal demonstration targets.
It publishes updated context without changing tutor action tickets. New words still
cancel JEV observations, and a verdict operation still checks the exact response ID.
Scene, assignment, checked evidence, assistance, or tutor-affordance changes still
invalidate old tickets. No old command is retargeted to a new revision. Mounted
Counting Board and Shape Sorter tests reproduce the previous stale-demonstration
failure and cover this distinction.

TW-1 through TW-3 include semantic judgments, so their real-model regression cases
complement deterministic checks. None of the probability thresholds proves semantic
correctness or learning effectiveness.

**Second adopter: Shape Sorter `identify`.** The same assignment/observer/runtime
now names a gold-ringed shape. A side count, color, or name of a comparison shape
is intermediate progress. The expected name includes existing aliases such as
`rhombus or diamond`. Purple dashed demonstration rings never retarget the gold
assignment ring. The same SVG geometry draws the standalone and live surfaces.
The live registry deliberately advertises only plain-shape identification in this
pilot; count, sort, and real-object modes remain standalone and need their own
adoption evidence. No new JEV criteria, backend domain branches, or teaching state
machine were needed. Verification and remaining gates are in the report above.
Shape identification passed 42/42 real JEV replay cases and 3/3 full connected audio
journeys after the scope/guidance fixes. Its human browser/mic sitting remains open;
an additional Counting Board run missed a requested demonstration, so tool-choice
reliability remains follow-up work even though its progression regression passed.

## Governing principle: completion belongs to the assignment

**Teaching can change the path; only evidence satisfying the original assignment
can change its completion state.** A tutor may decompose, demonstrate, rephrase,
switch languages, or ask a smaller question without replacing what the item assesses.
The original question and success condition stay stable until an explicit item change.

For an 18-object assignment, an answer of eight to a first-row question can be
excellent progress while the assignment remains unresolved. Confirmation of the
final total eighteen can establish success. An explanation question after that
confirmation can keep the conversation on the item without undoing the success.

This gives the framework four responsibilities, implemented by existing layers:

| Responsibility | Contract | Current implementation |
|---|---|---|
| Define the assignment | Stable item identity, original question, expected final answer, response channel, task constraints | `TeachingItem`, primitive item derivation |
| Supply evidence | Current learner work, prior tutor question, completed reply, assistance, turn identity and item scope | `TeachingWorkspace`, `DialogueRequest` |
| Interpret evidence | Does feedback concern the whole assignment? Does its result agree with the success condition? Is feedback finished? | Shared `observeDialogue` service |
| Commit the outcome | Record at most once for that response, preserve attempts/support, validate scope, apply an allowed transition and expose its visible result | `TeachingSession`, `DialogueObserver`, `LiveLessonRuntime` |

The task defines correctness. Evidence authority depends on the response channel:
the activity checks structured gestures; the live tutor hears speech, and JEV
interprets its feedback against the assignment. A noisy transcript is not a second
speech grader. Positive wording alone is not evidence that the assignment was solved.

Keep three concepts separate: **instructional progress**, **assignment verdict**,
and **permission to advance**. Intermediate progress can be acknowledged without
creating a graded attempt. A correct final answer can be recorded while a follow-up
question remains open. An uncertain observation leaves conversation available and
awards no success credit; it is not an incorrect answer.

## How this becomes an enforceable framework

Types make observations explicit; they do not prove their educational meaning.
Use different verification for the two kinds of guarantees:

| Guarantee | How it is established |
|---|---|
| Old-item responses cannot affect a new item; duplicate commits do not repeat credit; gestures cannot be overridden by praise | Deterministic runtime validation and tests |
| Intermediate praise is not full success; an affirmed result matches the expected final answer; a follow-up question remains open | Shared JEV criteria plus real-model regression cases |
| Accepted success produces the intended board change, sound, and eventual summary | Mounted-host tests and connected journeys |

A high model score is neither a correctness proof nor a visible UI receipt. The
inspector must expose assignment, evidence, model input, classification, and runtime
disposition so a failure can be attributed to the responsible layer.

For another primitive, provide its assignment and success condition, meaningful
scene facts, response checker where applicable, and executable teaching actions.
Reuse the observation and completion lifecycle. Add domain code for real differences
in tasks or interactions; do not add phrase triggers or a progression tool per mode.
The current `expectedAnswer` is a string suitable for bounded answers. A future
open-ended task needs an explicit rubric and evidence contract; giving the existing
field a vague sentence does not establish rubric-based assessment.

Each adoption must exercise the same behavioral matrix with its own domain examples:

| Exchange or event | Required result |
|---|---|
| Correct intermediate step | Assignment stays open; no final success credit or sound |
| Final result consistent with assignment, feedback finished | Record success and advance visibly |
| Correct final result followed by an explanation question | Record success, remain on the item |
| Tutor affirms a final result that conflicts with expected answer | No success commit |
| Help, example, or generic encouragement | Conversation continues without a graded answer |
| Accepted multilingual/noisy speech | Same outcome as an equivalent clear answer |
| Wrong answer followed by correction | Preserve earlier attempt and assistance; accept the correction |
| Interruption, late result, or duplicate delivery | No stale or duplicate outcome |
| Last item completed | Success feedback and final summary occur once after settlement |

Counting Board supplies the first evidence for this matrix. Shape Sorter identification
is the second real binding, alongside the earlier nonnumeric fixture. Its checks must
be read at their stated layer: mocked decisions prove lifecycle mechanics; real JEV
replays assess classification; connected journeys assess actual tool use and teaching.
Extend the existing contract only when an adoption exposes a concrete missing capability.

The failure was architectural. The live board sent exact correction sentences, the
judged runner interpreted tutor speech as its control protocol, and help was mostly
a re-ask or a reminder. A learner could receive the same correction twice and then
be moved on without the tutor having taught the missing concept.

The live board now uses the existing live model to choose its teaching actions.
It publishes the current task, visible objects, learner selections, recent attempts,
and available actions. It neither prescribes correction speech nor advances at a
miss cap. The existing SVG board is the workspace: a demonstration visibly marks
actual objects without adding them to the learner's selection.

```mermaid
flowchart LR
  Learner[Learner] -->|Gestures| Board[Board: scene and gesture checker]
  Learner -->|Speech| Tutor
  Board --> Session[Shared teaching session]
  Session --> Tutor[Live tutor: observe and choose]
  Tutor --> Observer[JEV: observe completed exchange]
  Session --> Observer
  Observer --> Runtime[Existing scoped action transport]
  Tutor --> Actions[Visible teaching actions]
  Actions --> Runtime
  Runtime --> Board
  Board --> Receipt[Committed and visible result]
  Receipt --> Tutor
```

## Ownership

| Layer | Owns | Does not own |
|---|---|---|
| Live tutor | Spoken-answer judgment, explanation, questions, demonstration choices, natural feedback | Recording responses or calling retry/advance in observer workspaces |
| Shared dialogue observer | Recording the tutor's spoken verdict and transition after speech settles | Regrading learner transcripts, teaching plans, arbitrary state mutations |
| Primitive binding | Task meaning, visible scene, legal interactions, private answer checker | Correction scripts, a teaching state machine per mode |
| `TeachingSession` / `useTeachingWorkspace` | Attempts, assistance, response boundaries, shared help/check/retry/advance lifecycle | Number vocabulary or subject-specific pedagogy |
| Existing runtime and transport | Scope, revisions, policy, deduplication, commit/visibility receipts, closing speech settlement | Teaching strategy |

There is no second teaching planner. One bounded TypeSafe/JEV call observes each completed
exchange with pending learner speech or an activity-checked response. There is no
separate spoken-answer extraction service. The existing
`perform_runtime_action` tool accepts bounded `targets` parameters
for workspace actions; its action tickets retain instance/item/revision scope.

## Runtime invariants and semantic assessment rules

1. Help and demonstrations are not learner attempts. Tutor marks and learner
   selections have separate state. Clearing a demonstration does not erase help history.
2. Gesture submissions are checked by the activity. Spoken answers are judged by the
   live tutor, whose completed feedback is observed by JEV. A finalized learner turn
   opens a pending response; it does not need to pass an English answer parser.
   The observer compares that feedback with the original assignment and expected
   final answer, using the prior tutor question to distinguish intermediate steps.
   Praise for one row or group does not solve the whole assignment or play a success sound.
   Help, examples, and encouragement without a confident verdict remain ungraded.
   The tutor does not call a recording or progression tool.
3. Provider fragments are assembled by input stream, including empty final markers.
   When the provider omits its final flag, its response/tool-output boundary finalizes
   the input. Client VAD pauses alone do not finalize a count.
   Partial audio text, an old item's trailing speech, and answers spoken before a
   required stimulus/manipulation cannot be submitted as the current response.
4. A verdict and a transition are separate observations. Confident success with
   finished feedback can record the answer and advance in one scoped operation.
   Success followed by an open question records the verdict without advancing.
   Wrong answers never advance. There is no maximum-error skip.
5. Retry retains attempts and assistance. A new item starts with fresh work and fresh
   assistance state. Replaying a timed stimulus records assistance.
6. Hidden objects are absent from the tutor's visible scene. Mode constraints still
   govern flash timing, removal/addition, conservation, and pre-numeric matching.
7. Commands reject stale scopes and invalid parameters. A demonstration validates
   every target before changing anything. Completion follows the final visible
   receipt and speech settlement.

These are interaction and evidence invariants, not scripts for how to teach. A
one-to-one selection, timed flash, or count-on basket is mathematical task structure
and remains in the board. Exact correction wording and two-miss progression do not.

## Reuse contract

The 2026-09-19 user audio session exposed a separate transport gap: browser state
was attached to typed messages but never delivered to audio-only turns. The visible
mount receipt now includes the runtime packet, and the existing continuing activity
response streams subsequent state with SILENT scheduling. The live adapter does not
advertise legacy `advance_activity`. Conversational transcript changes alone no
longer invalidate action tickets. These are shared transport fixes, not new modes.

**Implemented observer boundary:** `DialogueObserver` consumes completed tutor speech,
learner speech and current assignment metadata. Its request includes the actual selected
object IDs/labels/groups, separate tutor demonstration marks, response source, attempt
count, assistance and browser-checked correctness. It sends a bounded snapshot, not a
raw click history. The existing JEV client classifies spoken verdict and conversational
transition independently. For pending speech, the model sees the assignment, tutor
reply, expected final answer, prior tutor turn, activity metadata, and presence of a learner turn. The fallible learner transcript
is retained as diagnostic context, but excluded from this model input so it cannot
veto an accepted answer in another language. The inspector exposes both the request
and the exact model input. Gesture correctness remains activity-owned.

Retry/advance are internal observer capabilities, omitted from tutor action tickets.
An accepted transition requires at least 0.9 selected-option probability, a winning
margin, a confident tutor verdict or checked gesture evidence, and matching
epoch/instance/item/revision. These are operational
thresholds, not a calibrated guarantee of correctness. Raw model confidence is retained
in the inspector, but is not a second threshold on the same choice. Classification waits for provider
turn completion and drained playback. New speech, interruption, stale state and teardown
invalidate pending decisions. No exact-word trigger or primitive-specific observer exists.

**Refusal reporting and settled turns (2026-09-19).** A refused observation reports
`confidence: 0`. It previously carried the transition probability through a refusal
whose transition had been forced to `none`, so a 0.95 sat beside a verdict the runtime
had rejected and read as proof the answer was recognized. Feedback completion is
published as `feedbackComplete` on its own, separately from the verdict and the
transition, so a stall can be attributed to the layer that produced it. When a tutor
turn settles with complete feedback and nothing is committed, the observer says once
per learner turn that the task is still open. That cue grants no credit, prescribes no
wording, and is withheld for an unfinished turn, a committed outcome, or a service
outage. Scene facts must not be nameable as the learner's answer: Counting Board's
`counted` became `markedOnBoard` because a spoken answer always leaves it at zero, and
a fact reading "the learner counted zero" contradicts a tutor affirming a correct count.

A new spoken turn replaces the pending turn and invalidates its unfinished observation;
the next tutor feedback can record a correction while retaining prior attempts and
assistance. Verdict recording and an accepted retry/advance commit atomically through
an observer-only workspace operation. Explicit learner Try again / Next challenge controls use
the same scope and visibility checks, so service failure/abstention does not trap the learner.
Automated progression still fails closed; ambiguous discussion or unanswered questions do
not move the board. After a visible advance, one factual cue requests the next task's
introduction. Final completion follows its visible receipt without another progression call.

This is enabled only in the development live host. It does not eliminate all tutor tools:
visible demonstrations and stimulus presentation remain executable model actions, and
`begin_help` still records verbal assistance. That remaining bookkeeping is a separate
boundary; unrecorded assistance is not evidence of independence.

A primitive supplies `TeachingItem[]` (identity, task, expected answer, response channel, checker),
the currently rendered `TeachingWorkspace` (objects, facts, presentation constraints,
mark/clear functions), and item-reset/stimulus callbacks. The shared hook provides
the lifecycle and executable actions. A nonnumeric color-selection test exercises
the same hook to check that it does not secretly depend on counting.

The current generalization covers selection workspaces and explicit responses.
Dragging, constructing, annotating, and open-ended explanations need their own
truthful domain operations/checkers. Do not add a generic arbitrary-state mutation
API or recreate per-mode teaching scripts. Shape identification supplies the second
binding; its evidence does not authorize a catalog migration or certify these other interactions.

## Compatibility and evidence limits

The live host selects this controller and opts out of the old catalog DI scaffold.
`useCountingBoardRuntime` and its mode-specific reminder/misstep inventory were
removed. The standalone scripted drill still uses its existing controller. Both
controllers render the same board; the live controller has a small compatibility
facade for the existing view. Task derivation currently remains in
`countingBoardScript.ts`; only the standalone controller builds its cue pack.

Attempts are session-local evidence in the dev live host. They are deliberately
not converted into the legacy drill mastery score. Demonstration is conservatively
classified as full answer exposure. Verbal assistance depends on the tutor calling
`begin_help`; `assisted: false` means no recorded assistance, not proven independent
mastery. Persisting these records requires a separate student-data contract review.
Spoken attempts retain their tutor response and judgment provenance. An affirmation
of a final result that conflicts with the expected answer is not accepted. The observer
still relies on semantic classification of tutor feedback rather than independently
grading the original audio; it is not a guarantee against tutor or classifier errors.

The deterministic suite checks the shared mechanics across all ten board kinds.
Real-model journeys cover handover and spoken counting, with simulated learner
input through the real mounted component and WebSocket bridge. They do not prove
microphone recognition, browser visual quality, every mode's teaching quality, or
improved student learning. See the [dialogue observer trial](../../../../qa/tutor-reports/counting-board-dialogue-2026-09-19.md).
The subsequent [tutor-first speech verification](../../../../qa/tutor-reports/counting-board-tutor-primary-2026-09-19.md)
covers multilingual transcripts, verdict recording, success sounds, and settled summary completion.
