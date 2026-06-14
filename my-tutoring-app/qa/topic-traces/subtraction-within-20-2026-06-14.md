# Topic Trace: "subtraction within 20" (Elementary G1-2) — 2026-06-14

**Purpose:** verify the single | blend | mixed upgrade to `resolveLessonEvalModes.ts` — the
dedicated eval-mode stage no longer collapses every multi-mode slot to one skill, and the
"auto"/mixed mode is reachable again. (Eval-mode verification, not a scope audit.)

Resolver log (this run): `9 multi-mode slot(s) → 9 changed, 0 kept (1 mixed, 0 blend, 8 single-or-kept)`

## Resolved pins

| Objective | Component | modes | resolved pin | kind |
|-----------|-----------|-------|--------------|------|
| obj1 identify minus sign | addition-subtraction-scene | 4 | `act_out` | single |
| obj1 | foundation-explorer | 0 | — (single-mode, not resolved) | — |
| obj1 | ten-frame | 4 | `build` | single |
| obj2 counting-back ≤20 | number-line | 5 | `jump` | single |
| obj2 | skip-counting-runner | 5 | `count_along` | single |
| obj2 | math-fact-fluency | 5 | `equation_solve` | single |
| obj3 subtraction = inverse | number-bond | 4 | `fact_family` | single |
| obj3 | balance-scale | 6 | `equality_hard` | single |
| obj3 | regrouping-workbench | 4 | `subtract_regroup` | single |
| **final** assess all 3 objectives | **knowledge-check** | 4 | **mixed** | **mixed** |

## Assessment

**Labor division (sibling context working):** within every objective the resolver picked
DISTINCT skills with no overlap — obj2 = `jump` / `count_along` / `equation_solve`,
obj3 = `fact_family` / `equality_hard` / `subtract_regroup`. Each primitive in the set teaches
a different facet rather than three components redundantly drilling the same mode. This is the
intended effect of feeding per-objective siblings into the resolver prompt.

**Mixed restored (the headline fix):** the `knowledge-check` summative ("Assess the ability to
identify the minus sign, solve within 20 using counting back, AND recognize fact families")
resolved to **mixed** — the resolver returned all of knowledge-check's candidate keys, encoded as
`config.targetEvalMode = 'mixed'`, which the generator honors as an open schema (varied question
types across the 6-question quiz). Under the previous `chosenMode: STRING` design this slot was
forced to a single Bloom tier (e.g. all 6 questions `apply`). This is precisely the regression the
upgrade targets, now demonstrably fixed in a live trace.

**Single where focused:** the 8 instructional components stayed single-skill, correctly — each
objective component has a focused intent, and per-slot fit outranks forced variety. No
over-reach observed (no `analyze`/`evaluate`-tier picks on identify/apply objectives).

**Blend:** 0 this run — expected; blend needs an objective whose intent spans 2 specific skills
but not all, which none of these three did. The path is available (verified by code + tsc), just
not exercised by this lesson.

## Scope (incidental)

All pins are in-scope modes for "within 20"; no eval mode implies out-of-band magnitudes. A full
generator-level scope audit was not run (manifestOnly trace). No scope drops at the manifest layer.

## Verdict

✅ Upgrade verified live: mixed reachable (summative → mixed), single preserved where
pedagogically right (8/8 focused slots), sibling-driven labor division producing distinct skills
per objective. tsc 1441 (0 new errors).
