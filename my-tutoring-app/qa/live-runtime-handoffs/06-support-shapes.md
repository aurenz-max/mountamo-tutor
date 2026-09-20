# Handoff: support shapes (LA-10a) after the contrast pair

Written 2026-09-18 for the next session on the live-lesson runtime. Read
[contrast-pair-comparison-builder-2026-09-18.md](../tutor-reports/contrast-pair-comparison-builder-2026-09-18.md)
first; this file says what to do next and why, not what happened.

## Where it stands

The runtime shell draws two prepared support shapes: `counter-example` (one row, states HOW MANY)
and `contrast-pair` (two stacked counter rows, unpartnered tail ringed, states a relationship
BETWEEN two collections). Comparison-builder prepares a nearby contrast pair per item and the real
Live model drove it 3/3: called on cue, painted, described with both counts and the leftover,
returned with the child's wrong answer intact, then advanced and completed. Nothing is committed;
`/ship` will slice it with the rest of the uncommitted registry work.

The user's design ruling from this session: the unit of work is a **shape** (schema, deterministic
renderer, leak rule, alt text) reused across primitives, never an artifact per primitive. The
artifact is the third rung of help, after rephrase and scaffold. Generated raster is illustration
only.

## 1. Theme the artifact shell with the Lumina kit — DONE 2026-09-18

Done and driven in the real host, not the lab. `LiveRuntimeSurface.tsx` now draws both shapes
inside `LuminaCard surface="elevated" topAccent="indigo"` with token colours; the counter-example
row puts its marked counters last so it reads in the order of its sentence ("6 + 4"). Host shots:
`qa/tutor-reports/contrast-pair-host-example-2026-09-18.png`,
`qa/tutor-reports/ten-frame-example-host-example-2026-09-18.png` (and `-card-`, `-task-`,
`-returned-`).

The host drive found one defect the JSDOM drive could not: `LiveLessonRuntime.register` threw
"The current owner has not released the activity" on the FIRST mount whenever the tutor's turn was
still open (its greeting plus its own `request_activity` call). The error boundary reported "could
not render", the tutor re-requested, and the lesson took 4 to 12 failed mounts to start. `register`
now lets an empty workspace mount under an open turn; the completed-to-next guard is unchanged.
Regression test in `LiveLessonRuntime.test.ts`. After the fix: first-try mount in about 6 s, zero
page errors, three host drives.

Two behaviours to expect in a sitting: the tutor sometimes returns from the example by itself and
sometimes waits for "Return to my task" (seen both ways); and the example is offered once per item,
so "Show an example" disappears after the return until the next item.

The original notes for this item follow.

User review of the screenshot, verbatim in substance: *functionally good, but it does not follow
Lumina design themes; it looks like a popup into a static page and does not integrate into the
existing theme.*

The cause is plain. [LiveRuntimeSurface.tsx](../../src/components/lumina/components/live-activity/runtime/LiveRuntimeSurface.tsx)
draws the `<aside>` with raw Tailwind (`rounded-xl border border-indigo-300 p-6`) and raw cyan
and amber circles. The kit rule in `src/components/lumina/CLAUDE.md` applies to runtime shells as
much as to primitives, and the precedent is one file away: `DirectVisual.tsx` builds its surface
from `LuminaCard`, `LuminaCardHeader`, `LuminaCardTitle` and `LuminaCardContent`.

What to change:

- Keep the outer `<aside aria-label="Worked example">`. The harness probe
  (`SHARED_PROBES.support`), `LiveRuntimeLab.test.tsx`, and every `*.runtime.test.tsx` that opens
  a detour resolve it by that role and name. Keep `data-artifact-kind`, `data-contrast-row` and
  `data-contrast-highlight`; the journey probe `contrastRows` and the screenshot script read them.
- Inside it, `LuminaCard surface="elevated"` (tokens name `elevated` for focal surfaces) with a
  `topAccent`, then `LuminaCardHeader` / `LuminaCardTitle` for the title and `LuminaCardContent`
  for the rows and caption. Keep `role="img"` with the alt text on the rows container.
- Counters from `accentSolidBg` / `accentBorder` in `ui/tokens.ts`, not literal `bg-cyan-400`
  and `bg-amber-300`. Never build those class names by interpolation; the tokens file says why.
