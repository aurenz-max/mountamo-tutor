# Live lesson runtime infrastructure

**2026-09-19:** Counting Board now uses `TeachingSession` and `useTeachingWorkspace`
for tutor-owned teaching on its actual surface. See
[the ownership boundary and invariants](../../../docs/TEACHING_WORKSPACE.md).
Its earlier scripted adapter is retired in the live host; standalone DI remains.

Infrastructure and first TenFrame adoption, 2026-09-17. Learner demo:
`/lumina/live-activity` (Make ten, Grade 1). The shared judged runner now opts into
runtime ownership, suspension, replay and closing-speech settlement. TenFrame
publishes its actual frame/task and offers a text reminder plus a prepared example
with return. Number Line now has its own tutor-led adapter, checked advance/retry, focused replay, a jump reminder and a prepared subtraction example with return. The reference lab at
`/lumina/live-activity/runtime` remains an infrastructure diagnostic.

The synthetic connected fixture was **rejected by user review** as a learner demo.
/lumina/live-activity/runtime/live now redirects to the existing live activity host.
[Three real Live runs](../../../../../../qa/tutor-reports/live-runtime-connected-2026-09-17.md)
prove transport only: they supplied checked fixture answers and simulated paint.
The fixture does not implement spoken-answer judging. Keep adoption in the working
host with its real activity and judge; do not expose the diagnostic as a replacement.

Backend cleanup retired the connected fixture component, its Live harness/driver,
and the fixture-only prompt. The offline lab and its deterministic tests remain.
Runtime connections now require the real activity sandbox, and the model tool
accepts only the advertised action ticket; the old five-field command format is
removed. The bridge still sends full scoped commands to the browser for validation.

Activity startup now uses a host capability envelope from `liveActivitySpec.ts`.
`LIVE_ADAPTERS` supplies supported modes, teaching owner, legacy advance availability
and activity guidance. Direct-visual tool schemas and parameter validation live in
`directVisualContract.ts`, beside their renderer. The Python activity bridge has no
primitive IDs, mode catalog, teaching-script tags or visual-data constructors.
It validates the envelope, declares the advertised tools, and correlates browser
receipts. Silent runner startup depends on `teachingOwner`, not a TenFrame branch.
The existing catalog tutoring block still goes through the shared prompt renderer.

New adapters must provide truthful capabilities and implement their host controls;
metadata does not create handlers. Visual requests carry tool name plus parameters
to the host; only successful host validation and paint produce mounted, with an
explicit `highlightCount`. Probes use the same registry through the development
capabilities endpoint or the lesson-fixture importer. The old enabledPrimitives
connection shape has no fallback; reload the development page when updating both ends.

LiveActivitySandbox and runtimeTransport.ts own the adopted connection. A tutor
turn uses holdTeachingTurn with allowTutorActions=true: its local tool calls may
execute within that turn without changing the task revision. This still blocks
handoff and completion. Default holds retain the stricter behavior described below.
The provider supplies model turn-end and pending playback-buffer signals. This is
also the settlement signal used by the opted-in judged runner.

## Implemented boundary

- `contract.ts`: exact discriminated wire commands, semantic task/evidence, executable
  affordances, assistance effects, prepared counter artifacts and receipts.
- `LiveLessonRuntime.ts`: mounted registration, host policy, revisions, duplicate/conflict
  rejection, exclusive teaching ownership, completion gate and one support detour per item.
- `LiveRuntimeContext.tsx`: opt-in registration/subscription facade. `LuminaAIProvider`
  accepts `liveLessonRuntime`; omitted means existing sessions are unaffected.
- `LiveRuntimeSurface.tsx`: keeps the parent mounted and paints prepared support.
- `waitForVisible.ts`: bounded, cancellable wait for the exact rendered revision.
- `LiveRuntimeLab.tsx` / `runtimeFixture.ts`: executable reference integration, no
  microphone, model, generation, catalog registration or learning-record writer.

## Adapter obligations

Counting board is the second judged-runner adoption (2026-09-17): two owners now exercise
the shared runner lifecycle. Its adapter scopes the prepared example per challenge kind and
cancels both of the board's timers on suspension.
[Evidence](../../../../../../qa/tutor-reports/counting-board-runtime-live-2026-09-17.md).

Number Line now resolves the former queued-setter gap: imperative commands use
`flushSync`, and the adapter reads refs updated by a layout effect. Its tests assert
the new task and actual DOM inside dispatch, before the surrounding `act` finishes.
A synchronous ref update or completed React commit still needs the separate visible
receipt. Do not invoke this imperative command boundary from render or effects.

