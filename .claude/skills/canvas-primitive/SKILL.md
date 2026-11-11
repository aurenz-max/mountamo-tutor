---
name: canvas-primitive
description: >-
  Author, polish, extend, check and promote a canvas: a small HTML+JS program a child operates (drag, place, connect,
  set, run), hosted by the `agent-canvas` primitive in a sandboxed frame with Check, sounds, the live tutor's scene and
  the evaluation record already wired. Two authors write to one spec and pass one gate: Gemini in the app (live,
  `authorCanvas`) and Claude Code (this skill). Use to turn a saved canvas run into a spec, to add 3-5 problems to one
  program through its params, to fix a canvas that leaks the answer or gives its own verdict, to write a new canvas for
  an objective no primitive fits, or to decide whether a canvas should become a native primitive. Not for the host
  primitive's tutor wiring (/review-live-wiring), the author loop itself (/agent-primitive), or a native React
  primitive (/primitive).
---

# Canvas primitives

> **Paid Gemini runs are the user's.** Live sessions and tutor replays are hook-blocked. `canvas-check` and
> `canvas-payload` call no model. `canvas-author` and the tester's Author button call Gemini (about $0.05-0.20 a run,
> metered against the daily cap): report the spend.

## What this is (USER 2026-11-10)

A canvas is a program, not content. The host (`agent-canvas`) gives every canvas the same things for free: the prompt,
Check, the verdict, sounds, the tutor's scene, and the evaluation record that reaches the student profile. So a new
interactive experience costs one program file and one spec, not a React component, types, catalog entry, generator,
card, boss and tester.

The value is the harness and the bar, not any one canvas:

- **One spec.** A folder with `program.tsx` and `spec.json` (problems, each with params, ask, goal, proof, miss).
- **One gate.** `scripts/canvas-check.mjs` plays every problem in headless Chromium with real input. No author is
  trusted: Gemini's run, Claude's edit and a person's edit all pass the same plays.
- **Two authors.** Gemini writes a canvas live from an objective (discovery, 1-4 min). Claude Code writes or polishes
  one from the same contract (this skill). A saved Gemini run is the first draft of a spec.
- **One host.** `core/agent-canvas/` renders any spec that passed. Nothing in it names a canvas.

A canvas with no eval-mode ladder is correct (USER 11-10): the mode `canvas` is the capability. Difficulty is carried
by the problems of a spec, in order.

## The program contract

The program is TSX defining `function Display({ params, lumina })`. No imports. React hooks and the display kit are in
scope (`service/gen-display/sdkSource.ts` is the reference: `Panel`, `Stack`, `Row`, `Formula`, `Handle`, `svgPoint`,
`Slider`, `Choice`, `Button`). It runs in `sandbox="allow-scripts"` with no network and no storage.

| The program must | Why |
|---|---|
| Read every value that varies from `params`, with a default | One program serves many problems; the gate fails a param the source never reads |
| Call `lumina.goal(met)` in an effect on every state change | This is the only key. True for every way of succeeding, false otherwise |
| Call `lumina.scene({...})` with plain facts of what is on screen | The tutor reads it. It never holds the verdict, the answer, or a value the child cannot see |
| Give every element the child acts on an `id` | Plays address elements by CSS selector; the shell names taps and drops for sound |
| Start with the goal unmet and never show whether the child is right | The host owns the verdict. No green line, no "Correct!", no colour that changes when the goal is met |
| Compute every shown value from state | A literal result is a leak or a bug |
| Stay 720px wide, under 640px tall, 44px touch targets, readable on #0f172a | The stage and the frame |

The host owns: prompt (`ask`), Check, verdict, Try again, Start over, sounds, tutor scene, evaluation submit.

Two idioms that bite: draw repeated parts with render functions (`{pile(i)}`), not components declared inside
`Display` (`<Pile/>`), which remount on every render and drop CSS transitions; and size a dot grid to its count
(`repeat(min(n, 5), ...)`), or a small pile sits off-centre.

## The bar (what a canvas must meet to be played by a child)

Code-checked by `canvas-check` (blocking): compiles; runs clean; goal false at rest; scene reported; the proof ends
with the goal met; the miss ends with it unmet; every param key is read by the source; no two problems share a first
screen; each problem has its own ask. Advisory: a scene key that reads as a verdict (`isGoalMet`, `correct`).

Read by the author from the screenshots in `specs/<id>/plays/` (not code-checkable, so do it every time):

1. **Hands in the world.** The child's action is the idea of the objective. Buttons under a picture is a
   multiple-choice question.
2. **No match-the-readout.** If the screen shows the target beside a live copy of the same quantity ("Target 3/4",
   "Current 3/4"), the child can wiggle until they match. Keep the readout on the first problem if it teaches the
   relation; hide it behind a param on later problems, and drop it from the scene when hidden.