- "This is a worked example. Your task is saved." as muted secondary text (`text-slate-400`) or a
  `LuminaCallout`, not a bare paragraph.
- The counter-example branch gets the same treatment in the same edit, so the two shapes share one
  frame.

Then run, from `my-tutoring-app/` with an absolute `cd`:

```
npm run typecheck:lumina
npm test -- --run src/components/lumina/components/live-activity src/components/lumina/primitives/visual-primitives/math/ComparisonBuilder.runtime.test.tsx
```

and re-shoot. The lab at `/lumina/live-activity/runtime` is a bare infrastructure page by design,
so a lab screenshot will still read as un-themed around the card. For the user's review, shoot
the real host at `/lumina/live-activity` (Activity: Comparison Builder, Lesson: Which group has
more, Start lesson, then ask the tutor to show an example), which needs a signed-in Live session
per the headless-Chrome recipe in memory. The lab shot is enough to check the card itself.

The scratchpad script used this session, for the lab:

```js
import { chromium } from 'playwright-core';   // npm install playwright-core@1.52.0 in the SCRATCHPAD
const exe = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto('http://localhost:3000/lumina/live-activity/runtime', { waitUntil: 'networkidle', timeout: 180000 });
await page.waitForTimeout(4000);
await page.getByRole('button', { name: 'A contrast pair: 6 against 4' }).click();
await page.waitForTimeout(1500);
await page.locator('aside[aria-label="Worked example"]').screenshot({ path: '<repo>/my-tutoring-app/qa/tutor-reports/contrast-pair-lab-<date>.png' });
await browser.close();
```

## 1b. Third shape: `step-sequence` (explanation) — DONE 2026-09-18, ten-frame `make_ten` pilot

`StepSequenceSupport` in `contract.ts`: two to four frames, each a list of `{ count, tone }`
segments (plain, added, empty, marked, crossed) plus one caption, drawn on one column grid so a
counter keeps its column between steps. Validator `validateStepSequenceSupport`, renderer branch in
`LiveRuntimeSurface.tsx` (`data-step-frame`, `data-step-tone`), lab fixture `seven-take-two-steps`.
Ten-frame prepares "Fill another frame, step by step" for `make_ten` on a different frame
(`tenFrameExample`); subtract and build keep the single row until this pilot has had a sitting.
Every `request_support` choice now carries `purpose` (`SUPPORT_PURPOSE`), and
`RUNTIME_INSTRUCTION` tells the model to pick by purpose and to say each step's caption in order.
Host drive, real model: opened on request, said the three captions in order, did not say the saved
task's answer, return restored the frame. Shot: `qa/tutor-reports/step-sequence-host-card-2026-09-18.png`.
One drive only; `--runs 3` through `run_primitive_runtime.py` is owed. Backend was restarted
(still no `--reload`) to load the instruction.

Not built: tutor-paced reveal (one step at a time). It needs an `advance` offered in `support`
status and a `supportStep` in the snapshot; the static stack was chosen first because a model that
stalls on a step action leaves the child on a half-shown explanation.

## 1c. Generated pictures (LA-10b trial) — BUILT 2026-09-18, ten-frame + comparison-builder

USER RULING this session: use Gemini image generation (the machine-profile model); the test is
whether the tutor writes the right description and whether the picture helps the child do the
problem. Evidence and findings: `qa/tutor-reports/generated-support-picture-2026-09-18.md`.

SUPERSEDED 2026-09-18 by LA-12 M0. `generate_visual_support` no longer exists; a picture is one
delta of one tool, `compose_move { obstacle, delta, representation, nextAction, values, operation?,
description? }` (`live_runtime_tools.py`, declared when the host sends `teachingMoves: true`). The
backend relays; the browser does the rest: `RuntimeTransport.composeMove` → `runtime.composeMoveRefusal`
(policy, one detour per item, `adapter.drawsTask(values)`, and non-redundancy against the workspace's
own representation) → for `illustrate` only, `/api/lumina/live-activity/support-image` (draw, vision
check, one corrective redraw) → `runtime.openComposedMove` → the same returnable shell (bytes stay out
of the snapshot). Every other delta is built from the tutor's numbers and commits at once. Host:
"Help me another way" button, "Teaching moves" checkbox, and every obstacle, checker read, timing and
refusal in the Experiment timeline. Contract: `runtime/moveContract.ts`, spec
`src/components/lumina/docs/LIVE_TEACHING_MOVES.md`.

