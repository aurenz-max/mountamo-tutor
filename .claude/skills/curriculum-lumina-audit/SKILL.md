---
name: curriculum-lumina-audit
description: >-
  Audit every published subskill of one subject and grade against Lumina: write the learner action for each, group
  them into action families, route each family to a specialist primitive, a new mode, or a canvas, score the whole
  scope by level, and end with two ranked lists: the canvases to build first, and the strands that should converge
  into a specialist primitive instead of more canvases (literacy is the usual case: it needs the word library, the
  mic and tutor wiring that an HTML+JS canvas does not have). Use for a thorough view of one subject, or to decide
  where canvas work stops and native work starts. Not for a sampled panel that builds as it goes
  (/curriculum-design-review), one primitive's curriculum homes (/curriculum-fit), or the build itself
  (/canvas-primitive, /primitive, /add-eval-modes).
---

# Curriculum to Lumina audit

> **Paid Gemini runs are the user's.** The snapshot, the records, the routing and both lists call no model. A
> generation through `/api/lumina/eval-test` is metered against the daily cap: report the spend.

## What this is (USER 2026-11-10)

`/curriculum-design-review` takes a seeded sample of five subskills and builds as it goes. This skill is the census
of the same subject and grade: every subskill, the same objective record, the same routes, the same levels. A panel
shows whether the loop works; the audit shows where to point it.

The audit answers three questions a panel cannot:

1. **How much of the subject is honestly taught**, by level, over every subskill.
2. **Which canvases to build first.** A sample builds whatever it draws. The audit ranks every uncovered action.
3. **Where canvases are the wrong tool.** Some strands need a specialist primitive with depth and wiring. The audit
   names them, with the canvases they would absorb.

Nothing here maps a subskill to a primitive or canvas for serving. `audit.json` is a QA record; the manifest and the
canvas library's summaries choose at run time. The audit never edits curriculum: changes go through
`/curriculum-author` (draft, lineage-check, publish).

