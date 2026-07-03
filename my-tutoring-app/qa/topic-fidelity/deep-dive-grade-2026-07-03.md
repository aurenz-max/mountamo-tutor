# topic-fidelity --grade — deep-dive (CORE, risk group B)

**Date:** 2026-07-03
**Generator:** `my-tutoring-app/src/components/lumina/service/core/gemini-deep-dive.ts`
**Verdict:** PARTIAL_IMPROVED
**Eval mode probed:** `explore` · **Topic:** "the water cycle"

## Shape diagnosis
Shape **B — prose passthrough**. Entry `generateDeepDive(ctx)` did
`const gradeLevel = ctx.gradeContext` (line 1620) and threaded that single value
into `runOrchestrator` AND every parallel block generator (key-facts, prose,
MC, timeline, fill-in-blank, compare-contrast, diagram, mini-sim, perspectives,
hypothesis-lab). `ctx.gradeContext` is **band prose only** — the eval-test route
(and production) derive it from the `gradeLevel` band key, so grades 2/4/5 all
map to the byte-identical `elementary` prose. Cross-band (K vs 9) already tracked
via distinct band prose, but the **numeric grade never reached any prompt** →
within-band grades were indistinguishable.

Big multi-stage orchestrator → Group B minimal fix (do NOT restructure): surface
the numeric grade in the value passed downstream.

```ts
const gradeLevel = ctx.grade ? `grade ${ctx.grade} student` : ctx.gradeContext;
```

Because every generator already consumes this one `gradeLevel` string, the numeric
grade now flows to the orchestrator and all 13 block generators with a one-line
change. Schema, eval-mode/challenge-type axis, and block set untouched.

## Probe table (AFTER fix)
| probe | grade | avg word len | long-word(≥8ch) ratio | avg sentence len | title / sophistication |
|-------|-------|--------------|-----------------------|------------------|------------------------|
| cross-band | K | 4.38 | 0.073 (46) | 15.0 | "The Amazing Journey of a Water Droplet" — simple |
| within-band | 2 | 4.46 | 0.083 (68) | 19.1 | "The Amazing Journey of Water" |
| within-band | 4 | 4.80 | 0.120 (77) | 16.5 | grade-4 vocab |
| within-band | 5 | 4.89 | 0.134 (106) | 17.6 | "dinosaurs...molecules", closed-container framing |
| cross-band | 9 | 5.31 | 0.198 (172) | 18.9 | "The Infinite Loop" — condensation, updrafts, atmosphere |
| control (no &grade=) | — (band=elementary) | 4.51 | 0.091 (78) | 16.1 | sits mid-elementary, no regression |

**Vocabulary-complexity ladder is cleanly monotonic** K→2→4→5→9
(long-word ratio 0.073 → 0.083 → 0.120 → 0.134 → 0.198; avg word len
4.38 → 4.46 → 4.80 → 4.89 → 5.31).

- Cross-band (K vs 4 vs 9): strong separation (existed pre-fix via band prose).
- **Within-band 2 vs 5 now differ** (0.083 vs 0.134; wlen 4.46 vs 4.89) — this
  discrimination is ONLY possible via the numeric-grade injection; pre-fix the
  ctx.gradeContext prose was byte-identical for both, so they collapsed.
- No-grade control lands mid-elementary (0.091) — band fallback intact, no regression.

## Answer-leak check
No leak. Fill-in-blank blanks correctly masked (`"...we call it ______"`, ans
"precipitation"; `"...a process known ______ _________"`, ans "transpiration").
MC `correctIndex` self-consistent, 4 options. The fix touches grade realization
only — no change to answer/schema logic.

## Classification
**PARTIAL_IMPROVED** — band already tracked (shape-B passthrough); numeric-grade
surfacing added so within-band grades now differ while band fallback is unchanged.
Grade governs realization (reading level, vocab, sentence sophistication) only;
eval-mode cognitive KIND and block/schema axes untouched.