An adapter opts in by declaring `representation`, `alternateRepresentations` and `drawsTask(counts)`; without them the runtime refuses. Do NOT sweep
the description's prose for numbers: the first version did and refused a correct description
because it said "two on the bottom".

Next, in order: (a) mic sitting; (b) a `generate` intent in the Python journey harness and an
`exampleTaught` judge for generated pictures (the tutor omitted the counts when speaking in one of
two shown pictures); (c) show rejected drawings to the reviewer in the host; (d) a literacy adopter
(b/d passed the route probe).

## 2. Gate the `[ANSWER_INCORRECT]` answer leak under the runtime

`ComparisonBuilder.tsx` and `NumberLine.tsx` still send *"correct is less. Left has 10, right has
12"* (and the targets, for number-line) to the tutor on a wrong check. The adapters' mounted state
withholds exactly that, and the runtime's `evidence` already carries the attempt. Under
`useLiveRuntime()`, send the attempt without the key, or nothing. Same pattern as the
`runtimeAdvanceClause` this session added to the four `[ANSWER_CORRECT]` sends. Executor:
`/add-live-tutor-tools` on both primitives; re-drive comparison-builder `--runs 3` after.

## 3. A second adopter of `contrast-pair`

The proof that the unit of work is the shape is a second primitive using it with no renderer
change: an `adapters`-side preparer, a `supportArtifacts` getter, an `example`/`return` prompt and
an `exampleTaught` judge in `liveJourneySpec.ts`. Ordinal-line (a short line with first vs last
ringed) is the nearest fit among the twelve; it would need a `positions` panel kind, which is an
additive member of `ContrastPanel`. Number-tracer's digit is the answer on every mode, so a 6/9
glyph contrast there needs a per-mode exposure gate first.

## 4. Tutor-parameterised requests

Prepared-by-host is the wire: the model picks an advertised `artifactId`. The intended core is
`request_support { shape, params }` validated by the runtime against the shape schema and swept
with `statesNumber` (`runtime/liveScaffolds.ts`) against the item's answer. That changes
`parseTutorCommand`, the Python tool declaration in `backend/app/services/live_runtime_tools.py`,
and the transport. Do it after 2 and 3, not before.

## 5. The sittings

No browser or microphone sitting has been done on this lesson. The drive is JSDOM with simulated
paint; the screenshot is the lab. Only `compare_groups` was driven; the other two modes with a
pair are unit-tested only.

## Environment left by this session

- One `next dev` on :3000, started by this session after both earlier instances were stopped
  (:3000 had been hung for two sessions, :3001 served 404 for its own client chunks). Probe before
  starting another: `curl -s -m 120 -o /dev/null -w "%{http_code}" http://localhost:3000/api/lumina/topic-trace`.
- Backend on :8000 is DOWN. The instance the contrast-pair session started without `--reload` has
  since exited. Start it before a live drive:
  `cd "<abs>/backend" && venv/Scripts/python -m uvicorn app.main:app --reload --port 8000`.
- Drive evidence: `qa/tutor-reports/comparison-builder-runtime-compare_groups-live-2026-09-18.json`
  (0/3, the advance stall) and `…-advance-clause.json` (3/3).

## Files this slice touched

`runtime/contract.ts`, `runtime/LiveLessonRuntime.ts`, `runtime/LiveRuntimeSurface.tsx`,
`runtime/runtimeFixture.ts`, `runtime/README.md`, `liveJourneySpec.ts`,
`adapters/comparisonBuilderLive.ts`, `math/comparisonBuilderExample.ts` (new),
`math/useComparisonBuilderRuntime.ts`, `math/ComparisonBuilder.tsx` (advance clause),
`scripts/primitive-runtime-driver.mjs` (`choose` verb), the two runtime test files,
`docs/LIVE_LESSON_ROADMAP.md`, `WORKSTREAMS.md`.
