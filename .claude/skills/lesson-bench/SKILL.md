---
name: lesson-bench
description: Produce, score, triage and rerun Lumina lesson packages, or audit a curriculum sequence with content-aware synthetic learner journeys.
---

# Lesson Bench — Produce, Score, Triage, Rerun a Whole Lesson

Close the loop on ONE assembled lesson: produce a package, score it by code, let a
human rate the identical artifact, route every label to the layer that owns the fix,
and regenerate so the human re-rates only what changed.

**Outcome:** a labeled package has its machine half (`scores`), a scoreboard row per
check, an agreement table per check, and every fix/cut sits in a queue with a named
executor. Nothing is fixed inline unless it is the active task.

**Arguments:** `/lesson-bench <verb> [args]`
- `/lesson-bench produce "<topic>" <gradeLevel>` — one package via the real pipeline
- `/lesson-bench score [pkg.json …]` — Tier A scorer on every package (default: all)
- `/lesson-bench triage <labeled.json>` — labels → layer → executor → queue entries
- `/lesson-bench rerun <labeled.json>` — regenerate topic+grade, score, diff, carry keeps
- `/lesson-bench journey [--generate] [--production] [--against <report.json>]` — curriculum readiness campaign

## journey — lesson content to learner evidence to next-step audit

Use this for "is Phonics 1 ready, then Phonics 2?" Tier A's single-lesson score is not
that readiness decision. Read `my-tutoring-app/qa/lesson-bench/journeys/README.md`, then
run from `my-tutoring-app`:

```bash
node scripts/lesson-journey.mjs --production
node scripts/lesson-journey.mjs --generate --production --against <previous-report.json>
```

The default campaign freezes published K Letter-Sound Groups 1–3. Generated payloads
and production cue builders determine exposure/support; personas separate echoing from
independent knowledge. Reports include item citations, cold/delayed probes, prerequisite
decisions, production mastery/profile/selector results, and an HTML viewer. Production
replay is entirely in memory.

Iterate on the earliest failing lesson. Route content misses to the owning generator,
support/assessment mismatches to the component or manifest, and unverified blocks to
the content-adapter queue. Rerun identical seeds/contracts after a fix and use multiple
generated variants before declaring stability. Never change learning rates or evidence
thresholds to rescue a package. Unknown instructional behavior prevents certification;
it never bans the primitive from the catalog.

This engineering model is not empirical learning efficacy. Frozen-package comparisons
and production next-target audits are implemented; day-by-day regeneration from updated
planner state and calibration against real learners remain separate work.

Rubric, package shape and the human rail: `service/qa/lessonBench/lessonPackage.ts`.
Scorer + router: `service/qa/lessonBench/lessonBenchScorer.ts`. Runner:
`scripts/lesson-bench.mjs` (loads the TS scorer and the LIVE catalog through vite's
module runner — one catalog, one `resolveAffordances`, nothing to drift).
Queue: `qa/lesson-bench/BACKLOG.md`.

## Why a loop and not a report

The first two labels (2026-09-04, `…pgr5`) were routed by hand and both were filed
under the wrong layer before they were read closely: "take-home has too much reading"
is an AUDIENCE fact (an adult reads it → assembly places it as a parent card), and
"the child says the answer, then has to click" is a COMMIT-path defect (tutor loop),
not a grade problem. The verb exists so the third label is routed by the same table,
not by whoever is in the chair. Grade floors, `minGrade`, and catalog filtering are
rejected rulings (`feedback_make-age-friendly-not-band-floor`): a label never
becomes a ban; it becomes an affordance tag, a placement, or a contract check.

## produce

```bash
cd "<abs>/my-tutoring-app"
curl -s -m 120 -o /dev/null -w "%{http_code}" http://localhost:3000/api/lumina/topic-trace   # cold server >5s
curl -s "localhost:3000/api/lumina/topic-trace?topic=<t>&gradeLevel=<g>&package=true" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s).package;require('fs').writeFileSync('qa/lesson-bench/packages/'+p.id+'.json',JSON.stringify(p,null,2))})"
```
Grade strings are the pipeline's lowercase set (`kindergarten`, `elementary`, …).
Fixed objectives skip the brief and a package NEEDS the brief — never pass
`objectives` here. Then `score` it, drop it on the **Lesson Bench** dev panel, play,
rate, **Download labeled JSON** → `packages/<id>.labeled.json`.

## score — Tier A, code-judged, no LLM

