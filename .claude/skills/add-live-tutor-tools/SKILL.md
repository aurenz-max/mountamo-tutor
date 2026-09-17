---
name: add-live-tutor-tools
description: >-
  Give the Gemini Live tutor executable actions inside one primitive — advance
  after a checked answer, clear a wrong response, repeat the instruction, show a
  reminder, open a prepared example and return — by adding a runtime adapter that
  reuses the primitive's own learner handlers, then verifying every advertised
  action against the real component and a real model. Use when a primitive is
  mounted in /lumina/live-activity and the tutor can only talk about the screen.
  Not for catalog tutoring text (/add-tutoring-scaffold), Pip gestures
  (/add-pip-surface), or spoken-answer judging (/add-di-loop).
argument-hint: "<primitive-id> [actions: advance,retry,replay,scaffold,point] — e.g. counting-board"
---

# Add Live Tutor Tools to a Primitive

Make one primitive **controllable** by the live tutor. Today the tutor can say
"let's try that again"; after this skill it can actually clear the wrong response,
and the child sees the screen change. The model never mutates anything: it picks an
opaque ticket, and your adapter performs the change by calling the *same handler the
learner's own button calls*, so grading and progression stay where they already live.

L5-adjacent layer. The primitive must already render and grade correctly on its own,
and must keep working when `useLiveRuntime()` returns null.

## The dataflow

```
Gemini Live model
  │  copies ONE opaque actionId ticket  (epoch/revision/index) — no free-form params
  ▼
backend/app/services/live_runtime_tools.py         primitive-agnostic bridge:
  │  rebuilds the full scoped command only if that ticket is still advertised
  ▼
RuntimeTransport  (runtime/runtimeTransport.ts)
  │  dispatch(wireCommand) → TransitionReceipt {committed|stale|duplicate|…}
  │  then waitForVisible(runtime, receipt.state.revision) → the shell's paint receipt
  ▼
LiveLessonRuntime (runtime/LiveLessonRuntime.ts)   host policy: revisions, duplicates,
  │  execute()                                      exclusive ownership, completion gate,
  ▼                                                 ONE support detour per item
use<Primitive>Runtime  ← YOU WRITE THIS
  │  getTutorState() · getAffordances() · suspension? · supportArtifacts?
  ▼  calls the learner's existing handler
<Primitive/>  (grading, attempts, progression unchanged)
  wrapped by <LiveRuntimeSurface> so help paints and receipts are real
```

Two reference adapters, both real and shipped — copy the one whose teaching owner
matches yours:

| Your primitive | Owner | Reference |
|---|---|---|
| Tutor asks the questions; component grades a gesture + Check | `tutor` | `useNumberLineRuntime.ts` (93 lines) |
| A judged runner already asks, judges and advances (`useJudgedScriptRunner`) | `di-runner` | `useTenFrameRuntime.ts` (104 lines) |

The distinction decides the whole capability set. **A judged-runner primitive must
not advertise a tutor `advance`** — that is a second clock competing with the
runner's. TenFrame advertises `replay` and `scaffold` only, plus `canYieldForHelp`.

## When to use

- A primitive is mounted in the `/lumina/live-activity` host and the tutor has no
  executable actions there.
- An adopted primitive needs one more action (a reminder, a prepared example).
- The tester or the mounted driver needs to cover another primitive family.

## DO NOT use

- For an L0 primitive with no tutoring block — `/add-tutoring-scaffold` first.
- To make the tutor *judge* a spoken answer — that is `/add-di-loop`.
- To add catalog tutoring text, hints, or struggle responses — metadata does not
  create handlers, and this runtime ignores it.
- To port the whole catalog. One primitive per session; the handoff index
  (`qa/live-runtime-handoffs/README.md`) is not migration authorization.

Read [references/implementation-map.md](references/implementation-map.md) for source
locations, the driver protocol and the exact commands.

---

## Phase 0 — Read the owning layer, and check who else is editing it

