# Live activity sandbox

The infrastructure-first runtime lab is at `/lumina/live-activity/runtime`.
See its [contract and adoption guide](runtime/README.md) and the
[focused migration handoffs](../../../../../qa/live-runtime-handoffs/README.md).
Existing sandbox primitives have not yet adopted that runtime.

Open Lumina → Developer Tools → **Live Activity**, or `/lumina/live-activity`
on the Next development server. The default experience is now **Learn with Ten
Frame**. Sign in, choose a lesson and a K–2 grade, then press **Start lesson** and
allow the microphone. The tutor requests the full generated Ten Frame activity
automatically; its DI runner begins without a second Start click or spoken prompt.
Make Ten is the default. Other choices are build, subitize, operate, decompose,
build_teen and decompose_teen. The full existing component owns the frame, response
judging, corrections, automatic progression and completion.

The Sandbox tools disclosure retains the optional number-line and direct visuals.
Disable Ten Frame there to return to open conversation. “Ask for another example”
requests another activity of the current kind without reconnecting.

The backend must run with `ENVIRONMENT=dev` (or development/local/test). Both the
page and its generation endpoint return 404 in a production Next build. Existing
tutoring sessions do not register these tools unless they opt into the sandbox.

## Planned lesson (roadmap phase 1)

Open **Planned lesson from a lesson package** and load a JSON file from
`qa/lesson-bench/packages` (produced by `/api/lumina/topic-trace?package=true`).
`livePlan.ts` projects its objective blocks, in manifest order, into plan items. Each
item keeps its objective, the lesson resolver's `config.targetEvalMode`, the prepared
content and its package provenance. A component is listed as unavailable, with the
reason, when it has no live adapter, no prepared content, no resolved mode, a mode
missing from the catalog, content outside the mode's catalog `challengeTypes`, or
content that fails the adapter's validation. Nothing is regenerated.

Start sends the tutor only item identities (id, primitive, title, mode, objective).
Generation tools and direct visuals are not declared in this mode; the tutor gets
`start_plan_item(itemId)` and, when a number line is planned, `advance_activity`.
`[LESSON_START]` asks for the first item. The browser mounts only the next unfinished
item and rejects any other start without touching the current screen.

Adapters (`LIVE_ADAPTERS` in `activityContract.ts`) name each family's validator,
initial tutor state and teaching owner. The number line is tutor-led. Ten Frame's DI
runner owns its turns and starts through the existing `activity_ready` handoff.

Completion is the primitive's own `onEvaluationSubmit`; with no EvaluationProvider
nothing is written. The browser records the outcome and sends `plan_item_complete`
with the next item; the bridge relays it once as an `item_complete` receipt that
gives the tutor the turn to move on or close.

Known gaps (roadmap G1–G3, phase 1 stopped here): that receipt races a DI runner's
closing cue; the primitive's own completion speech still goes out alongside it; and
a DI runner is handed ownership on mount even while the tutor is mid-sentence. Fix
these at the source (LA-04), not with guards in the bridge loop. Evidence:
`qa/tutor-reports/live-lesson-plan-2026-09-17.md`.

Machine drive (real Live, simulated browser):
`venv/Scripts/python tests/tutor_live/run_live_lesson_plan.py --package <package>`
from `backend`, with `--reverse` for the tutor-led → DI order. Its fixture comes from
`node scripts/live-lesson-plan-fixture.mjs <package>`.

## Execution boundary

### Full Ten Frame lesson

Start queues one hidden `[LESSON_START]` intent after the real session-ready event.
Gemini calls `request_activity(primitiveId=ten-frame, mode=...)`; the same generation
registry supplies the full component payload. Validation runs the actual DI item
builder and rejects payloads whose challenges would be dropped. The first item's
`challengeType` and `stimulus` ground the catalog scaffold.

Ten Frame's preparing and mounted tool responses use `SILENT`: its scripted runner
owns the opening, so an improvised tool-result introduction would create a competing
turn. The backend sends a correlated `activity_ready` handoff after accepting mount.
Only then does the component's optional `autoStart` begin its real DI runner, after
the shared connection, microphone and active instance are ready. Existing TenFrame
consumers retain their manual start behavior because the prop defaults to false.

The runner supplies `[TF_ITEM]` cues, response judging and correction contracts,
hands stillness commits, automatic progression and `[TF_COMPLETE]`. The generic
`advance_activity` tool rejects Ten Frame; it must not bypass this runner. The same
Live session and microphone are retained. No EvaluationProvider is added, so this
remains local sandbox practice. A denied microphone permission requires enabling
it; the session does not fabricate a voice response or claim the lesson started.

For repeatable QA, the development generation endpoint accepts `?probe=1` and
returns the existing production `diDrivePlan` for the same generated payload.

### Direct visuals

These four optional `NON_BLOCKING` tools are enabled by the new direct-visuals
checkbox. You can turn off Number line to test them alone. They are sandbox
teaching surfaces; they do not launch the full catalog DI teaching scripts.

