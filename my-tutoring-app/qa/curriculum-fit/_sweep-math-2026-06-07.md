# Curriculum-Fit Sweep: math — 2026-06-07

**Domain → Subject:** math → MATHEMATICS
**Published grades probed:** Kindergarten, 1 *(only K–1 are published for MATHEMATICS — see Caveat)*
**Primitives:** 60 — **25 MATCH, 35 ABSTAIN** (raw)
**Engine:** `scripts/curriculum_fit_sweep.py` (batch driver, one Firestore init, reuses `CurriculumRetrievalMatcher.probe`).

> One consolidated report instead of 60 per-primitive files: 35 of the abstains share one of two structural causes below, so individual stubs would be noise. `number-line` keeps its own detailed report ([number-line-2026-06-07.md](number-line-2026-06-07.md)).

## The raw 25/35 split is misleading — two structural factors dominate

### Caveat 1 — the curriculum ceiling is Grade 1
Only **K and 1** are published for MATHEMATICS. Every grade-2+ primitive is being matched against a curriculum that *does not contain its concept*. Their abstains are **scoping, not description defects**. These are expected-MISS-until-authored, NOT work items for this skill:

`slope-triangle, matrix-display, coordinate-graph, ratio-table, percent-bar, function-sketch, parameter-explorer, systems-equations-visualizer, circle-explorer, angle-workshop, polygon-area-builder, two-way-table, area-model, equation-workspace, equation-builder, multiplication-explorer, fraction-circles, fraction-bar, double-number-line, tape-diagram, net-folder, 3d-shape-explorer, transformation-lab (partial), histogram, distribution-explorer`

→ Owner: `/curriculum-author` (author grades 2–12). Re-run the sweep per grade as curriculum is published.

### Caveat 2 — MATCH can be a *false positive* at the grade ceiling
Because coherence only needs ≥3/5 to share a skill_id, an out-of-grade primitive whose top-5 happen to cluster on one vaguely-related K skill reports **MATCH** — a misattribution, not a home. Flagged false-MATCHes:

| Primitive (true grade) | Spurious MATCH | Why it's wrong |
|---|---|---|
| systems-equations-visualizer (8) | OPS001-03 "add/subtract within 5" @0.694 | routes algebra attempts to K arithmetic |
| percent-bar (6) | COUNT001-03 "compare numbers" @0.695 | percent ≠ compare-numbers |
| distribution-explorer (6+) | COUNT001-05 "compose/decompose 11–19" @0.684 | unrelated |
| histogram (3+) | MEAS001-09 "data interpretation" @0.710 | loosely ok but grade-mismatched |

→ At the grade ceiling, **MATCH below ~0.73 with a grade-2+ primitive deserves suspicion.** A grade-aware retrieval (probe only the primitive's own grade band) would convert these to honest abstains.

## The genuine finding: `number-line` is NOT a one-off

Within the **K–1-appropriate** primitives, there's a distinct cluster that abstains with `number-line`'s exact signature — high cosine (concept is present) but low coherence (it's a *representation/strategy used across many skills*, no single home):

| Primitive | Best | Coh | Cross-cutting role |
|---|------|-----|--------------------|
| **number-line** | 0.761 | 1/5 | operations-as-movement, ordering, placement |
| **bar-model** | 0.829 | 2/5 | part–whole across add/subtract/compare |
| **addition-subtraction-scene** | 0.821 | 2/5 | operations representation |
| **strategy-picker** | 0.828 | 2/5 | meta — picks a strategy, maps to no content skill |
| **skip-counting-runner** | 0.780 | 1/5 | counting, scattered across count/pattern skills |
| **function-machine** | 0.715 | 1/5 | input→output rule, spans patterns/operations |
| **tape-diagram** | 0.721 | 1/5 | part–whole (same family as bar-model) |
| **length-lab** | 0.853 | 1/5 | highest cosine in the whole sweep, yet homeless — measurement spread across MEAS skills |

These eight share number-line's diagnosis: **legitimately cross-cutting representation/strategy primitives.** Their abstain → fallback is the correct, pedagogically-safe outcome *today*, but they all accrue mastery to orphan synthetic subskills (subject `general`) instead of the real `OPS001`/`COUNT001`/`MEAS001` graph. They are the prime beneficiaries of the **per-eval-mode retrieval + skill-cluster coherence** enhancement proposed in the number-line report.

## Healthy core — clean MATCHes (no action)

The K–1 number-sense / geometry / measurement core resolves cleanly (4–5/5 coherence):
`ten-frame, counting-board, number-tracer, number-sequencer, comparison-builder, ordinal-line, number-bond, math-fact-fluency, pattern-builder, base-ten-blocks, hundreds-chart, regrouping-workbench, place-value-chart, array-grid, factor-tree, compare-objects, shape-composer, shape-tracer, measurement-tools, dot-plot`.

These confirm the retrieval path works — when a primitive maps to one skill at its grade, it lands with 5/5 coherence (e.g. ten-frame→COUNT001-05 5/5, ordinal-line→COUNT001-04 5/5).

## Recommendations (priority order, report-only)

1. **No per-primitive action for the 25 out-of-grade abstains.** They're blocked on curriculum authoring (grades 2–12), not on descriptions. Tracked under `/curriculum-author`, not here.
2. **Grade-aware retrieval is the highest-leverage engine fix.** Probe a primitive against *its own* grade band, not the published default. This (a) stops the false-MATCH misattributions in Caveat 2, and (b) makes the out-of-grade abstains explicit ("no grade-6 curriculum yet") instead of silently matching K skills. Owner: `curriculum_retrieval_service.py` / `curriculum_mapping_service.py`.
3. **The 8-primitive cross-cutting cluster** (number-line + bar-model + tape-diagram + addition-subtraction-scene + strategy-picker + skip-counting-runner + function-machine + length-lab) is the real target for the **per-eval-mode query + skill-cluster coherence** change. Fixing it once fixes all eight; it's where orphan-mastery is leaking from the K–1 strand.
4. **Mark these 8 as expected-abstain cross-cutting primitives** so future sweeps don't re-flag them as gaps.

**Bottom line:** the math catalog is healthy where the curriculum exists (20 clean K–1 matches). The 35 abstains are ~25 "curriculum not authored above G1 yet" + ~8 "cross-cutting representation, no single home" + a handful of false-MATCH grade-ceiling artifacts. `number-line`'s situation is a *pattern*, not an exception — and the same two engine changes (per-mode query, cluster coherence) plus curriculum authoring above G1 address the entire abstain set.
