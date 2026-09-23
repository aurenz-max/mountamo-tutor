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