| Tool | Parameters | Student interaction |
| --- | --- | --- |
| `show_counters` | count 0–20, ten-frame or rows layout, instruction | Tap to cross out/restore counters |
| `show_fraction` | numerator, denominator 2–12, instruction | Tap equal parts to shade/clear |
| `show_letter_tiles` | 1–12 letters or graphemes, instruction | Tap to select tiles; `sh` can be one tile |
| `highlight_visual` | mounted instance ID, zero-based item indices | Tutor points without clearing student work |

Show tools validate parameters and send them directly to React: no generator
fetch and no second LLM call. A post-paint receipt returns actual visible state
using the original function's name. Student taps stream silent state on that open
tool response. Pointing returns `updated` only after the highlight has committed.
Each new show call replaces the workspace and resets student work; highlighting
preserves it. There are no Check or Next buttons on these surfaces. The tutor can
ask a question, discuss a spoken answer against visible state, then request a new
visual. These conversations do not produce verified assessment or mastery writes.

Try the preset buttons, then say “Highlight the third counter” or “Show another
word.” The full number-line generator and its guarded Next control remain available.

### Generated number line

1. Gemini Live calls `request_activity(primitiveId, topic, intent, mode)` with
   `NON_BLOCKING`. Only number-line and its five existing modes are allowed.
2. The backend correlates the call ID and sends `activity_request` to the browser.
   It also returns a continuing `preparing` tool response with `WHEN_IDLE`, letting
   the tutor give a short concept/strategy setup during generation. This receipt
   explicitly says the new activity is not visible; it carries no generated values.
3. The browser calls the development endpoint `/api/lumina/live-activity`, which
   validates the request and invokes the existing `generateComponentContent`
   registry. The generated range, challenge structure, and jump arithmetic are
   checked before rendering. Grade and difficulty are application-controlled.
4. The real NumberLine mounts. A receipt after its commit and two animation frames
   sends `activity_result: mounted`, including the actual content and catalog
   tutoring scaffold. Fetch completion alone never acknowledges visibility.
5. The backend sends the matching tool response with `WHEN_IDLE`. That call stays
   open for `SILENT` structured state updates. Existing correctness/next-item cues
   still use the normal tutor channel. A new mounted activity closes the old stream.

Keep new-activity completion on `WHEN_IDLE`: in the completion comparison,
`SILENT` left both sampled sessions without an exercise introduction. The short
preparing response lets speech start during generation; it does not guarantee
continuous speech or reduce generator runtime. Evidence and limits are recorded
in `qa/tutor-reports/live-activity-pause-fix-2026-09-16.md`.

Newer requests supersede pending generation. Model cancellation, learner cancel,
disconnect, and timeouts invalidate pending work. Aborting a fetch prevents a late
mount; it does not guarantee cancellation of an already-started generator API call.
On a Gemini connection restart, pending requests and tool streams are discarded.
The existing session resume mechanism retains conversation; a new activity request
opens a new state stream. This first slice does not restore in-flight tool work.

The sandbox deliberately has no EvaluationProvider. The existing primitive checks
answers locally and emits feedback, but sandbox attempts do not update mastery.
The diagnostic timeline logs teaching intent, generation duration and mount duration.

After checked success, Live can call `advance_activity(instanceId, challengeIndex)`.
The component requires a matching current index and a correct recorded answer,
then reuses the Next button's progression. Duplicate and stale commands are rejected.
The browser returns the new visible state after two animation frames; only that
receipt prompts the tutor to introduce the next challenge. This avoids generating
a whole new activity for each item. The Next button remains a manual fallback.
Spoken answers alone do not move markers or record correctness in this experiment.

The sandbox defaults to spoken English. An explicit learner request can change
language; short foreign-language answers or ambiguous transcripts do not request
a language switch.

## What this experiment proves

The tutor can bring an existing activity into an ongoing conversation, teach from
its real content, observe student interactions, and request another activity.
It exposes guarded number-line progression plus direct counters, fraction bars,
letter tiles, and pointing on those direct visuals. Number-line pointing/reveal/
jump-demonstration commands and full DI activity handoffs remain future work.
It also does not replace curriculum planning or delegate mastery decisions to Live.

## Verification

Frontend: run Vitest on this directory, `NumberLine.jump-evidence.test.tsx`, and
`useLuminaAI.enabled.test.tsx`. Backend: run
`python -m unittest discover -s tests/tutor_live -p 'test_live_*.py'`.

With both services running, from `backend` run
`python tests/tutor_live/run_live_activity.py --runs 3`. It uses the existing test
account, the real Gemini Live endpoint, and real primitive generation. It explicitly
simulates the browser mount receipt; React tests separately exercise the mount and
cancellation contract. The saved report must be read for tutor grounding, timing,
and answer leakage. Browser microphone/audio quality still requires a human try.
