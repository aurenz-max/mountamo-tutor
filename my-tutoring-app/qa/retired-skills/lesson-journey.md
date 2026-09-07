> RETIRED 2026-09-07 by user request. Historical reference only; do not execute or resume this workflow without an explicit request.

# Lesson Journey — Lesson Content to Learner Evidence to Next-Step Audit

The per-lesson question ("was each objective taught, assessed, enough to infer
mastery?") is answered by the coverage judge on every assembled lesson — that is
`/lesson-coverage`, with the package, the code scorer and the human rail. This skill
is the OTHER axis: a **sequence** of lessons, a learner who carries knowledge from one
to the next, and the readiness decision at each step.

**Outcome:** a readiness report per lesson in the campaign (`ADVANCE` · `REMEDIATE` ·
`REVIEW` · `INSUFFICIENT_EVIDENCE` · `BLOCKED`) with item citations, cold/delayed probes,
prerequisite decisions and the production mastery/profile/selector result beside the
evidence verdict, plus an HTML viewer. Every miss routed to the layer that owns it.

**Arguments:** `/lesson-journey [--generate] [--production] [--against <report.json>] [--profile <p> --require-advance]`

Read `my-tutoring-app/qa/lesson-bench/journeys/README.md` first, then run from `my-tutoring-app`:

```bash
node scripts/lesson-journey.mjs --production                                        # frozen packages → personas → in-memory mastery replay → report
node scripts/lesson-journey.mjs --generate --production --against <previous-report.json>   # regenerate through the real pipeline, compare the same contracts
node scripts/lesson-journey.mjs --profile fast --require-advance                    # explicit CI readiness gate for one profile
```

Generation needs the Next server on :3000. Production replay uses the backend venv's
python and constructs no cloud client — every persona/seed gets its own
`InMemoryFirestoreService`. The default campaign freezes published K Letter-Sound
Groups 1–3 (`phonics-starter.json`, curriculum snapshot `curriculum-k.json`).

## How to work it

- **Iterate on the earliest failing lesson.** A failed prerequisite blocks everything
  downstream; fixing lesson 3 while lesson 1 is `INSUFFICIENT_EVIDENCE` proves nothing.
- **Route, do not patch here.** Content misses → the owning generator (`/topic-fidelity`,
  `/eval-fix`). Support/assessment mismatches → the component or manifest. A block the
  extractor cannot read → the content-adapter queue. Per-lesson coverage findings the
  campaign surfaces → `/lesson-coverage diagnose` (same layers, same executors).
- **Rerun identical seeds/contracts after a fix**, and use several generated variants
  before declaring stability — same-topic generations differ as much as two A/B arms.
- **Never change learning rates or evidence thresholds to rescue a package.** Unknown
  instructional behaviour prevents certification; it never bans the primitive.

## What it is and is not

`content-opportunity-v1` is an engineering model, not a fitted human learning model.
Frozen-package comparisons and production next-target audits are implemented. Not
implemented: day-by-day regeneration from updated planner state, calibration against
real learners, certification of letter naming or word decoding. One generated variant
per lesson and three seeds per persona is a pilot.

**Two instruments, one ladder.** The campaign's per-letter gap classes (no surface ·
not asked · echo only · thin · covered) are the coverage judge's category ladder
computed deterministically by five hand-written adapters (`di-letter-sounds`,
`letter-sound-link`, CVC `phonics-blender`, CVC `di-word-reading`, …). Once
`/lesson-coverage calibrate` clears ≥80% on ~20 packages, the journey should consume
the judge's per-objective verdict as its exposure record instead of growing adapters —
queue that as a design item with the user, do not start it on your own.

## Gates before you call anything done

```bash
node node_modules/vitest/vitest.mjs run src/components/lumina/service/qa/lessonBench src/components/lumina/service/exhibitAssembly.test.ts
node node_modules/typescript/bin/tsc --noEmit | grep -c "error TS"      # baseline in qa/lesson-bench/BACKLOG.md
node scripts/lesson-journey.mjs --production                             # the runtime probe; publish the .html as an Artifact to share
```

Queue: `qa/lesson-bench/BACKLOG.md` item 17. Package shape: `service/qa/lessonBench/lessonPackage.ts`.
Report builder: `scripts/lib/lesson-journey-report.{mjs,html}`.
