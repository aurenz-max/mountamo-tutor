---
name: canvas-eval
description: >-
  QA sweep for canvases (the agent-canvas specs in qa/canvas/specs/): run the gate, probe every problem in a real
  browser for function and look (overflow, small or overlapping or dim words, small touch targets, a success colour or
  word only the proof shows, tapping every control or random play meeting the goal), read the screenshots against the
  canvas bar, heal what fails in the spec or program and re-run, and hand the user a contact sheet of the canvases
  ready to play. Free: no model call. Use when canvases pile up faster than the user can play them, after any batch of
  /canvas-primitive work, or to re-check the pilot tier. Not for authoring a new canvas (/canvas-primitive), the
  host's tutor wiring (/review-live-wiring), or a native primitive (/eval-test).
---

# Canvas eval

**Arguments:** `/canvas-eval` (every spec changed since its last sweep) · `/canvas-eval <id>[,<id>]` · `/canvas-eval pilot` · `/canvas-eval all`

The user's play is the promotion gate, and it is the scarce step. This skill's job is to make sure every canvas that
reaches the user works, reads right and looks like the others, so the user's time goes on whether it teaches, not on
finding a drag that does nothing. A canvas leaves this skill in one of three states: **ready** (the user should play
it), **reject** (it cannot meet the bar without a redesign; say why), or still **heal** with the reason it stopped.

Everything here is free. No step calls a model; the reads are yours, from screenshots.

## The tools

All from `my-tutoring-app/` with an absolute `cd`.

| Command | What it does |
|---|---|
| `node scripts/canvas-eval.mjs [--spec=a,b \| --all \| --pilot]` | Gate (`canvas-check.mjs`, unchanged, which also refreshes the tier entry on a pass) + probes per problem. Default: specs whose program+spec hash changed. ~45 s a canvas: run more than 3 in the background |
| `node scripts/canvas-eval.mjs --play=<id> --problem=N --steps='[...]'` | One play: goal, scene, element boxes, a screenshot at `qa/canvas/eval/runs/<id>-play.png`. Use it to aim drags and to try a second correct solution |
| `node scripts/canvas-eval.mjs --read=<id> --verdict=ready\|heal\|reject --notes="..."` | Record your screenshot read. Refused if the canvas changed since its sweep |
| `node scripts/canvas-eval.mjs --heal=<id> --notes="..."` | Record a heal, one line per change |
| `node scripts/canvas-eval.mjs --sheet` | Rebuild `qa/canvas/eval/sheet.html` |

Output: `qa/canvas/eval/ledger.json` (one row per canvas: hash, tier, gate, finding counts, top findings, read,
heals, status), `qa/canvas/eval/runs/<id>.json` (every finding and shortcut result per problem), `sheet.html`.

A canvas the user voted down after its last edit is `held`: the sweep probes it but does not run the gate, because a
gate pass releases it into the pilot again. Heal its vote reasons (step 5) first; the edit lifts the hold.

Status is computed, never typed: `blocked` (gate fails or a blocking probe) → `heal` (a major probe finding, or your
read said heal) → `read` (probes clean, screenshots not read for this hash) → `ready` / `reject` (your read). Any edit
to program or spec changes the hash and the canvas falls back to the probes and needs a new read.

## The probes (code, `service/agent-kit/canvas/canvasProbes.ts`)

| Probe | Severity | What it means |
|---|---|---|
| gate | blocking | `canvas-check` failed: compile, rest, proof, miss, params read, distinct first screens, asks |
| compile, monkey-errors | blocking | The program throws under some input a child can give |
| verdict-words | blocking | The proof's end says correct / well done / try again and the miss's does not |
| tap-all | major | Tapping every control once meets the goal |
| monkey | major at ≥ 50% of 8 runs, minor below | Random taps and drags meet the goal; a minor hit means read how wide the goal's tolerance is |
| verdict-colour | major | A green only the proof's end draws: check the proof screenshot for a success colour |
| overflow | major | Wider than the 720px stage |
| height | minor over 640px, major over 760px | The frame grows to fit, so a tall stage scrolls the lesson |
| small-text | major under 11px, minor under 11.5px | 12px written in a viewBox slightly wider than the stage draws at 11.9px, which is fine |
| overlap, off-stage | major | Words covering words, things past the stage edge |
| touch-target | major under 32px, minor under 44px | Something the child taps or grabs is too small |
| control-overlap | minor, at rest | Two controls' boxes cover each other, so a tap can land on the wrong one. Fine for a pile of identical units or two wire ends on one terminal; a fault for two different buttons (pizza-share's −/+ before its heal) |
| no-controls | major | Nothing at rest has a pointer/grab cursor, a button or an input |
| stage-colour | minor | The first painted rect outside `<defs>` is not `#0f172a`. A world that fills the picture (a field, a room, a map) is fine: say so in the read |
| dim-text | minor | Words under 3:1 contrast on what is drawn behind them (the topmost filled SVG shape under the word, or the nearest HTML background) |