1. Latest section of `src/components/lumina/docs/LIVE_LESSON_ROADMAP.md`.
2. `runtime/README.md` (adapter obligations) and `runtime/contract.ts` (the types).
3. The primitive's contract doc — `src/components/lumina/docs/contracts/<id>.md` if
   it exists — plus its component's handlers and grading path. Suspension and replay
   touch existing requirements (a timed flash, a phase that stops accepting taps),
   so run `/primitive-contract --check` before editing the component and add the
   runtime's own requirement afterward.
4. `git status` on the live-lesson files. **These files routinely carry another
   session's uncommitted work.** Inspect before editing; never revert what you find.

## Phase 1 — Pick the capability set

For every candidate action, answer four questions before writing a line: what phase
gate allows it, what the learner actually *sees*, what constitutes the commit, and
what assistance/exposure it produces. Advertise only what you can answer.

Your adapter advertises only the five `LocalAction` types. `contract.ts` types
`ExecutableAffordance.action` as `LocalAction`, so you **cannot** advertise
`request_support` or `return` — `LiveLessonRuntime.offers()` synthesizes those from
your `supportArtifacts` + `suspension` (Phase 3).

| Action | Gate | Real effect | Withhold when |
|---|---|---|---|
| `advance` | checked correct, not completed | next item, blank work | a judged runner owns progression |
| `retry` | last response incorrect | clears the response; **keeps** attempts + assistance history | there is no learner-facing clear; the runner's own correction path is not a tutor action |
| `replay` | active item | re-presents the same instruction; no regeneration, no reset | — |
| `scaffold` (+`direction:-1` fade) | per-strategy | one aid, described as what it is | strategy unsupported for this challenge type |
| `point` | target has a real handler | moves focus/marker | the tap *is* the answer gesture, or the only registration is a Pip target — Pip targets are a projection, not an action channel |

`offers()` filters silently, so four declaration mistakes make an action vanish
rather than fail loudly: `execute` is not a function; a `scaffold` carries no
`assistance`; an `assistance.level` is not an integer within the host's
`maxSupportLevel` (3); or `answerExposure` is other than `'none'` while the host
disallows exposure. The runtime's own detour offer declares `level: 6` and is pushed
after that check, so do not read 6 as an available level for your own aids.

Rules that come from the shipped implementation:

- Describe a text reminder **as text**. Number Line's `scaffold` description says
  "Show this text reminder … No points or answers are placed." Never promise a
  highlight or a moved object the renderer will not draw.
- `replay`'s spoken response belongs to the tutor. Only a certified runner that
  queues its own question may declare `responseSpeech: 'runner'`.
- Preserve the exact `objectiveId`, `planItemId` and **resolved** eval mode from the
  mount. `interactionMode` flattens distinctions like identify vs between; do not
  reconstruct the mode from it.
- Per-challenge-type scope is real: Number Line's reminder is jump-only, and its
  prepared example is advertised only for a single positive-integer subtraction
  (start 2–20, remove ≥1 and < start).
- Write down the actions you are **not** adding and why. That list goes in the report.

## Phase 2 — Write the adapter hook and edit the component

This is **not** one new file. Both references also change their component, and for a
judged-runner primitive that is the bulk of the work:

| Component edit | Why | Reference |
|---|---|---|
| `const runtime = useLiveRuntime()` and pass `runtime` into `useJudgedScriptRunner` | di-runner only, and **load-bearing**: the runner's `resume()` early-returns without it, so a support detour would suspend and never come back. Its speech holds and completion handoff read it too | `TenFrame.tsx:260`, `:481`; the option is `useJudgedScriptRunner.ts:145` |
| `runtimePlanItemId` (and `runtimeEvalMode` where the mode is a prop) | the mount must carry the resolved plan metadata | both |
| a render slot for the hint string the hook returns | a `scaffold` with nowhere to draw is a lie | the `runtimeHint` paragraph at `TenFrame.tsx:917`, `NumberLine.tsx:1015` |
| a presentation-cancel closure passed to the adapter | `suspend()` must clear the stimulus timers synchronously — TenFrame's `cancelPresentation` clears its one `flashTimeoutRef`; find every timer *your* component owns | `TenFrame.tsx:559` |
| `autoStart` | the host mounts without a mic-panel click | `TenFrame.tsx:565` |
| a learner-facing clear handler | only if you advertise `retry` | `clearResponse` in `NumberLine.tsx` |

