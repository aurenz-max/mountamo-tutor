# Math G2 design review 2026-10-28 — build queue (PROPOSED)

Briefs: `briefs/`. Order not yet agreed with the user. Most findings are source-level: Gemini's monthly
project spend cap blocked 17 of 19 generation probes on 2026-10-28.

| # | Brief | Executor | State |
|---|---|---|---|
| 1 | 5 equal shares (new primitive, GEOM002-03-a/-c) | `/primitive` | PROPOSED |
| 2 | 2 array-grid count_array Grade 2 framing + repeated addition (repair) | `/primitive-contract` then `/eval-fix` | PROPOSED |
| 3 | 1 array-grid rectangle partition (new mode) | `/add-eval-modes` | PROPOSED |
| 4 | 3 shape-builder classify: code-drawn shapes, key from corners, no name label (repair) | `/primitive-contract` then `/eval-fix` | PROPOSED |
| 5 | 6 coin-counter dollar notation + coin-count targets (new modes) | `/add-eval-modes` | PROPOSED |
| 6 | 4 shape-builder make_shape asks by name (new mode) | `/add-eval-modes` | PROPOSED |

Without briefs (`/eval-fix`): shape-tracer draw scoring + triangle fallback; coin-counter make-change makes change
with coins; fraction-bar identify/build grade-blind; fraction-circles build_equal Grade 2 denominators;
di-word-problem-setup returns an empty list on a generation error. Curriculum note: OPS002-01-c names
addition-subtraction-scene (K-1, capped at 20).
