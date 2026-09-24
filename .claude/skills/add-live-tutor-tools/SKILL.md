---
name: add-live-tutor-tools
description: >-
  Add or migrate executable AI tutor interactions for a Lumina primitive using
  the shared tutor/JEV teaching workspace. Use for live surface bindings, truthful
  scene actions, observer-owned outcomes, help and return, runtime verification,
  or a scoped slice of scripted-tutoring retirement. Owns the existing spoken DI
  modality's migration and edits its adapters, packs, contracts and shared doctrine
  in place when the framework needs correcting. Separate from catalog-only tutoring text,
  Pip animation, voice capture, or phoneme-level spoken-production judging.
---

# Add Live Tutor Tools

Make one primitive or evaluation mode a truthful workspace for the live tutor.
Use Counting Board and Shape Sorter identification as the reuse examples. The
primitive defines the assignment and legal interactions; the tutor chooses how to
teach; JEV observes completed feedback; the runtime commits checked outcomes.

The scripted correction/re-ask/miss-cap architecture is being retired. New adoption
uses `useTeachingWorkspace`, not a new judged runner or a per-mode teaching loop.
Existing controllers are temporary compatibility dependencies until their real
entry points migrate. A live-bench pass alone does not authorize deleting them.

Scope a request to a primitive, resolved evaluation mode, entry point and requested
behavior. Example: `shape-sorter identify: demonstrate the target without changing
learner work`. Adopting a new primitive follows the user's requested scope; the handoff
index is not a mandate to migrate the catalog. A correction to the framework itself is
not limited that way (next section). Inspect the working tree and preserve existing changes.

## Standing authority over the existing spoken modality

User rulings 2026-09-19 (sunset scripted tutoring) and 2026-09-21: this skill owns moving
the spoken DI modality onto the workspace, and it edits that modality in place to make
the framework correct. Do not propose a framework correction and wait for approval; the
before/after measurement is the gate.

- **In scope without a new ruling:** every workspace adapter's guidance, the shared
  doctrine in `adapters/adapterContract.ts`, the shared observer and its criterion, DI
  packs (`*Script.ts`, `*Modes.ts`, their stages), catalog tutoring directives, the
  `/add-di-loop` skill, and contract requirements that encode scripted control.
- **A framework correction is made once and applied to every adopter.** When a finding
  recurs in two or more adopters, or the fix is a sentence the adopters share, change the
  shared layer and every adopter in the same slice. Do not tune per-adopter variants or
  file the finding against one adopter.
- **Runner-era requirements are re-based, not forked around.** A requirement that pins a
  sentinel word, a fixed correction, a correction cap or "the tutor's affirmation advances"
  was protecting something: strict judging, no unearned credit, one progression owner, the
  child answering aloud. Restate that property against the workspace (the observer's
  committed outcome advances; JEV refuses unearned credit) and log the re-base in the
  contract history. The CLAUDE.md fork ladder still governs task requirements: content,
  scope, answer keys, response class, stimulus timing and evidence.
- **The measurement decides.** Run every affected domain's verdict and learner-intent
  probes before and after, and one connected `--audio` journey per changed family. Keep
  the change if no domain regresses; otherwise revert it and report the numbers. Guidance
  tells the tutor what to do in its own words. A phrase the observer must hear verbatim
  is a sentinel, whatever it is called.
- **Still the user's call:** attempt, mastery or student-record semantics
  (`$student-data-loop`), opening a benched response class, and shipping.

## Read the current contract

Repository paths below resolve from the Lumina repository root, not this installed
skill's directory. Open these before implementing:

- `my-tutoring-app/src/components/lumina/docs/TEACHING_WORKSPACE.md`: ownership,
  TW-1 through TW-11, behavioral matrix, observation kinds and learner signals, and
  implementation limits.
- `my-tutoring-app/qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md` and
  `07-census.md` beside it: retirement sequence, current consumers and blockers.
  Read current status and source; historical baseline paragraphs can predate extraction.
- The target's component, domain builders, adapter, mode contract and existing tests.
- [Implementation map and commands](references/implementation-map.md).