Then the hook, `use<Primitive>Runtime.ts`, beside the component. **The block below is
the tutor-led shape** (`useNumberLineRuntime.ts`) — read the di-runner differences
under it before copying for a judged primitive:

```ts
const latest = useRef(options);
useLayoutEffect(() => { latest.current = options; });   // committed state, not a render guess

const commit = (change: () => void) => {
  if (!mounted.current || suspended.current) return false;  // refusal mutates nothing
  flushSync(change);                                         // imperative command boundary ONLY
  return true;
};

const mount = useMemo<RuntimeMount>(() => ({
  instanceId, planItemId, objectiveId, primitiveId, evalMode,
  adapter: { getTutorState, getAffordances, suspension, get supportArtifacts() {…} },
}), [instanceId, objectiveId, planItemId, evalMode]);     // STABLE mount

useLayoutEffect(() => { mounted.current = true; suspended.current = false;
  return () => { mounted.current = false; suspended.current = true; }; }, [mount]);
const { runtime, changed } = usePrimitiveRuntime(mount);
useLayoutEffect(() => { changed(); });                    // stale old tickets after each transition
useEffect(() => { if (completed) runtime?.requestCompletion(); }, [runtime, completed]);
```

Non-negotiable:

- **`execute()` returns `true` only after a synchronous commit.** A React setter
  followed by a read of the old closure is not an acknowledgement. Number Line uses
  `flushSync` at the imperative command boundary with refs published by a layout
  effect; its test asserts the new DOM and state *inside* dispatch, before `act`
  exits. Do not call `flushSync` from render or an effect.
- Publish semantic state from refs or an external store: `itemId`, `phase`, `task`,
  `completed`, `attemptNumber`, `correctness`, recent responses, `demand`, and
  `support` level/exposure. React state scheduled for later is not committed state.
- Every command rechecks item identity and revision. Never retarget an old command
  with a fresh snapshot.
- Stale controls refuse after stop, unmount, suspension or an item change.
- No async affordances. Promise-returning handlers are outside the contract; if the
  primitive needs one, settle the shared contract first rather than returning a
  false success.
**A judged-runner adapter has a different internal shape** (`useTenFrameRuntime.ts`):
no `commit`, no `flushSync`, no `react-dom` import, no `mounted`/`suspended` refs and
no layout-effect latch — the runner already owns committed state, so the adapter
reads `runner.runtimeControls.getState()` and delegates to `replay()`,
`suspend()`/`resume()`. It assigns `latest.current` during render, drives `changed()`
plus `requestCompletion()` from one keyed effect over the runner's observable fields,
calls `runtime.grantOwnership('runner')` while the runner is running, and exposes
help through `canYieldForHelp()` instead of `advance`. Gate that predicate against
perceptual modes (a timed flash cannot be re-shown mid-help) and against committed
gestures awaiting a verdict.

Do not copy `useTenFrameRuntime.ts` literally: it imports `askFor` from
`./tenFrameScript`, and the equivalent in another script module may be
module-private. Use an exported task-text helper, or export one.

## Phase 3 — The support detour (only if you can quiesce everything)

**The detour is off by default.** `new LiveLessonRuntime(epoch)` policy defaults to
`allowSupportArtifacts: false, allowAnswerExposure: false`, and `offers()` skips any
artifact whose exposure is not `'none'` — which both shipped artifacts are
(`'partial'`). Every real caller passes
`{ maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: true }`
(`LiveActivitySandbox.tsx`, `primitive-runtime-driver.mjs`, both runtime tests). A
test constructed without that policy is never offered `request_support`, and the
absence looks like your adapter's fault.

