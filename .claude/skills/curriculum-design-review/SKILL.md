---
name: curriculum-design-review
description: >-
  Sample published curriculum into a fixed panel of subskills, write one objective record per subskill (what the
  learner does, what proves it, the real misconceptions, the progression), route each record to a specialist
  primitive or a new canvas, build the canvases through /canvas-primitive, and score the panel. Use to grow Lumina's
  coverage from curriculum demand, or to re-score an existing panel. Not for a full coverage audit
  (/curriculum-lumina-audit), a single primitive's curriculum homes (/curriculum-fit), or a native primitive build
  (/primitive).
---

# Curriculum design review

> **Paid Gemini runs are the user's.** Sampling, records, routing and `canvas-check` call no model. A serve check
> through `/api/lumina/eval-test` is metered against the daily cap: report the spend.

## What this is (USER 2026-11-10)

The review used to end in hand-written manifests and an HTML report. It now ends in an **objective record** per
subskill, and the record is the input to a build. A canvas spec has four parts (program, goal, miss, problems) and
the record has the same four, so a record that is complete is a canvas brief with nothing left to decide about the
teaching.

Progress is the score of a panel: how many of its subskills are honestly taught by a specialist primitive or a
canvas. Each canvas added raises the score of every panel that samples that objective later.

No curriculum row and no panel file maps a subskill to a canvas for serving. The panel records what was built and
checked; the manifest and the canvas library's summaries still choose at run time.

## Files

A panel is a folder `my-tutoring-app/qa/curriculum-design-review/<subject>-g<grade>-<date>/`:

| File | Holds |
|---|---|
| `snapshot.json` | the raw published response, saved before sampling |
| `sample.json` | the seeded sample (`scripts/sample_curriculum.py` writes it) |
| `panel.json` | one objective record per subskill, its route, and its level |
| `REPORT.md` | the score table and what the user plays next |

## 1. Sample

Backend on :8000. Save the response, then sample. Default panel: 5 skills, 1 subskill each.

```bash
curl -s -m 120 "http://127.0.0.1:8000/api/curriculum/curriculum/<SUBJECT_ID>?grade=<g>" -o <panel>/snapshot.json
backend/venv/Scripts/python .claude/skills/curriculum-design-review/scripts/sample_curriculum.py \
  --input <panel>/snapshot.json --subject <SUBJECT_ID> --grade <g> --skills 5 --subskills 1 --output <panel>/sample.json
```

The seed is recorded. Do not redraw because a sample is inconvenient. A panel is a sample, not an audit.

## 2. Write the objective record

Treat the curriculum's `target_primitive` as a hint. Read the subskill's description, focus, examples and
constraints, and write:

| Field | What it says | Becomes in a canvas spec |
|---|---|---|
| `objective` | one sentence: what the learner can do afterwards | `request.objective` |
| `action` | what the learner's hands do, and it must be the idea itself (reading a contour map is placing something by reading the lines, not picking a sentence about lines) | the program's interaction |
| `evidence` | the state of the world that shows it was done, computed from what the learner made | `goal` |
| `notCredit` | what must not pass: a readout to match, a single guess among two, completion alone | bar 2 and 3 |
| `misconceptions` | 2-4 wrong ideas a child at this grade really holds, each with the wrong action it produces | each problem's `miss` |
| `progression` | 3-5 steps, each changing one structural thing | `problems`, in order |

A record that cannot name an action other than "choose the right statement" is not a canvas brief. Say so and
route it to a reading or knowledge-check surface.

## 3. Route

Search the live catalog (`service/manifest/catalog/*.ts`) and the canvas specs (`qa/canvas/specs/`) for the record's
action, not its topic words.

| What the catalog shows | Route |
|---|---|
| A primitive mode whose task is the record's action and whose scoring is its evidence | `specialist`: name the primitive and mode, and what was read to confirm it (catalog text, generator, component) |
| A primitive with the right world and hands but no mode for this task | `add-mode`: queue `/add-eval-modes` with the record |
| A canvas spec with the same action | `canvas-existing`: add problems to it if the progression needs them |
| Nothing with the action | `canvas-new`: build it (step 4) |
| A `canvas-new` that will be served often or needs an open value space, named misses or levers | `native`: queue `/primitive` with the record |

A topic match is not a fit. A specialist that covers the topic with a different action is recorded as `add-mode` or
`canvas-new` with the gap named.

## 4. Build each canvas

One record, one canvas, through `/canvas-primitive` (write `program.tsx` and `spec.json`, run `canvas-check`, read
the screenshots against its bar). The record's misconceptions are the misses and its progression is the problems;
change the record first if the build shows it was wrong.

Build the first canvas of a panel yourself. The rest may go to one subagent per record (model Opus 5.5 at medium
effort is the default under test, USER 11-10); the brief is the record plus the path of `/canvas-primitive` and of
one existing spec. Read every returned canvas's screenshots yourself before recording a level: the gate proves the
goal logic, not the bar.

## 5. Score the panel

Each subskill has one level in `panel.json`:

| Level | Meaning |
|---|---|
| `0 none` | no primitive or canvas has the action |
| `1 routed` | a specialist is named from catalog text only, or a canvas is drafted |
| `2 checked` | canvas: `canvas-check` passes and the screenshots were read against the bar. Specialist: generator or component read confirms the action and scoring |
| `3 played` | the user played it (canvas: then `--promote`) |
| `4 served` | a lesson for this objective gets it through the real path (`eval-test` or a manifest run) |

The panel's score is the count at level 2 or above, and separately at 3 and 4. Report all three; do not report a
level 1 as coverage.

## 6. Report and queue

Write `REPORT.md`: the score, one row per subskill (ID, action in six words, route, primitive or canvas id, level),
what the user plays next, and model spend. File the panel as one row in `WORKSTREAMS.md` and queue each `add-mode`
or `native` route with its executor skill (`/pm`).

## Anti-patterns

- **A manifest per subskill.** The manifest resolves at run time; a hand-written one is a pre-baked mapping.
- **Routing on the topic.** "It has waves in it" is not the action.
- **A canvas where a specialist has the action.** Check before building.
- **Counting drafted as covered.** Level 1 is not progress.
- **Redrawing the sample.** A new seed is a new panel.