For a repair that must stay on an existing controller, also read
[legacy maintenance](references/legacy-maintenance.md). Do not apply its progression
or sentinel rules to a workspace adoption. Catalog scaffolds, support tiers and Pip
remain separate concerns; they are not prerequisites for wiring a real workspace.

## W1 minimal binding (workspace rollout)

A row in `my-tutoring-app/qa/workspace-rollout/ROLLOUT.md` asks for W1: the tutor is present
and told the task, the child answers through the primitive's own UI or by voice, the observer
commits, the runtime owns progression. No demonstrations, marks, `present` or new observation
kinds. For a W1 row, follow this section in place of §1-§2 and §5's probes; §3's invariants
still hold. Examples, smallest first: `compareObjectsWorkspace.ts` + `CompareObjects.tsx`,
`placeValueWorkspace.ts` + `PlaceValueChart.tsx`, `numberBondWorkspace.ts` + `NumberBond.tsx`
(all under `L/primitives/visual-primitives/math/`, `L` = `my-tutoring-app/src/components/lumina`).
Copy the controller block from `PlaceValueChart.tsx` (it keeps `onFinished` out of both option types
and declares the finish shape it reads; `CompareObjects.tsx` predates that step).

Steps 1-5 are for a *runner-era* component (ROLLOUT shape R), one that calls
`useJudgedScriptRunner`. A component with its own Check and Next (shape P) follows "Plain shape"
below instead of step 2; steps 1, 3, 4, 5 and the checks are the same.

1. **Domain module** `<x>Workspace.ts`, pure:
   - `workspaceAssignment(item)` returns `{ id, task, response }`. The runner calls it with the
     item alone; when the task depends on the board (number-bond's spoken phases ask about the
     split the child built), pass `assignment: item => workspaceAssignment(item, view())` with a
     `view()` that reads the component's current refs. `response` is
     `'speech'` when the item's `answerKind` is `'voice'`, else `'gesture'`. A spoken item adds
     `expectedAnswer` (the observer judges against it); a gesture item does not, because its check
     is code and the key must not reach the tutor. `task` is the pack's own ask (`askFor(item)`,
     or the quoted `Say exactly: "..."` line of its cue), never cue protocol text.
   - `workspaceScene(item, view)` returns `{ objects: [], facts }`: what is drawn and asked, plus a
     `constraints` sentence naming the answer channel. Board counts only where the board is what
     the item asks about (§2, count-fact rule). Facts reach the tutor as `task.demand`.
   - The gesture's code check and its description (`orderMatches`/`describeOrder`,
     `chartMatches`/`describeChart`), reusing the logic the cue builder already runs.