Keep the adapter and mount descriptor stable. `usePrimitiveRuntime(mount)` registers
it and returns `changed()`. Call that synchronously after meaningful learner/runner
transitions. State must be in refs or an external store before notifying; React state
scheduled for later is not a committed semantic state. Every command rechecks item
identity and revision. Capture the original scope before asynchronous work, and
invalidate the adapter's pending work on suspension, item changes and unmount.

`getAffordances()` returns concrete allowed actions and their actual synchronous
handlers. The same transition should serve learner controls and tutor requests.
`execute()` returns `true` only after committing; `false` means refusal with no mutation.
Promise-returning handlers are outside this contract. A thrown or malformed handler
faults the activity; the runtime does not claim to have rolled back partial mutations.
Missing handlers, wrong targets/strategies and phase-inappropriate requests are not
advertised. Assistance-producing actions must declare their level and exposure.
The adapter owns the mapping of one scaffold increment to its next supported level.

Supply `suspension` only when **all** queued cues, timers, gesture commits and pending
judgments can be quiesced synchronously. Hiding a DOM subtree is not suspension.
`resume()` restores the original phase/work, not a remount from payload JSON. The
runtime changes the revision on both edges. The host must keep the same child mounted,
use adapter gates for non-native controls, and clean up its effects on unmount.
The real TenFrame tests now exercise pending voice judgment, late verdicts, mid-build
stillness cancellation, StrictMode replay, stop and closing audio. Subitize does not
advertise help detours. Other primitives do not inherit these capabilities automatically.

`canYieldForHelp` is NOT a detour switch. While the owner is `runner`, `blockedReason()`
returns "Runner owns the teaching turn" whenever that predicate is false, and `offers()`
then returns nothing at all — the re-ask and the reminder disappear with the detour. Use
it only for "may the tutor act on this item at all"; withhold a detour by returning no
`supportArtifacts` for that item. Counting board separates the two: the quick-look family
yields nothing, while `recount_moved`, `compare` and `give_me_n` keep their actions and
are withheld from the example alone.

`LiveRuntimeSurface` draws three prepared shapes. A `counter-example` is one row with a
subtract / make-ten / count sentence: it states HOW MANY. A `contrast-pair` is two rows
of counters stacked so their columns line up, with the unpartnered tail of each row
ringed: it states a relationship BETWEEN two collections, which one row cannot. A
`step-sequence` draws the SAME collection two to four times on one column grid, one change
and one sentence per step (tones: plain, added, empty, marked `+`, crossed `×`): it states a
PROCESS. Ten-frame prepares one for `make_ten` on a different frame in `useTenFrameRuntime.ts`.
Every advertised `request_support` choice carries a `purpose` (`SUPPORT_PURPOSE` in
`contract.ts`: worked example, contrast, step-by-step explanation) so the model picks by
what the learner is missing, not by title. A fourth kind, `generated-image`, is never prepared:
the host draws it from the tutor's own description and a vision check verifies it before the
runtime shows it. Its bytes stay in the runtime (`getSupportImage`), never in the snapshot.

The tutor also composes help the host never prepared, through one tool, `compose_move`
(`moveContract.ts`). A support is a teaching move: four fields (`obstacle`, `delta`,
`nextAction`, and the runtime-owned `check`), a delta from a closed list, and the numbers it
draws. The tutor names the delta; code picks the carrier and builds the whole artifact,
captions included, so no shape can state a relationship it does not draw. Two refusals do the
work no prompt wording could: `drawsTask(counts)` rejects numbers belonging to the saved task,
and non-redundancy rejects a support drawing the representation already on screen unless the
delta compares, works a process or shrinks the ask. An adapter opts into this open lane by
declaring `representation`, `alternateRepresentations` and `drawsTask` — no per-primitive
handler, no misstep inventory — and the runtime publishes what it may compose as
`moveOptions`. `attend`, `reveal-aid` and `microstep` are each their own piece and stay
unadvertised until they land (`docs/LIVE_TEACHING_MOVES.md`, M1 / M2 / M4). An adapter
prepares whichever shape can state its own teaching truthfully, or none. Comparison
builder prepares a NEARBY contrast pair per item, sharing no number with the item, in
`comparisonBuilderExample.ts`, and nothing on `order`. A further shape is an additive
member of `SupportArtifact` in `contract.ts` with its own validator and a renderer
branch, never a change to the existing ones.

