# Eval Modes — `dump-truck-loader` (L0→L1) — 2026-08-21

Coverage queue A pilot. Curriculum anchor **G1 `SCI005-02` "Construction Machines"**
(curriculum-fit 2026-08-21, cos 0.873 / 5-of-5 — the highest in that sweep).

## The ladder — task identities, not grade bands

| evalMode | β | scaffold | What the child does |
|---|---:|---:|---|
| `load` | −1.0 | 2 | Haul N loads and find the binding meter **by doing** |
| `predict` | 0.0 | 3 | Commit to which meter fills first **before** any evidence, then verify |
| `plan_trips` | 1.5 | 5 | Clear a whole pile; work out how many trips the density forces |

β sits on the **centered** scale used by the already-laddered engineering family
(`hydraulics-lab`, `propulsion-lab`, `flight-forces-explorer`), not the PRD 1.5–8.0
scaffolding scale — the retired `{"default": 2.5}` entry was on the other one, and a mixed
scale inside one primitive would corrupt `get_primitive_beta_range`.

## Why the pilot is not `ramp-lab`

The curriculum-fit report nominated `ramp-lab` (0.867, 5/5). **It has no assessable
moment** — `RampLab.tsx` is 1172 lines with zero occurrences of challenge / answer /
correct / submit / complete. An eval-mode ladder there would be Phase 3-S wiring: a log
line and no change a student can see.

Triage of all 17 queue-A engineering entries by whether the component has a solve surface
**and** a challenge structure:

| | Primitives |
|---|---|
| **Ready to ladder** | `dump-truck-loader`, `paper-airplane-designer`, `engine-explorer`, `vehicle-design-studio`, `airfoil-lab` |
| **Solve surface, no challenge structure** | `bridge-builder`, `tower-stacker`, `shape-strength-tester`, `blueprint-canvas`, `excavator-arm-simulator`, `foundation-builder` |
| **Pure sandbox — needs a challenge surface FIRST** | `ramp-lab`, `lever-lab`, `wheel-axle-explorer`, `pulley-system-builder`, `gear-train-builder`, `propulsion-timeline` |

**Six of the eleven SCI005 @ G1 block are sandboxes.** Curriculum-fit measures whether a
home exists; it says nothing about whether there is anything to evaluate. Those six need
`/add-structural-difficulty` (or a job-board port) before `/add-eval-modes` does anything
real for them.

## What shipped

**Fork A** — the jobs are **code-owned** because the density arithmetic *is* the
correctness; Gemini never authors the numbers, only the framing. So the resolution selects
jobs from a pool rather than constraining a schema enum.

- **`dumpTruckJobs.ts` (new, pure module).** 12-job pool, 4 per rung, tagged `mode`.
  Pulled out of the `.tsx` because the generator importing selectors through the component
  dragged React — and through the evaluation barrel, **Firebase** — into the generation
  path. Carries `DENSITY_BY_MATERIAL` / `MATERIAL_LABEL` too, so there is one density
  table.
- **Job pool.** Every number derives from the shipped physics (bed 30, cap 50):
  debris 1.0 → volume-limited 30/load · dirt 1.5 → volume-limited 30/load · gravel 1.8 →
  weight-limited ~27.8/load (bed ~93%) · sand 2.5 → weight-limited 20/load (bed ~67%).
  `plan_trips` holds the pile at **90 units for all four materials** so trip count (3, 3,
  4, 5) varies by density *alone* — that contrast is the lesson.
- **`selectDumpTruckJobs` / `selectMixedDumpTruckJobs`.** The mixed builder rotates the
  rungs so an unpinned session touches all three (SP-21: a mixed path that silently runs
  one rung makes the label a lie).
- **Generator.** `resolveEvalModes` on `ctx.targetEvalMode` / `ctx.intent` /
  `ctx.objective.text`; mode section injected into the prompt so Gemini frames the right
  rung; jobs stamped into `data.jobs` unless a curator override supplied them.
- **Catalog + backend.** `evalModes` (ordered by β) + three `PROBLEM_TYPE_REGISTRY`
  entries replacing the placeholder `default`.

### One content bug fixed in passing

`DEFAULT_JOBS` j3 told the student gravel fills the bed "about 83%". The physics says
50 ÷ 1.8 = 27.8 of 30 = **~93%**. On a primitive whose whole lesson is reading the two
meters, the prose was contradicting the sim.

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck:lumina` | ✓ **0 errors** |
| `dumpTruckJobs.test.ts` (new, 17 cases) | ✓ **17/17** |
| **Live Gemini drive** — pin `predict` | ✓ 4 predict jobs, title *"Which Meter Fills First?"* |
| **Live Gemini drive** — pin `plan_trips` | ✓ 4 plan_trips jobs, title *"Plan the Haul!"* |
| **Live Gemini drive** — no pin, intent only | ✓ `predict (resolved)` — the intent micro-call picked the right rung |

The live drive is the path the Primitives Tester *cannot* exercise (it always pins), so
the unpinned intent resolution was the one worth proving. Probe file was temporary and is
deleted; the committed test is deterministic and makes no network call.

The contract test checks the pool against the same arithmetic the component runs, plus the
pedagogy guard that **no `predict` brief names the binding meter** — the brief is on screen
before the child commits, so naming the scale or the bed there hands over the answer.

**Not verified:** in-browser. The generation path and the content contract are proven
headlessly; nobody has watched a child-facing session run these jobs. Needs a browser check
on the pinned-mode flow in the Primitives Tester.

**Pre-existing, untouched:** `intentConsumptionContract.test.ts` fails on
`sentence-analyzer` (1 of 174). Not this slice — `dump-truck-loader` is not in its dead
list, and now consumes intent where it did not before.

## Residual

- `dump-truck-loader` has **no `tutoring` block** (queue D). Sequence it next for this
  primitive, per queue D's own rule.
- Support tier (`config.difficulty`) is not wired — a within-mode scaffolding axis
  (hide a meter, withhold the hint) is the natural `/add-support-tiers` follow-up.
- The generator prompt still carries its own MATERIAL DENSITY GUIDELINES (sand 1.6) that
  disagree with `DENSITY_BY_MATERIAL` (sand 2.5). Harmless today — the job path reads the
  table, not `data.materialDensity` — but it is a live trap for the next editor.