2. **Component**:
   - Rename it `<X>Surface` with two extra props, `tutorOwned` and `useController`, and add a
     `workspace = useRef<TeachingWorkspace | null>(null)`.
   - Declare a `<X>ControllerOptions` type (the runner's options beside `WorkspaceRunOptions`,
     plus whatever the runner-era `use<X>Runtime` hook reads), `useScriptedController` (the
     existing `useJudgedScriptRunner` call plus that `use<X>Runtime` call, moved out of the
     surface) and `useWorkspaceController` (`useWorkspaceRunner` with `primitiveId` and
     `assignment: workspaceAssignment`).
   - Call `useController({ ...runnerOptions, items, workspace, objectiveId, planItemId, evalMode })`
     in the surface. Build `pack` only when `!tutorOwned` (`undefined` otherwise), and gate
     `completionCue` on `!tutorOwned`.
   - `onFinished` also receives the workspace's `teachingEvaluation` result: widen its parameter
     to the fields it reads, default the runner-only ones (`hearTaps ?? 0`), and pass
     `teachingAttempts` and `assistanceProvenance` through to the submission.
   - Export `withWorkspaceController('<id>', <X>Surface, useScriptedController,
     useWorkspaceController)` as the default. It keys the surface so the runner never mounts on
     the workspace path.
   - Every `runner.submitGestureAttempt(cue)` becomes `commitGesture(runner, { response,
     correct, cue: () => cue })`, with `correct` from the domain module's code check. Keep the
     primitive's own commit rule: whatever the runner committed (a partial order, a half-written
     chart) still commits, and what it treated as exploration still does not.
   - A `useLayoutEffect` with no dependency list, guarded by `tutorOwned`, sets
     `workspace.current = { ...workspaceScene(item, view), demonstration: [], canDemonstrate:
     false, canPresent: false, readyForResponse, mark: () => {}, clearPresentation: () => {} }`
     and calls `runner.publishWorkspace?.()`. `readyForResponse` is `true` unless a stimulus is
     still pending. Put `useLiveAutoStart` after it.
   - **One progression owner.** Reveal, reset and evaluation stay in the runner callbacks
     (`onItemOpened`, `onCorrectionRetry`, `onAffirmed`, `onFinished`), which the workspace fires
     from committed outcomes; answer-leak holds keep reading `revealHeld`. Turn off anything else
     that advances the activity (a timer, the primitive's own Next or Check). The summary stays:
     gate `PhaseSummaryPanel`, the stage and the Pip surface on `showSummary =
     !!runner.practiceSummary || evaluation.hasSubmitted`, because the live host has no evaluation
     provider, and build its phases from `runner.practiceSummary ?? runner.summary`.
   - `LiveRun` has no runner-only members (`stimulusTapped`, and `hearStimulus` or
     `runtimeControls` are optional). Hide a control that calls one when it is absent: with the
     tutor, the learner asks the tutor to repeat.
3. **Adapter** `adapters/<x>Live.ts`: only a `WorkspaceDomain`, `{ validate, initialState }`,
   with `initialState` from `workspaceOpening({ title, task, total })`. Delete the old mode list,
   copy and `RUNNER_GUIDANCE`. Register `workspaceAdapter('<id>', <x>LiveDomain)` in
   `activityContract.ts`.
4. **Catalog**: `teachingWorkspace: { grades, guidance }` on the entry. Leave the entry's
   `description`, `constraints` and `tutoring` alone unless the workspace makes a sentence false
   (the manifest reads the description; the workspace adapter sets `tutoring: null`). Guidance is the
   domain's sentences only: what checks the answer, what is hidden and why, what the tutor must
   say that the screen does not show, and what the tutor cannot do.
5. **Journey row** in `liveJourneySpec.ts`: `execution: 'workspace'`, `defaults.di: false`, `prompts:
   WORKSPACE_PROMPTS`, and `inputsFor` that finds the current item by `ctx.itemId`. A spoken item
   answers with `spokenExpected(ctx, intent)` when the answer is a number, otherwise with the
   domain's `*HarnessAnswers(item).correct` / `.plainWrong`. A gesture item goes through the real
   controls: `choose` (button text or `aria-label`), `touch` (`data-pip-object`), `place`, or
   `write` (text into the input with that `aria-label`). A wrong gesture is a complete wrong
   answer. A phase the row cannot drive throws with its name.

Grep `components/live-activity` tests (including `runtime/`) for the id. Expected-id lists
(`lessonWorkspacePlan.test.ts`) gain it. Since batch A2 every live adapter is
catalog-declared, so a test that needs "a family the catalog does not declare" uses a non-live
catalog id such as `hundreds-chart`.

**Plain shape (P).** The lever is `useChallengeProgress`, which most plain primitives call.
`runtime/useWorkspaceProgress.ts` returns the same shape backed by the workspace. Examples:
`NumberLine.tsx` (one Check), `ComparisonBuilder.tsx` (four check functions, taps without a Check),
`NumberTracer.tsx` (async check), each beside its `<x>Workspace.ts` and `<X>.workspace.test.tsx`.
- `workspaceAssignment(challenge)` usually returns `{ id, task: challenge.instruction, response:
  'gesture' }`; the primitive's own check stays the judge, so no `expectedAnswer`.
- Rename the component `<X>Surface` with props `tutorOwned` and `useController`, add the
  `workspace` ref, and replace `useChallengeProgress({ challenges, getChallengeId })` with
  `const progress = useController({ challenges, getChallengeId, instanceId, objectiveId,
  planItemId, evalMode, workspace, assignment: workspaceAssignment, onItemOpened })`. Move the
  instance-id lines above it if needed. `onItemOpened(index, retry)` clears the working surface on
  the workspace path (fresh item and Try again); it may call setters declared further down, since
  it only runs after render. Keep the reset in the Next handler too: the scripted path
  (`useScriptedProgress` = `useChallengeProgress`) never calls `onItemOpened`.
- Wherever a check reaches its verdict (a Check handler, or a tap handler that grades without a
  Check button), call `progress.commitCheck?.(describe(...), correct)`, with `describe` from the
  domain module (the learner's work in words, never the key). Keep the primitive's rule for which
  moves are checked at all.
- On the workspace path (`tutorOwned`):
  - Hide the primitive's Next button and any read-aloud button that sends text to the tutor.
  - Close learner input while `progress.canAttempt === false`: a `learnerBlocked()` gate on every
    tap, placement, undo, Clear and Check, never on the completion path.
  - Wrap the scripted `sendText` once so it sends nothing when `tutorOwned`, and pass
    `useLuminaAI({ enabled: !tutorOwned })`: its context carries the answers, and its `sendText`
    still sends when disabled.
  - Give the primitive's tool-lab `use<X>Runtime` hook a `disabled` option if it lacks one (hand
    `usePrimitiveRuntime` a `null` mount, skip `requestCompletion`) and pass `tutorOwned`. Keep
    sandbox controls (the harness reads their `getState`) but refuse their `advance`.
- Submit the evaluation only when `progress.recordsEvaluation !== false`: the live host has no
  evaluation provider, and the smoke drive fails on any submission there. `progress.advance()`
  returns `false` on the workspace path, so an existing "advance returned false → submit"
  completion path still runs once the last challenge is correct.
- Publish the scene in a `useLayoutEffect` as in step 2, calling `progress.publishWorkspace?.()`.
  Derive every scene input during render (`useMemo`), never in an effect that sets state after an
  item opens: that extra revision supersedes the advance's visible receipt and the lesson stalls
  (comparison-builder's card shuffle).
- Export `withWorkspaceController('<id>', <X>Surface, useScriptedProgress,
  useWorkspaceProgressFor('<id>'))`.
- Harness: `choose` presses the FIRST button whose text or `aria-label` matches, so labels a row
  presses must be unique on screen. A mode or band the driver has no input for throws with its
  name in the row; record it in the report as undriven, including any guidance written for it.

**Checks.** (a) The generic W1 contract, `runtime/workspaceContract.test.tsx`, covers what every
binding owes (lesson binds the content, tutor owns it with no cue, a task, the packet's item and
`learner`, no observer-only tool, nothing moves or submits on its own, adapter modes equal the
catalog's). It FAILS until the family has a payload: after the smoke drive, copy its saved
`generatedData` into `runtime/testing/w1-payloads/<id>.<mode>.json` as `{ source, primitiveId,
evalMode, data }`, one file per mode driven. Then `<X>.workspace.test.tsx` tests only what is the
primitive's own, mounting through `mountWorkspace` (`runtime/testing/workspaceHarness.tsx`, seams
from `liveRuntimeSeams`): an `it.each` over every catalog mode on hand-built items (the payloads
rarely cover every mode), the spoken key published and the gesture key not, a wrong commit that Try
again reopens and what it clears, a right one that completes once. (b) The primitive's existing tests and
`components/live-activity`, `typecheck:lumina` 0, full `tsc` not above baseline. (c) One smoke
drive, frontend and backend running:
`backend/venv/Scripts/python.exe backend/tests/tutor_live/run_live_runtime.py --primitive <id>
--mode <m> --runs 1 --lesson-entry --progression-only --output my-tutoring-app/qa/tutor-reports/<id>-w1-<m>-<date>.json`,
on a gesture mode, plus `--audio` on one spoken mode if it has any. Read the tutor lines, not only
PASS: a tutor that never says what the screen withholds is a finding. Editing any file under
`backend/` reloads uvicorn and closes a running drive with ws 1012; rerun it. A failed smoke is
recorded in the queue row, then fixed, or the row moves to W2 or BLOCKED. Do not widen W1 to
pass one row.

**Shared files.** Every adoption edits `activityContract.ts`, the catalog and
`liveJourneySpec.ts`. With two sessions running, commit one primitive before the next one
starts editing those files. A subagent that may not commit leaves its work for the orchestrator,
who commits it before the next primitive touches those files; the other session keeps its
component and domain edits local until then.

## 1. Define the domain boundary

Record the original assignment, complete success condition, accepted alternatives,
response channel, stimulus/manipulation prerequisites, visible objects and legal
operations. Keep the assignment stable while the tutor decomposes or rephrases it.

Reuse pure domain construction and validation. Counting Board and Shape Sorter now
have `countingBoardDomain.ts` and `shapeSorterDomain.ts`; their script wrappers remain
for legacy consumers. Extract needed task facts before retiring a cue pack. Preserve
math/language constraints, aliases, item IDs, geometry and response provenance.
`TeachingItem` in the domain contract and the workspace hook serve different layers;
map them explicitly rather than assuming their similarly named types are identical.

A bounded spoken answer can use `expectedAnswer`; open explanations need a real
rubric and evidence contract. Timed flashes, dragging/construction, phonemes and
open-ended responses are not certified by the shape-naming pilot. Implement only
modes whose evidence and interactions the shared contract actually supports.

## 2. Bind the shared workspace

Use `useTeachingWorkspace` and `TeachingSession`. Supply items (`id`, `task`,
`expectedAnswer`, `response`, gesture `checkResponse`), current scene facts,
separate learner selections and demonstration marks, readiness and presentation
operations. Keep domain-specific rendering and task rules in the primitive.

- Structured gestures are checked by the activity. Speech opens a pending response;
  the tutor hears the audio and JEV assesses its feedback against the whole assignment.
  Do not add an English transcript parser, source-answer extraction call, phrase
  triggers, or sentinel matching as a second speech judge.
- Teaching progress, a verdict and permission to advance are separate. Praise for
  a side count cannot complete a shape-naming task. Correct final feedback followed
  by an open question can record success while staying on the item. Help and uncertain
  observations remain ungraded. Wrong answers do not cause automatic skips.
- Tutor tools change the visible workspace. `apply_tutor_verdict`, retry and advance
  are observer-only operations; never advertise them to the tutor on this path.
  There must be one teaching owner, without a competing runner clock.
- Demonstrations are not learner selections or attempts. Validate every target
  before mutating anything. Do not claim side highlighting, movement or rotation
  when only whole-object marks exist. Shape Sorter's gold assignment ring stays fixed
  while purple demonstration rings may change.
- Use `begin_help` before assistance. Retry, clearing a mark and fading an aid retain
  assistance and attempt history; a fresh item starts fresh. Current tracking relies
  on that explicit help action: no recorded help does not prove independence.

- Learner facts come with the binding; nothing is wired per primitive. Every
  `useTeachingWorkspace` surface publishes `liveRuntime.learner`: `signals`, computed by
  code for the current item (elapsed seconds, turns, attempts, a repeated wrong response,
  recorded help, help and stop request counts), and `observations`, an advisory JEV
  reading of each finished learner turn (asked for help, asked to stop, attempted an
  answer). The packet describes itself, so add nothing about it to adapter guidance.
  Guidance is capped at 2000 characters, and the shared doctrine takes 900 of it. The
  binding owes three things:
  - `readyForResponse` is true only while the learner can actually answer.
    `secondsSinceReady` is measured from it, so a stimulus still pending must report false.
  - A message the host writes itself and sends through `sendText` without `{ silent: true }`
    passes `author: 'host'`. Without it, the context treats the text as learner words: the
    outcome observer receives it as the learner's answer and the learner-turn observer counts
    it. A silent send never reaches that channel. The shared hook's checked-gesture message
    already passes it.
  - The domain gets its own learner-turn cases (step 5.4).

  Do not build a per-primitive struggle detector, an idle timer that prompts the tutor,
  or an observer that chooses the hint. Facts go in the packet and the tutor decides;
  silence alone establishes neither frustration nor a misconception. Before asking JEV a
  new question, check whether a code signal already answers it; `repeatedWrongResponse`
  already covers "the same wrong answer twice". A question that does need JEV is a new
  observation kind under `service/typesafe/`, with a real-model case set, a false-positive
  count, and a named consumer: the packet field the tutor will read, or a trace-only bench
  while it is being measured. Only `assignment_outcome` may commit.

Scene facts state what is drawn and asked, never a count that is not the asked quantity beside a
spoken answer: "0 in each part" or "0 on the frame" beside a credited "three" reads to the observer as a
contradiction and drops a clear credit under the gate (number-bond and ten-frame W1, 2026-09-23; LA-13's
`counted: 0`). Publish board counts only where the board is what the item asks about.

Adapter guidance is the catalog entry's `teachingWorkspace.guidance`: write only the domain's sentences (task
constraints, which targets exist, what the tutor cannot do) and let `WORKSPACE_DOCTRINE` in
`adapters/adapterContract.ts` carry teaching ownership, help, showing, crediting and
progression for every adopter. A change to that doctrine is a framework correction: make it
there, once, and measure every adopter. Keep it in guidance, which the mount receipt echoes
beside the conversation; the same sentences in the backend session instruction cut visible
demonstrations from 19/21 to 14/21. Do not add prescribed correction wording. A request to
show something needs an actual action and visible receipt before narration claims it.

## 3. Preserve execution and observation boundaries

Use the existing scoped transport and shared observer lifecycle.

- A handler acknowledges only a synchronous committed change. Scheduled React state
  is not a commit. Publish committed refs/state; refuse unsupported or stale actions
  without mutation. Reuse the hook's command boundary instead of duplicating it.
- Commands retain epoch, instance, item and revision scope. Never refresh an old
  command's scope to make it execute. Stop, teardown, suspension and actual scene,
  evidence, assistance or affordance changes must invalidate affected commands.
- Pending speech can update conversational context without invalidating unchanged
  scene tickets. This narrow exception does not relax outcome ownership: new words
  cancel observations and verdict commits still require the exact response ID.
- Observe only after provider turn completion and playback drain. Raw VAD pauses
  do not finalize an answer; raw microphone activity alone must not cancel semantic
  observations. New recognized words or confirmed interruption invalidate pending work.
- Keep commit, visible receipt and speech settlement distinct. Final success sound
  and completion summary occur once through the shared lifecycle after settlement.
- The inspector also shows the learner signals and each learner-turn observation with
  its exact model input. A new surface shows both without edits.
- Keep the inspector's assignment, evidence, model input, classifications and applied
  or refused result inspectable. Reuse shared probability/margin policy; do not patch
  a domain failure with a new phrase rule or primitive-specific threshold.

For prepared help/return, preserve meaningful learner work and quiesce timers, pending
judgments and hidden handlers. A hidden subtree is not suspension. Use existing support
contracts only where they can restore the same item safely; withhold unsupported help.

## 4. Mount only the verified surface

Declare `teachingWorkspace` in the catalog entry and register the family's `WorkspaceDomain`
with `workspaceAdapter` (one line in `activityContract.ts`); the adapter's ownership, modes,
copy and guidance follow from the catalog, and rendering needs no change. Pass exact
`objectiveId`, `planItemId` and resolved `runtimeEvalMode`; never infer the mode from a flattened
interaction label. Validate generated data against the
actual renderer and task gates. Advertise only verified modes.

Inspect the real entry point. The pilots were implemented in `/lumina/live-activity`;
ordinary lesson integration is a separate retirement gate. Keep required fallbacks
until their consumers have migrated. Once every consumer binds, delete the drill and render
a visible unbound state rather than a silent fallback (the four DI packs, handoff 13); run
`scripts/di-drill-unbind-probe.mjs`-style evidence over saved and fresh lessons first. Follow the handoff's current stage and census
instead of restarting completed extraction or deleting every file named `Script`.
Preserve useful instructional content while removing wording as a control protocol.

Before changing attempts, evaluations or mastery persistence, use `$student-data-loop`.
Practice summaries and their scores are not automatically mastery evidence. This skill
alone does not authorize shipping or changing student-record semantics.

## 5. Verify behavior and report the boundary

A W1 row needs only the W1 section's checks: its workspace test, the existing tests and type gates,
and one smoke drive. The steps below are for W2 and for new DI or framework work.

1. Test the real component, shared runtime, transport and rendering shell for each
   advertised mode. Exercise the TW behavioral matrix: intermediate vs final praise,
   incorrect praise, held success/open question, help without grading, wrong then
   corrected, noisy/multilingual speech, gestures retaining grading authority, separate
   demonstration/work, stale and duplicate outcomes, new-word cancellation, raw VAD,
   pending-speech ticket stability, actual-scene invalidation and final completion.
   Cover supported actions and unsupported targets, stop/unmount and help restoration.
   Assert the packet carries `learner` and that a host-written message is not counted
   as a learner turn. A test that mocks global `fetch` must route by URL. Two observers
   call it: `/api/lumina/observe-dialogue` for the outcome and `/api/lumina/observe-learner`
   for the learner turn. A one-shot outcome mock is otherwise eaten by the learner route.
2. Add or update a row in `LIVE_JOURNEYS` (`liveJourneySpec.ts`), with workspace
   execution, domain-derived inputs and DOM probes. Always mount with resolved
   `evalMode`. Reuse the generic JS driver and `run_live_runtime.py`; do not create
   a Python journey per primitive. Extend shared physical-input vocabulary only for
   an actual new operation; no backend primitive branches or answer injection.
3. Run focused component/runtime checks and `typecheck:lumina`. Regress Counting
   Board and Shape Sorter when changing shared workspace behavior; cover affected
   legacy consumers if a shared transport or contract changes. These are free,
   deterministic vitest runs — run them on every slice regardless of scope.
4. The real-model probes and connected journeys below cost API calls; scope them
   to the domain(s) actually in play. Adding or mounting one primitive with no
   shared-layer edit needs only its own domain's cases and journey — do not
   re-run a sibling primitive's JEV probe, learner-intent probe, or `--audio`
   journey just because it exists. Only a framework correction (Standing
   Authority above) requires the wider "every affected domain" sweep, and even
   then "affected" means domains the change actually touches, not the whole roster.
   Add the domain's case set to `scripts/learner-intent-probe.mjs`, behind a flag named
   for the domain, and run it: answers
   as this domain's learners say them, including the noisy transcript of a correct answer
   (a held phoneme reads as "hmm"), plus help, stop, filler and off-task turns. Mark an
   honestly ambiguous turn `null` when writing the case. A label changed after a failure
   needs its reason stated in the report, and the question wording must not be tuned to a
   case. False help or stop requests must be 0. Any other failed case, including a missed request, is a finding
   to report, not a blocker.
   Then run real JEV semantic cases and three full connected journeys (`--runs 3`, with
   `--audio` for speech evidence). Use a saved generated payload for replay. A
   progression-only run does not certify demonstrations. Mocked observer decisions
   prove lifecycle mechanics, not semantic classification or real model behavior.
5. Inspect every transcript and receipt. The journey sends its help and example prompts
   unless `--progression-only` is passed. In the saved packets, each of those raises
   `learner.signals.helpRequests`, and `tutorTurns` stays beside `learnerTurns` instead
   of racing ahead of it. Narration without a visible action is a
   failure. Capture state at the transition, not a later tutor turn; support/return
   can occur in one turn. Check that preserved work was non-empty. Bound waits,
   retain failed reports, and never fabricate grades or receipts to pass a journey.
6. Report supported modes/actions, withheld capabilities, exact checks, raw evidence,
   remaining failures and next bounded slice in `my-tutoring-app/qa/tutor-reports/`.
   Update existing roadmap/handoff/census entries when their status changes. Link
   HUMAN-CHECKS #167 for remaining browser/microphone acceptance rather than opening
   another queue. JSDOM paint and synthetic audio are not human acceptance.

If a service is unavailable, finish independent work and identify the exact unrun gate.
Do not call a surface verified from a partial run. Shape identification's earlier
42/42 JEV and 3/3 audio results are a scoped baseline; its human sitting remains open,
and the recorded Counting Board demonstration miss remains a follow-up until retested.