Host policy defaults to no artifact detours and no answer exposure. Artifacts are
trusted prepared host data; an LLM may choose only an advertised artifact ID. Validate
quantities and the example's relation to the actual task when preparing it. The runtime
checks structural validity, not pedagogical truth of prose or whether two answers match.
The lab intentionally uses a matching answer and declares full exposure to prove
that assistance remains recorded after dismissal. The transfer item has a different
answer and a cleared response field. No response receives mastery credit here.

## Ownership, completion and transport adoption

Acquire `holdTeachingTurn()` **before** enqueueing any cue. Release its disposer only
when that cue's model turn has ended AND its buffered audio is finished, or confirmed
cancellation has drained it. An idle audio boolean before speech starts is insufficient.
Multiple holds can represent model output and audio tail. Holds prevent owner changes,
local tutor commands and starting a replacement. The host calls `grantOwnership()`;
the model cannot grant itself ownership. A certified adapter can explicitly allow
help while its runner owns progression; no tutor advance is advertised for TenFrame.
Canceling a cue releases its hold with `false`, so cancellation cannot complete it.

An adapter reports terminal state, then the host calls `requestCompletion()`. Any
outstanding closing hold delays the single `onCompletion` event and `canStartNext`.
TenFrame uses a brief activity closing cue in planned lessons and reports completion
after speech settles. The sandbox's G1–G3 remain open across both activity orders
until the combined lesson drive is complete. Number Line has local completion-gate
and host-relay tests; these do not close the combined experience gate.

For a tool action, call `dispatch(unknownWireCommand)`. A `committed` receipt means
the adapter committed state. Await `waitForVisible(runtime, receipt.state.revision)`
before reporting it visible. Superseded, timed-out and cancelled waits must not be
reported as successful screen changes. The shell acknowledges after two animation
frames; this is a paint opportunity, not proof of perceived visibility in a hidden tab.
Return the refreshed snapshot on rejected actions. Never replace a stale command's
scope with current scope and replay it. Registration and policy come from the host,
not backend catalog tables or model-supplied descriptors.

The model copies one opaque `actionId` ticket (`epoch/revision/index`). The bridge
reconstructs the original scope only if that ticket is still advertised. Actions
marked `responseSpeech: 'runner'` use a silent successful tool response: the runner
supplies the question. Return waits for both the tool turn/audio to settle and the
visible receipt to be sent (`afterVisibleResponse`), preventing a re-ask from
superseding its own screen acknowledgement. Failed tool results remain audible.

Stop does not imply successful completion. The runtime closes its command surface
and invokes suspension where supported; the actual host still owns socket/audio stop
and disposal. Adapters without certified suspension cannot advertise support detours.
Reconnect starts a **new runtime with a new epoch**; durable recovery is not implemented.

## Limits and next sessions

This slice intentionally supports prepared structured artifacts and synchronous local
actions. It does not implement asynchronous artifact providers, general alternate
primitive detours, skip/defer, demand changes, durable checkpoints, production flags,
student-data writes or transport tool renaming. No primitive receives implicit support.

Migration order and bounded tasks: [handoff index](../../../../../../qa/live-runtime-handoffs/README.md).
Evidence: [infrastructure report](../../../../../../qa/tutor-reports/live-runtime-infrastructure-2026-09-17.md).

Run from `my-tutoring-app`:

```powershell
npm.cmd test -- --run src/components/lumina/components/live-activity src/components/lumina/hooks/useJudgedScriptRunner.test.tsx
npm.cmd run typecheck:lumina
```


## Replicate a primitive adoption

A primitive's harness facts are declared in `liveJourneySpec.ts` beside it, and
`backend/tests/tutor_live/run_live_runtime.py --primitive <id>` is the ONE journey for
every primitive and both execution families — it picks its phase program from
`teachingOwner` in the production envelope. Adding a primitive is a row in that spec;
neither the driver nor the journey is edited.

Invoke `/add-live-tutor-tools` (installed at `.claude/skills/add-live-tutor-tools/`)
with its [handoff](../../../../../../qa/live-runtime-handoffs/05-primitive-tools.md).
The shared mounted driver is `scripts/primitive-runtime-driver.mjs`, which owns a
fixed learner vocabulary and no primitive names; Number Line's row selects actual SVG
placement and Check, the judged rows select real voice reduction.
The tester now has an Activity picker and wraps either family in this support shell.
The [Number Line report](../../../../../../qa/tutor-reports/number-line-runtime-live-2026-09-17.md)
distinguishes action execution from narration quality and human acceptance.