3. **No verdict before Check.** Look at the proof screenshot: nothing differs in colour or words from the miss
   screenshot except the child's own work.
4. **The miss is a real misconception.** Each problem's miss is the wrong attempt a child would plausibly make
   (rise and run swapped, sign dropped, the biggest of everything), not a random drag.
5. **Problems are a progression.** 3-5 problems, each changing one structural thing (a whole-number answer, then a
   fraction, then support removed, then a negative). Never the same task with new numbers only.
6. **The ask never says how.** It names the task for this grade and nothing else. The goal text is for the record.
7. **Readable.** Every label can be read in the screenshot, nothing overlaps at the edges of the stage.
8. **Draw what the simpler activity cannot.** Name the nearest simpler activity (three addends: a number bond; slope:
   rise over run read off a grid). The canvas must draw what makes this objective different from it, or it is the
   simpler activity with more steps. Two Ways (11-10) only felt right once each way was drawn as a grouping tree and
   the end showed two trees with one total.
9. **Each quantity once, one phase at a time.** Never draw the same pile, number or equation in two places (a picture
   plus a work area plus a text record of it). A task with steps shows only the current step; a finished step
   shrinks to a small marker; side-by-side comparison comes at the end.
10. **A control shows only when it can act.** A keypad while the child is choosing, or a button that does nothing in
    this step, is dimmed or hidden.

## The stages

### 1. Get a first draft

- **From Gemini (discovery):** dev panel "Canvas (agent)" → Author, or
  `node scripts/canvas-author.mjs --topic="..." --grade="grade 4" --objective="..."`. The run saves to
  `qa/canvas/<stamp>-<slug>.json`. The user plays it in the tester and says which ones are worth a spec.
- **From Claude (no model call):** write `qa/canvas/specs/<id>/program.tsx` and `spec.json` directly against the
  contract above. Read one existing spec's program first for the kit idioms.

### 2. Make the spec

```bash
cd "<abs>/my-tutoring-app" && node scripts/canvas-check.mjs --from=<saved run name> --id=<spec id>
```

This writes `qa/canvas/specs/<id>/program.tsx` (the saved source) and `spec.json` with the run's one problem.

### 3. Polish the program against the bar

Read `program.tsx` whole and the rest and proof screenshots. Fix what the bar names: remove the program's own verdict,
move hard-coded values into `params`, add the param that removes a support, take the verdict and hidden values out of
the scene. Record each change in `spec.json` `polish[]` in one line. Do not restyle a canvas the user approved.

### 4. Add problems

Add 2-4 problems to `spec.json`. Each needs `params`, its own `ask` and `goal`, a `proof` and a `miss`
(`PlayStep[]`: `click`/`drag` with a CSS `target` and `to` or `dx`/`dy` in page pixels, `set` with a kit control's
`label` and `value`, `press`, `wait`). Negative `dy` is up. Add `"shot": "<name>"` to the step that ends each
phase of the proof; the check saves `<n>-proof-<name>.png` so the screens between rest and the end are read too
(advisory when a proof has more than 6 steps and none). Aim drags from the run's reported scene, not by guessing:
the check prints the scene a failed proof ended in.

Code or the author picks the values, never a schema model: a model-picked value can be unreachable on the canvas, and
only a play proves it is not. Flash is for wording when a problem needs a story.

### 5. Check

```bash
cd "<abs>/my-tutoring-app" && node scripts/canvas-check.mjs --spec=<spec id>
```

Free, needs Chromium (`LUMINA_CHROME_PATH` or the default playwright build). It writes three screenshots per problem
(rest, proof, miss) plus one per `shot` step, and, when everything passes, `qa/canvas/<id>.json`. Read the screenshots against the bar before calling it done. A
blocked check is fixed in the spec or the program, never by loosening the script.

### 6. The user plays it

The dev panel "Canvas (agent)" saved list opens `<id>` as a lesson in the real host, with the live tutor and the
evaluation record. `node scripts/canvas-payload.mjs --name=<id>` writes a journey payload. The user's play is the
promotion gate. A tutor replay on it is the user's to run.

### 7. Promote (decide, do not default)

| Signal | Route |
|---|---|
| The user approved it and it meets the bar | Promote it to the lesson library (step 8) |
| It is served often, or needs an open value space with a code-computed key, named misses, levers, or kit chrome | Build it natively with `/primitive`; the spec is the design input and its proofs and misses are the acceptance tests |
| Several canvases draw the same picture | Add that picture to the kit's displays (`/agent-primitive`), not a third copy |

### 8. Put it in the lesson library

