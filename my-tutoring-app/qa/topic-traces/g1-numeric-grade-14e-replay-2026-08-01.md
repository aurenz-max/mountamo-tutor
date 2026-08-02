# Topic Trace Replay: Grade-1 numeric boundary — 2026-08-01

Replays of the census topics after reader-fit 14e. Baselines remain in
`g1-count-forward-to-120-2026-08-01.md` and `g1-silent-e-2026-08-01.md`.

## Count forward within 120

- Live curator → manifest → generator trace; 7 components, all successful.
- **7/7** generator inputs carried `config.objectiveGrade: "Grade 1"`.
- `number-sequencer` emitted `gradeBand: "1"`; `foundation-explorer` emitted
  `gradeLevel: "1"`.
- Not cleared: `hundreds-chart` still emitted `gradeBand: "2"`; `di-math-facts`
  still emitted generic elementary grades-1–5 prose. The number-line and
  hundreds-chart scope failures remain queued.

## Silent-e long vowels

- Live curator → manifest → generator trace; 8 components, all successful.
- **8/8** generator inputs carried `config.objectiveGrade: "Grade 1"`.
- The census symptom cleared: `phonics-blender` emitted `gradeLevel: "1"` with
  `patternType: "cvce"`, rather than K. `word-sorter`, `comparison-panel`,
  `foundation-explorer`, and `decodable-reader` also emitted 1.
- Not cleared: `di-word-reading` still emitted generic elementary grades-1–5 prose;
  this draw's `spelling-pattern-explorer` stamped Grade 2.

**Boundary verdict:** fixed. All **15/15** replayed generator calls received a precise
Grade-1 objective stamp. Residuals are downstream generator contracts, not reasons to
widen 14e.