Before adding `suspension` and a `CounterSupport` artifact, inspect **every** timer,
pending judgment, queued cue and gesture handler, and quiesce them synchronously.
Hiding a DOM subtree is not suspension. Late and hidden learner events must be
rejected. `resume()` returns the learner to the same **item**, never a remount from
payload JSON, so the host keeps the same child mounted through `LiveRuntimeSurface`.
What it restores differs by owner, and you must choose deliberately: the tutor-led
adapter restores the pre-detour phase, response and checked state, while the judged
runner deliberately discards the abandoned judgment — it re-arms at `asking` and
re-asks the item once the return turn and its visible receipt have settled. Fading
and return retain assistance history, and the runtime allows one detour per item.

The artifact is **prepared host data** (`provenance: 'prepared'`); the model may only
name an advertised ID. Derive it from the real payload, run
`validateCounterSupport`, and check quantities and answer exposure yourself — the
runtime checks structure, not whether your example accidentally matches the answer.

`LiveRuntimeSurface` draws the artifact as `total` circles, the first `removed` of
them marked — `+` placeholders to fill for `'make-ten'`, crossed out otherwise —
plus one sentence keyed to `operation`: `'make-ten'` → `a + b = total`,
`'count'` → `total counters`, otherwise `total − removed = …`. Those three are the
whole renderer. **Withhold the artifact for every mode those shapes cannot state
truthfully** — a "give me N" or "recount what moved" task has no honest rendering
here, and inventing one is a pedagogical lie the runtime will not catch.

## Phase 4 — Register it in the host and the tester

| Layer | File | What to add |
|---|---|---|
| Union + validation | `live-activity/activityContract.ts` | the id in `ActivityRequest['primitiveId']`, its modes, `validate`, `initialState` |
| Capability envelope | `LIVE_ADAPTERS` in the same file | `teachingOwner`, `modes`, `canAdvance`, and `guidance` the model reads. `di-runner` **must** set `canAdvance: false` — the Python validator rejects the envelope otherwise |
| Spec | `liveActivitySpec.ts` | nothing usually — it maps `LIVE_ADAPTERS` |
| Generation + mount | `LiveActivitySandbox.tsx` | the mount is a **two-way ternary** on `primitiveId` with a per-family enable checkbox and lesson-primitive state. A third family is a small restructure, not an added row. `livePlan.ts` needs nothing — it reads the catalog |
| Routes | `api/lumina/live-activity/route.ts`, `capabilities/route.ts` | resolved metadata for both paths, **and** the two existing `primitiveId === 'ten-frame'` branches: the grade gate and the `?probe=1` DI drive plan. A judged-runner adoption needs the plan branch widened (check `service/qa/di/diDrivePlan.ts` — your primitive may already be a registered DI port) |
| Python bridge | `live_runtime_tools.py`, `live_activity_tools.py` | **nothing primitive-specific.** It validates the envelope and correlates receipts |