Add `serves` to `spec.json`: `{ "grades": ["7", "8"], "summary": "<what the learner does and the skill it shows>" }`.
The summary is what selection reads. Before the manifest call, `canvasCandidates.ts` filters the pool by grade in code
and one flash-lite call matches summaries to the lesson's objectives (at most 2 per objective). Each match is shown to
the curator as its own catalog entry, `canvas:<id>`, in place of the generic `agent-canvas` line; the curator's pick
becomes `agent-canvas` with `config.canvasId`, and the generator serves that canvas without choosing again. Write the
summary as the skill the child practises, not the topic: a topic-only summary matches neighbours.

Two tiers, both written only by `canvas-check`:

- **Pilot** (`library/pilot/`): every passing spec with `serves`. Offered only to the pilot student (1004;
  `LUMINA_CANVAS_PILOT_STUDENTS`). When they finish one, the lesson asks for a vote: thumbs up runs `--promote`
  through `/api/lumina/canvas/vote` (dev server only); thumbs down records reasons in `qa/canvas/votes.jsonl` and holds
  the canvas until `canvas-check` passes the spec again. Read `votes.jsonl` before polishing a held canvas.
- **Library** (`library/`): every lesson. Promote by the vote, or by hand after the user has played it:

```bash
cd "<abs>/my-tutoring-app" && node scripts/canvas-check.mjs --spec=<spec id> --promote
```

`scripts/canvas-manifest-bench.mjs --ids=<spec ids>` (and `--extra=negative`) runs retrieval and the real manifest on
the objectives the canvases were built for and reports offered and placed. A lesson then gets the canvas in about a second with no browser: the generator builds one shared page and
up to five problems in the spec's order. No curriculum row names a canvas and no manifest rule is added.

Before promoting, check the catalog for a specialist primitive on the same skill. The manifest prefers a specialist
(two real manifests for a slope lesson chose `slope-triangle` and `coordinate-graph`, not the canvas), so a canvas
earns its place on objectives no primitive covers.

Verify the serve: `/api/lumina/eval-test?componentId=agent-canvas&evalMode=canvas&topic=...&grade=...&intent=...`
returns the lesson for a matching objective and an error naming the library for one that does not match.

## What is built, and what is next

| Piece | State |
|---|---|
| Host primitive, frame, sounds, tutor scene, evaluation record | Built (`core/agent-canvas/`, `agent-kit/canvas/CanvasFrame.tsx`) |
| Gemini author with its own plays | Built (`agent-kit/canvas/canvasAuthor.ts`) |
| Spec folder, the shared gate, several problems on one program | Built 11-10 (`scripts/canvas-check.mjs`, `canvasLesson` `problems`) |
| Pilot spec | `qa/canvas/specs/slope-two-points/` (4 problems; user play owed) |
| Library served to lessons: the generator picks a library canvas for the objective (one flash-lite call) and builds the lesson with no browser; live authoring only with `LUMINA_CANVAS_LIVE=1` | Built 11-10 (`service/core/agent-canvas/agent-canvas.ts`, `library/`) |
| Catalog description generated from the library | Built 11-10 (`catalog/core.ts` reads `CANVAS_LIBRARY`) |
| One page shared by all problems of a lesson | Built 11-10 (`AgentCanvasData.page`, `canvasPage`) |
| A pool larger than a lesson shows, so two lessons differ | NOT built: a lesson shows the first five problems in order |
| The page builder reads React and KaTeX from `node_modules` at run time | Works on the dev host; not checked on a production build |
| The Gemini author writing several problems itself (`add_problems`) | NOT built; the check is ready for it |
| A blind look at the screen after the wrong attempt | NOT built; the author reads the miss screenshot by hand (bar 2 and 3) |
| Levers | Not designed: code cannot read a program. A support the program can drop or add through a param (bar 2) is the current form |

## Anti-patterns

- **Trusting the author.** A spec whose problems were not played both ways by `canvas-check` is not a spec.
- **A canvas per value.** Slope 3/4 and slope 2 are two problems of one program, not two canvases.
- **Storing the page.** The spec stores the program and the problems; the page is rebuilt from source
  (`canvasLesson`), so every canvas picks up fixes to the page shell.
- **Rails in the host.** No per-canvas branch, menu or check in `AgentCanvas.tsx`, the card or the boss.
- **A canvas where a primitive exists.** A specialist primitive with a code-computed key beats a canvas. Check the
  catalog first.
- **Calling it verified from the check alone.** The check proves the goal logic on the plays given. The bar's seven
  reads and the user's play are separate.

## Report

End with a table: one row per problem (params, what changed structurally, proof and miss in words, pass or fail), the
polish list, what the user should play (`<id>` in the tester), and any model spend.