A probe is a fact, not a verdict. A major finding can be wrong for a canvas (a monkey hit on a 2-choice toggle the
ladder later removes; a verdict colour that is the child's own emerald wire). Then say so in the read's notes and
record `--verdict=ready`; do not change the probe for one canvas. If the same false positive shows on three or more
canvases, fix the probe in `canvasProbes.ts` (that is the class, `feedback_close-findings-at-class`).

## The loop

### 1. Sweep

Run the script for the argument's specs. For more than 3, background it and work the first finished rows while it
runs (the ledger is written after each canvas).

### Batches (`all`, `pilot`, or more than ~8 canvases)

Reading every screenshot of 50 canvases does not fit one context. Split the canvases into batches of about 11 and give
each to a subagent (5 in parallel worked on 11-15). Each brief: read this skill and the bar, the batch's ids with
status and tier, the commands, and the hard rules (library canvases get no restyle; never edit the scripts, probes,
`stage.ts`, `library/` or `votes.jsonl`; no model calls; no commits; touch only the batch's spec folders, since other
sessions share the checkout). Ask for a table back plus the probe false positives it saw. Then:

- Check the heals yourself: open the proof and miss screenshots of every canvas a subagent rewrote, and read any goal
  it changed (tightened or loosened) against the objective.
- Fix at the class any probe false positive that two or more batches report, then re-probe everything with
  `--all --no-gate` (reads survive, because a probe change does not change a canvas's hash).

### 2. Triage

Read `ledger.json`. Work order: `blocked`, then `heal`, then `read`. Library canvases (tier `library`) were approved
by the user: heal function and leaks only, never restyle, and tell the user what changed.

### 3. Read the screenshots (every `read` row)

Open `qa/canvas/specs/<id>/plays/` — `<n>-rest`, `<n>-proof`, `<n>-miss` and any `<n>-proof-<shot>` — and read
`spec.json` and `program.tsx`. Judge against the **bar in `/canvas-primitive`** (hands in the world, no
match-the-readout, no verdict before Check, the miss is a real misconception, a progression, the ask never says how,
readable, draws what the simpler activity cannot, each quantity once, a control shows only when it can act), plus:

- **It works the way a child would try.** Read the `lumina.goal` expression. If the objective allows more than one
  correct answer (any order, any equivalent grouping, either end of the line), try one other correct path with
  `--play`. A goal that is true only for the proof's exact path is a heal.
- **The look is the house look.** Compare with two `ready` or `library` canvases on the sheet: stage colour, card
  surfaces, dashed drop places, word sizes, accent use, one Panel with title and one how-to-operate caption, no button
  row, no Reset. Drift is a heal (except on a library canvas). `canvasStyle.ts` is the written look.
- **The scene is honest.** `qa/canvas/<id>.json` holds each problem's rest, proof and miss scene. No verdict, no
  answer, no value the child cannot see.

Record the verdict with `--read` and one line of notes per problem that needed a look. `ready` only when nothing on
the bar fails.

### 4. Heal (every `blocked` and `heal` row)

Fix the cause in `program.tsx` or `spec.json`, add one line per change to `spec.json` `polish[]`, record it with
`--heal`, and re-sweep that id (`--spec=<id>`). Then read again. At most **3 rounds** per canvas; after that record
`--verdict=reject` (or leave it `heal`) with the reason and queue it.

| Finding | Usual fix |
|---|---|
| gate: the proof ends unmet | Re-aim the proof from `--play`'s boxes and the failed scene; if the goal is right and the play is right, the program has a bug |
| gate: the miss meets the goal | The goal accepts a wrong answer: tighten the goal expression, never weaken the miss |
| gate: param never read | Read it in the program with a default, or drop it from the problem |
| gate: two problems share a first screen | A param changes nothing the child sees: make it show, or change the problem's structure |
| tap-all, monkey | The goal checks a state too easy to stumble into: require the quantity, not "something placed"; remove a toggle that flips the answer; or add a distractor the random path also takes |
| verdict-colour, verdict-words | Remove the colour or words that depend on the goal; the host's Check owns the verdict |
| small-text, overlap, off-stage, overflow, height | Change font sizes, positions or the viewBox; size grids to their count |
| touch-target | Enlarge the hit area (a transparent rect or circle under the shape), not the picture |
| stage-colour, house-look drift | Follow `canvasStyle.ts` (not on a library canvas) |
| the read: a goal true for one path only | Write the goal as the property of the objective (the total, the relation), not the proof's moves |

`spec.json` is git-ignored (`qa/**/*.json`), as are the ledger and runs; `program.tsx` and the tier entries in
`library/` are tracked. A heal reaches lessons through the tier entry the gate rewrites on a pass, so re-sweep with the
gate after every heal.

Never loosen `canvas-check.mjs` or a probe to pass one canvas. Never edit a `library/` or `library/pilot/` entry by
hand; `canvas-check` writes them. A heal that changes what the canvas teaches (a new task, a different action) is not a
heal: stop, report it, and route it to `/canvas-primitive`.

### 5. Hand to the user

`node scripts/canvas-eval.mjs --sheet`, then send `qa/canvas/eval/sheet.html` with SendUserFile (`display: render`).
The sheet groups every canvas by status with its screens and findings; the user plays the Ready group from the dev
panel "Canvas (agent)" saved list and votes in a lesson (thumbs up promotes through `/api/lumina/canvas/vote`). Read
`qa/canvas/votes.jsonl` at the start of the next run: a thumbs-down reason is a heal for that canvas, and a reason
that repeats across canvases is a probe or a bar item to add.

## Report

Save to `my-tutoring-app/qa/canvas/eval/report-<YYYY-MM-DD>.md` and end with:

1. A table: one row per canvas swept: id, tier, status before → after, what was healed (one line), what the user
   should look at when they play it.
2. Counts: ready / heal / reject / blocked.
3. Probe false positives seen and whether any was fixed at the class.
4. Spend: $0 (this skill calls no model). If you ran `canvas-author` for a rebuild, its spend.

## Anti-patterns

- **Calling it ready from the probes.** Probes catch what code can see. The bar's reads are yours on every hash.
- **Healing the gate.** A failing canvas is fixed in its spec or program.
- **Restyling an approved canvas.** Library canvases get function and leak fixes only.
- **Redesign under the name of heal.** A new action or task is `/canvas-primitive` work and a new play by the user.
- **Re-running unchanged canvases.** The default run skips them; `--all` is for a probe change.