Arguments: `audit <subject> <grade> [unit]`, `canvases` (re-rank the build list), `converge` (re-read the
convergence list), `verify <subskill-id>` (raise one subskill's level with evidence).

## Files

An audit is a folder `my-tutoring-app/qa/curriculum-coverage/<subject>-g<grade>/` (`-k` for kindergarten):

| File | Holds |
|---|---|
| `snapshot.json` | the raw published response, saved before anything is read |
| `audit.json` | `subskills` (id, skill, unit, family, level), `families` (the records and routes), `convergence` |
| `REPORT.md` | the score, the two lists, and what is queued |

## 1. Snapshot and carry over

Backend on :8000. Subject and grade are both explicit. A failed or empty response is not a gap: stop.

```bash
curl -s -m 120 "http://127.0.0.1:8000/api/curriculum/curriculum/<SUBJECT_ID>?grade=<g>" -o <audit>/snapshot.json
```

Then read every panel for the same subject and grade (`qa/curriculum-design-review/<subject>-g<grade>-*/panel.json`).
Each panel record carries over with its route, canvas and level. Do not re-derive a record a panel already wrote; a
level only moves on new evidence.

## 2. Write the action for every subskill

Treat `target_primitive` and `target_eval_modes` as hints. `ai-tutor-session` as a target says nothing about whether a
primitive fits. For each subskill, from its description and parent summary, write:

| Field | What it says |
|---|---|
| `action` | what the learner's hands or voice do, and it must be the idea itself |
| `evidence` | the state that shows it was done, computed from what the learner made or said |
| `access` | only when it limits the route: non-reader, spoken answer, audio stimulus, handwriting, needs a picture |

Group subskills whose action and evidence are the same into one **family** (`families[].subskillIds`). A family is
the unit that gets routed, built and ranked: twelve subskills that are all "say the sound for a shown letter" are one
family with twelve members, not twelve builds. A subskill whose only action is "choose the right statement" is
marked as a reading or knowledge-check family and is not a canvas brief.

One subagent per unit may write this pass. The main session reads every family before routing: two units often name
the same action in different words.

## 3. Route each family

Search the live catalog (`service/manifest/catalog/*.ts`), the canvas specs (`qa/canvas/specs/`) and the agent
primitives' surfaces and displays (`service/agent-kit/`) for the family's action, not its topic words. Look across
catalog domains before deciding nothing fits.

| What exists | Route | Executor |
|---|---|---|
| A primitive mode whose task is the action and whose scoring is the evidence | `specialist` | none; record what was read |
| A primitive with the right world and hands but no mode for this task | `add-mode` | `/add-eval-modes` |
| A specialist has the action but a defect or a cap blocks this grade | `repair` | `/eval-fix` (also `EVAL_TRACKER.md`) |
| A canvas spec with the same action | `canvas-existing` | `/canvas-primitive` (add problems) |
| Nothing has the action and a child can do it with taps, drags and values | `canvas-new` | `/canvas-primitive` |
| Nothing has the action and it meets a convergence signal (step 5) | `native` | step 5 decides the target |
| The curriculum text does not say what the learner does | `ambiguous` | `/curriculum-author`, user decision |

A topic match is not a fit. Record `routeWhy` with the file read and what it showed.

Levels are the panel's, one per subskill:

| Level | Meaning |
|---|---|
| `0 none` | nothing has the action |
| `1 routed` | named from catalog text only, or a canvas is drafted |
| `2 checked` | specialist: generator or component read confirms action and scoring. Canvas: `canvas-check` passes and the screenshots were read |
| `3 played` | the user played it |
| `4 served` | a lesson for this objective gets it through the real path (`eval-test` or a manifest run) |

A subagent's `specialist` stays at level 1 until the read is recorded. A family's members can sit at different
levels: a canvas whose problems reach three of five subskills covers three.

## 4. Rank the canvases to build

Take every `canvas-new` and `canvas-existing` family that is below level 2 and order them:

1. **Subskills covered.** A family with more members first.
2. **Cost.** An existing program that reaches the family through new `params` before a new program.
3. **Strength of the brief.** The action is the idea itself and the evidence is computable from the world. A weak
   brief goes down the list, not into a build.
4. **Position.** Earlier units and lower `difficulty_range` first, since later subskills build on them.

Remove any family that step 5 moves to a specialist. For the top five, complete the objective record
(`objective`, `notCredit`, `misconceptions`, `progression`: the fields and rules in `/curriculum-design-review`
step 2) and store it on the family. A complete record is the canvas brief.

Build from the top through `/canvas-primitive` in the same push, unless canvases for this subject are already
waiting on the user's play. The user's play is the limit on throughput; a longer unplayed queue is not progress.

## 5. Find where to converge into a specialist

After routing, read the families strand by strand (a unit, or a run of skills on one idea). A strand converges when
canvases would be built one after another and still not give the child what the strand needs. Signals, each
recorded with its evidence:

| Signal | Why a canvas falls short |
|---|---|
| **Open value space.** The items come from a large set with a computable answer: words, letter-sound pairs, facts, numbers | A canvas holds a fixed list of about five problems. A word space or item space gives every run new items at a requested difficulty with code-computed keys and wrong options (`/add-word-space`, `/add-item-space`) |
| **Voice or audio.** The child says the answer, or the stimulus is a sound, a phoneme or a read-aloud | The spoken loop, the shared spoken key and judged misses live on the boss framework (`spokenBoss`), and the word library carries the phonemes. A canvas reports taps, drops and its goal |
| **Levers and named misses.** The tutor has to change the item for a child who is stuck | Help and simplify levers and per-miss teaching are wired per primitive (`/add-support-tiers`, `/add-live-tutor-tools`) |
| **Tracked below the subskill.** Mastery is tallied per letter, sound or fact | Component mastery reads a primitive's items, not a program's goal |
| **Frequency.** The strand is daily practice or a large share of the grade | One program repeated is the same five problems; the manifest also prefers a specialist |
| **Same world, three or more families** | Three canvases that draw the same picture with the same hands are one primitive with three modes |

Defaults by subject, to be overridden by the evidence: K-2 language arts and literacy strands (letter sounds,
blending, segmenting, spelling, sight words, grammar frames) usually meet the first four signals and converge.
Science and engineering ideas with one world and one goal, and one-off math ideas, usually stay canvases.

Pick the smallest target that gives the wiring, in this order:

1. **An existing specialist gains modes** (`/add-eval-modes`), when its world already has the hands.
2. **An agent primitive gains a kit surface or display** (`/agent-primitive`): `practice-studio` surfaces,
   the `wonder-walk` word world. Add to the kit, never a per-primitive mode for one task.
3. **A kit display**, when several canvases draw the same picture but the tasks differ (`/agent-primitive`).
4. **A new native primitive** (`/primitive`), when none of the above has the world.

Each `convergence` entry holds: the strand and its subskill IDs, the families and built canvases it absorbs, the
signals met, the target and executor skill, and the acceptance examples. Built canvases in the strand are the design
input: their proofs and misses become the specialist's acceptance tests. They keep serving until the specialist is
at level 2 on the same subskills; the entry says which canvases that will then duplicate.

One signal on one family is not convergence. A strand with a single voice task routes that family to `native` or
`add-mode` and leaves the rest as canvases.

## 6. Score, report, queue

The score is the count of subskills at level 2 or above, and separately at 3 and 4, out of every subskill in scope.
Level 1 is not coverage. Break the count down by unit and by route.

`REPORT.md`, in this order:

1. Scope, snapshot hash, date, model spend.
2. The score, then the by-unit table.
3. **Canvases to build**: rank, family, action in six words, subskills covered, new program or new params.
4. **Converge**: strand, signals, target, executor, canvases absorbed.
5. Modes to add, repairs, ambiguous curriculum: one line each with subskill IDs.
6. What was not verified (no generation run, no play, voice path untested).

File the audit as one row in `WORKSTREAMS.md`, and queue each convergence target, `add-mode` and `repair` with its
executor skill (`/pm`). Finish with the report path and the top of each list.

## The two K atlases

K Language Arts (191 requirements, `qa/curriculum-coverage/`) and K Mathematics (166 requirements,
`qa/curriculum-coverage/math-k/`) were audited before this loop, as a reviewed-edge HTML atlas with generation
probes. Their READMEs hold the commands. They stay valid evidence: when auditing either scope, read the atlas first
and carry its direct candidates in at level 1, or level 2 where a probe draw passed its content checks. A new scope
does not need the atlas tooling.

When working inside an atlas:

- Every script takes `--scope la-k|math-k`; scopes live in `scripts/lib/curriculum-coverage-scopes.mjs`. Decisions
  never inherit across scopes.
- `review-basis.json` freezes the reviewed curriculum and catalog. Never refresh its hashes to silence a stale
  review error; review what changed first.
- The probe keeps stale draws unless `--redraw` is passed.
- `work-items.json` and `modality-prescriptions.json` must stay the same length or the artifact builder throws. A
  residual found while executing an item goes to `EVAL_TRACKER.md`, not the atlas queue.

## Anti-patterns

- **Routing on the topic.** "It has letters in it" is not the action.
- **One build per subskill.** Group into families first; rank families.
- **A canvas for every gap.** Run step 5 before the build list is final. Ten literacy canvases with no word
  library, no mic and no levers is ten fixed worksheets.
- **A native primitive for one idea.** One world and one goal is a canvas.
- **Counting routed as covered.** Level 1 is not progress, and a catalog match or an endpoint pass is not level 2.
- **Writing the audit into curriculum.** No `target_primitive` edits, no manifest rules, no stored mapping.
