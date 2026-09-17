---
name: add-live-tutor-tools
description: Add and verify executable AI tutor actions for an existing Lumina primitive in the live activity host. Use for scoped runtime adapters, action affordances, help and return, or extending the live tester to another primitive. Separate from adding catalog tutoring text, Pip gestures, or spoken-answer judging.
---

# Add live tutor tools

**Installed as a native skill at `.claude/skills/add-live-tutor-tools/`, invoked as
`/add-live-tutor-tools`. That copy is the one a session loads and the one to edit.**
This handoff copy is kept for the versioned record; it carries no phase structure,
adapter template or corrected backend paths.

Make the requested primitive controllable through the shared mounted runtime in
`/lumina/live-activity`, preserving its established learner interaction and grading.
The model selects opaque action tickets; frontend adapters own actual mutations.

Work from the repository root. Start with the latest section of
`my-tutoring-app/src/components/lumina/docs/LIVE_LESSON_ROADMAP.md` and the primitive's
contract/component. Read [implementation map](references/implementation-map.md)
for source locations and test commands. Inspect existing changes before editing;
these live lesson files may already contain another session's uncommitted work.

## Choose the bounded capability set

Identify the real teaching owner before choosing actions. Number Line is tutor-led;
TenFrame's judged runner owns questions, verdicts and progression. The latter must
not expose a competing tutor advance. Keep ordinary standalone sessions working
when `useLiveRuntime()` returns null.

For each requested action, identify its phase gate, actual visible effect, commit
boundary and assistance/exposure effect. Add only executable affordances:

- `advance`: reuse checked progression; move to a fresh item with blank work.
- `retry`: clear a failed response without erasing attempts or assistance history.
- `replay`: repeat the mounted instruction without regenerating or resetting work.
  Number Line synchronously focuses its outlined prompt; verify that actual DOM
  effect rather than accepting a no-op acknowledgement.
  The response belongs to the tutor unless a certified runner queues it; only then
  declare `responseSpeech: 'runner'`.
- `scaffold`: show one actual aid and its inverse fade. Describe text reminders as
  text, never as highlights or moved objects. Withhold unsupported strategies.
- `point`: publish only targets with real handlers. Pip registration alone is not
  an executable runtime point action.

These are candidates, not a requirement to add every action. Record unavailable
capabilities and reasons. Preserve exact objective, plan item and resolved eval
mode; `interactionMode` may not preserve distinctions such as identify/between.

## Implement at the owning layer

Keep the `RuntimeMount` and adapter stable. Publish semantic state from committed
refs or an external store, including item identity, phase, current response,
checked correctness, attempt number, support and completion. Notify `changed()`
after actual learner transitions so previous tickets become stale.

`execute()` returns true only after a synchronous commit. A React setter followed
by a read of the old closure is not a commit acknowledgement. Number Line uses
`flushSync` at the imperative command boundary and a layout-updated state ref;
its test asserts the new DOM and state *inside* dispatch, before `act` exits.
Use that approach only where appropriate; do not call `flushSync` from render or
effects. Refusal must not queue mutations. Stale controls must refuse after stop,
unmount or item changes. If a primitive needs asynchronous actions, resolve the
shared contract explicitly before advertising them; do not return a false success.

Scope every command to its original epoch, instance, item and revision. Let
`LiveLessonRuntime` perform ticket, duplicate and policy checks. Use the shared
`RuntimeTransport` to distinguish committed state from the shell's visible receipt.
Never retarget an old command using a fresh snapshot. A paint opportunity in JSDOM
is machine evidence, not a human's perception of the screen.

Before adding `suspension` and a support artifact, inspect every timer, judgment,
queued cue and gesture handler. Quiesce them and reject hidden/late learner events.
Keep the same parent mounted through `LiveRuntimeSurface`; return restores phase,
response and checked state. Use only prepared support the renderer can represent
truthfully, derived from the actual payload. Validate quantities and answer
exposure, including an accidentally matching answer. Withhold unsupported modes.
The current runtime allows one detour per item. Fading and return retain history.

Keep speech and progression ownership at their sources. Acquire closing-speech
holds before enqueueing speech; release only after turn end and audio tail.
Planned completion must be relayed once after runtime settlement. Suppress duplicate
primitive closing/opening cues where the host owns them, preserving standalone
behavior. Do not compensate with primitive-specific Python branches or transcript
filters. If a shared assumption fails, fix the shared contract and regress both
execution families before expanding adoption.

## Make it usable in the existing tester

Add the family to frontend validation, generation, mounting and host capability
registrations as needed. Capabilities and tool guidance belong beside frontend
handlers; the Python bridge stays primitive-agnostic. Metadata does not create
handlers. Expose the selected family/modes in the tester and launch it explicitly;
ensure the actual primitive is wrapped in `LiveRuntimeSurface` for help and paint
receipts. Keep the existing microphone/judge path; the diagnostic runtime lab is
not a replacement learner demo.

## Verify, then hand off

Use real-component tests for the actions actually advertised: phase refusals,
incorrect response/retry, checked advance, immediate committed DOM, stale item and
revision, duplicate commands, unsupported target/strategy, aid/fade history,
mid-work help/return with identical DOM/work, fresh transfer item, stop/unmount,
and the relevant speech/completion gates. Exercise `RuntimeTransport` plus the
rendering shell for visible receipts. Add relevant mode-specific cases rather
than assuming a test of one mode certifies all modes.

Run the primitive, shared runtime and affected host/runner tests, plus Lumina
typecheck. Extend `scripts/primitive-runtime-driver.mjs` with the family's actual
learner input path and add a focused Python journey. Reuse the bridge and frontend
capability endpoint. Keep component grading, adapters, runners and the runtime
real; isolate hardware/auth/persistence at the documented seams. Never inject a
successful verdict or fabricate a visible receipt to make a journey pass.

Drive the real model through wrong answer, requested actions, help/return and a
fresh successful item. Save the generated payload for replay. Three repetitions
are the roadmap's engineering smoke gate; inspect every transcript and receipt,
not only the summary. Assert the checked verdict immediately after the learner
action, before the model can execute another allowed action (for example retry).
Record early autonomous interventions explicitly; do not confuse a permitted retry
with a wrong grading result. Bound each wait and preserve failed reports. Distinguish
harness failures from primitive failures. A missing tool call is a failure to
execute the requested visible action even if the tutor says it happened.

When a service is unavailable, complete deterministic work and record the exact
unrun gate. Report actual browser and microphone acceptance separately; only a
human sitting closes the microphone/experience gate. Do not label the combined
planned lesson or other modes certified from a one-primitive journey.

Deliver a short report under `my-tutoring-app/qa/tutor-reports/` with supported and
unavailable actions, commands and results, raw evidence links, observed limitations,
and the next bounded session. Update the roadmap and handoff index where this
changes their stated adoption status; link existing HUMAN-CHECKS rather than
creating duplicate queues. Keep skill instructions grounded in the verified
implementation. Do not ship or write student records as part of this workflow.