`guidance` is where the model learns what not to claim ("Never claim to move or
highlight points"). Capabilities and tool guidance live beside the frontend handler;
the bridge stays primitive-agnostic — no `primitiveId ===` branches, no transcript
filters. Expose the family and modes in the tester's Activity picker and launch it
explicitly. The diagnostic lab at `/lumina/live-activity/runtime` is not a learner
demo and is not a substitute for the real host with its microphone and judge.

## Phase 5 — Real-component tests

`<Primitive>.runtime.test.tsx`, real component, real adapter, real runtime. Cover
only what you advertised, but cover all of it:

phase refusals · incorrect response then `retry` · checked `advance` · committed DOM
*inside* dispatch · stale item · stale revision · duplicate command · unsupported
target/strategy · aid then fade with history retained · mid-work help and `return`
with identical DOM and work · a fresh transfer item · stop and unmount · the
speech/completion gates that apply. Exercise `RuntimeTransport` plus the rendering
shell so visible receipts are real. **Add a case per mode you advertised** — one
mode passing does not certify the others.

## Phase 6 — Drive it, then hand off

```powershell
# from my-tutoring-app
npm.cmd test -- --run src/components/lumina/components/live-activity src/components/lumina/primitives/visual-primitives/math/NumberLine src/components/lumina/primitives/visual-primitives/math/TenFrame.runtime.test.tsx src/components/lumina/hooks/useJudgedScriptRunner.test.tsx
npm.cmd run typecheck:lumina        # must be 0
```

1. Extend `scripts/primitive-runtime-driver.mjs` in three places: the `families`
   map, a native input command for the primitive's **actual** learner input path
   (Number Line dispatches a real SVG click then clicks Check; TenFrame reduces real
   speech), and the hardcoded `dom` presence block at the end of the emit — it only
   probes for the number line and the frame today. Do not route a new primitive
   through TenFrame's speech path. JSON on stdout, diagnostics on stderr.
2. Add a focused Python journey in `backend/tests/tutor_live/`, copying
   `run_ten_frame_runtime.py` for a judged runner (it has the `--startup` flag that
   exercises the real activity-request and silent mount handoff) or
   `run_number_line_runtime.py` for a tutor-led one. Reuse the bridge and the
   frontend capability endpoint. Keep grading, adapters, runners and the runtime
   real; isolate audio, auth and evaluation writes at `primitive-runtime-seams.tsx`.
3. Drive the real model through: wrong answer → requested actions → help/return →
   a fresh successful item. **`--runs 3` is the roadmap's smoke gate.** Save the
   generated payload and replay from it so the run does not depend on a new
   generation.
4. Read every transcript and receipt, not the summary. Assert the checked verdict
   immediately after the learner action, before the model can fire another allowed
   action. Record early autonomous interventions explicitly — a permitted `retry` is
   not a wrong grade. Bound every wait and keep failed reports.
5. Report under `my-tutoring-app/qa/tutor-reports/`: supported actions, unavailable
   actions with reasons, commands and results, raw evidence links, observed
   limitations, next bounded session. Update the roadmap and
   `qa/live-runtime-handoffs/README.md` where adoption status changed, and link the
   existing HUMAN-CHECKS item rather than opening a parallel queue.

If a service is down, finish the deterministic work and name the exact unrun gate.
Browser acceptance and microphone acceptance are reported **separately**, and only a
human sitting closes them. One primitive's journey never certifies the combined
planned lesson or the other modes.

---

## The four failures this skill exists to prevent

**A false success.** `execute()` returns true, the model announces the change, and
nothing moved — because a React setter was treated as a commit. The tutor then
narrates a screen the child is not looking at. Commit synchronously, or refuse.

**Metadata without a handler.** An action appears in `guidance` or a catalog block
but no `ExecutableAffordance` backs it, so the model requests it and gets a refusal
mid-lesson. For the five local actions, `getAffordances()` is the only authorization:
if it is not in that array with a callable `execute`, it does not exist. (`return`
and `request_support` are the exception — the runtime offers and performs those
itself through `suspension`, with no `execute`.)

**A missing tool call read as success.** The tutor says "I've cleared it" and never
dispatched. That is a failure of the requested visible action, however fluent the
narration. Grade the receipts, not the transcript — and never inject a verdict or
fabricate a receipt to make a journey pass.

**A primitive-specific patch in shared code.** A Python branch or transcript filter
that compensates for one primitive's timing. If a shared assumption breaks, fix the
shared contract and regress **both** execution families before expanding adoption.

One more, about evidence: a paint opportunity in JSDOM (two animation frames) is
machine evidence that the shell acknowledged a revision. It is not proof that a
person saw anything. Do not ship or write student records from this workflow.