```bash
node scripts/lesson-bench.mjs score                      # every packages/*.json, writes `scores` back
node scripts/lesson-bench.mjs score --no-write a.json    # look only
```
Fills `scores.gates/checks` from the manifest + catalog + affordance tags and appends
`{runId, gitSha, packageId, checkId, score}` rows to `qa/lesson-bench/scoreboard.jsonl`.
Scored: **G1** band (reader axis), **G4** mode exists, **G6** modality (K-2 literacy),
**Q3** concrete-before-symbol, **Q6** variety + `maxPerLesson`, **Q7** evidence,
**Q8** text load, **Q9** length (`too-long` — known minutes vs `LENGTH_CAP_MINUTES`).
Not scored (Tier B / generator-specific): G2, G3, G5, Q1, Q2, Q4, Q5.

Three rules the scorer keeps, and you must not relax:
1. **Absent = unknown, never a fail.** An untagged axis lands in `scores.unknowns`.
   A lesson cannot lose its bucket to a primitive nobody has tagged yet — that is the
   ablation the affordance framework was built to avoid. Fill the tag (`/add-affordances`)
   instead of guessing in the scorer.
2. **Score what the child plays.** Caregiver blocks are partitioned exactly as
   `exhibitAssembly.ts` places them (after the final assessment, parent card), so Q8 and
   Q9 see the child's stream only.
3. **Every deduction cites `{instanceId, checkId}`.** Lesson-level ones cite `lesson`.

For a labeled package the run prints **machine vs human** per check — the calibration
row. Read it as three lists: agreements, disagreements (one side is wrong — decide
which by looking at the block, then fix the scorer OR queue the block), and
**unrouted** labels (fix/cut with only a note — `triage` routes by keyword; an
unroutable one goes back to the rater).

## triage — label → layer → executor

```bash
node scripts/lesson-bench.mjs triage qa/lesson-bench/packages/<id>.labeled.json
```
Prints a routing table and paste-ready entries grouped by queue, saved under
`qa/lesson-bench/triage/`. The layers, and what each executor owns:

| Layer | The fix lives in | Executor |
|---|---|---|
| **SELECTION** | the curator's choice: catalog line, affordance tag, curator prompt | `/add-affordances <id>` · `/topic-trace` |
| **MODE** | the pinned eval mode | `resolveLessonEvalModes.ts` (direct edit) |
| **CONTENT** | the generator's output for this topic | `/topic-fidelity <id>` · `/eval-fix <id>` |
| **COMPONENT** | the primitive's surface for this child | `/reader-fit <id>` · `/add-di-loop <id>` |
| **TUTOR** | the judged loop / commit path | `qa/di/BACKLOG.md` + `/add-di-loop <id>` contract check |
| **ASSEMBLY** | where a block sits in the played lesson | `exhibitAssembly.ts` (direct edit) |

The mechanical part (reason id → layer) is in `triageLabel()`; your part is the
entry itself: paste it into the named queue **with the evidence** (block, note, the
scorer's citation or unknown for the same block, the sitting's run id from
`human.runIds`) and strike nothing. A label the router marks UNROUTED is a question
for the rater, not a guess. Then update the `WORKSTREAMS.md` row.

## rerun — regenerate, score, diff, re-rate only what changed

```bash
node scripts/lesson-bench.mjs rerun qa/lesson-bench/packages/<id>.labeled.json
```
Regenerates the same topic + grade through `topic-trace?package=true`, scores the new
package, and aligns blocks by slot (objective index : position). A slot with the same
primitive + mode and a **keep** carries the keep only if its payload, objective, intent,
title, grade and configuration also match;
everything else lands on the re-rate list in `<newId>.rerun.md` beside a before/after
table of machine scores. Drop the new package on the panel; the rail shows the carried
keeps pre-filled. Same-topic runs differ as much as two arms of an A/B — one rerun is a
sample, not a verdict.

## Gates before you call anything done

```bash
node node_modules/vitest/vitest.mjs run src/components/lumina/service/qa/lessonBench src/components/lumina/service/exhibitAssembly.test.ts
node node_modules/typescript/bin/tsc --noEmit | grep -c "error TS"      # baseline in qa/lesson-bench/BACKLOG.md
node scripts/lesson-bench.mjs score --no-write                          # the runtime probe of the scorer
```
A scorer change that flips a check on a labeled package must say which side of the
agreement table it moved and why. A placement or render change (parent card, K stage)
needs a browser sitting — file it in `qa/HUMAN-CHECKS.md`, never call it verified.
