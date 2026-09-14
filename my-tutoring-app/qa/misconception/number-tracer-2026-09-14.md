# number-tracer misconception loop (sequence) — 2026-09-14

`/add-misconception-loop number-tracer`. Capture repair across all four modes, and a consumer for
`sequence` (write the hidden number in a counting run). Fictional evidence only; no canonical attempts.

## What was broken

| Problem | Effect on the loop | Where it went |
|---|---|---|
| The vision judge got a transparent PNG and answered "nothing was drawn" (NT-5) | Evidence would have said a correct child drew nothing; correct slanted digits were rejected | fixed in this push (`/eval-fix`, [report](../eval-reports/number-tracer-2026-09-14.md)) |
| Scaled geometry ≥ 90 accepted a different numeral without the judge (NT-6) | The error the loop targets (a wrong number) was graded correct: 2 for 3, 8 for 3, 6 for 5 | fixed, same report |
| Sequence at easy/medium painted a dotted guide of the answer (NT-7) | The learner could trace the answer; no counting error could appear | fixed, same report |
| Answers repeated on neighbouring items, session fixed per window (NT-8) | A selector cannot hold "distinct answers" over a baseline that has none | fixed, same report |
| The sequence-window call ran away in 7 of 26 real draws (NT-13) | Generation stalled for minutes, then fell back to the grade ceiling and lost the lesson's window | fixed, same report |
| The judge returned no reading of which number was drawn | No factual "wrote 7" was available for evidence | `writtenAs` added (below) |
| No response ledger, no evidence, and every item retried until accepted | Sessions scored ~95 whatever the first tries were, so capture could never fire | built (below) |
| Metrics had no `evalMode` | The backend recorded `eval_mode: 'default'`; the trace/copy/write/sequence β priors were never used | set when the session has one mode (NT-14) |

## What was built

**Capture (all modes).** `NumberTracer.tsx` records every check in `responsesRef`: item, mode, try,
target, the run for sequence, the judge's reading, the score used, accepted or not, the guide, the copy
model and the hint on screen, and the tier. `numberTracerEvidence.ts` emits `DiagnosisEvidence` only when some
drawing was read as a different number. A rejection for legibility alone is handwriting, not evidence
about which number belongs (the pedagogy review's "do not diagnose math from motor error alone").
`firstResponseScore` is the share of items accepted first time. Phases: at most 12, drawings read as
another number first, in the order they happened. The submitted score and success are unchanged. The
judge's new `writtenAs` field is evidence only; 0 of 23 accept/reject decisions moved when it was added,
and it read the ink correctly 23 of 23 times.

**Capability (sequence only).** `numberTracerRemediation.ts`:
- Move `contrast_gap_positions_in_one_run`: the same four-number run on two neighbouring items with the
  gap moved (3, ?, 5, 6 then 3, 4, ?, 6), described for the K 0-9 and Grade 1 up-to-20 windows.
- Gates: `eligibleNumberTracerTeaching` (grade K or 1, mode sequence) and `numberTracerDeliveryEligible`
  (`targetEvalMode === 'sequence'`).
- `selectGapPositionContrast` rewrites the item after a later anchor, keeping the count, ids, window,
  tier flags and the builder's answer rule. `compiledGapPositionContrast` rechecks the rendered runs.

trace/copy/write get no move: they show the numeral to write, and write's instruction shows it (NT-10).
An observation about which number belongs has nothing to change there.

**Delivery and execution.** Catalog `misconceptionScope: 'skill'`, `observationDelivery: 'server'`,
`learningObservations: { eligible }`; no service or backend edit. The generator runs the planner in parallel
with the window call. It applies the selector only when the pinned mode is sequence and the session has
no handwriting items, then stamps `learningAdaptation { move, status, comparisonCount }`.
`buildSequenceChallenges` now prefers a new run for each item, so wide windows rarely contain the contrast by chance.

## Verification

| Layer | Result |
|---|---|
| `numberTracerRemediation.test.ts` | gates, compiled positives/negatives, selector keeps count/ids/flags/answers, narrow-window rule, capacity miss returns baseline |
| `gemini-number-tracer.adaptation.test.ts` | seeded baseline gains the contrast; 30 seeds ≥ 28 targeted; Grade 1; abstain and a foreign move byte-identical; no planner call without observations, in trace, or at Grade 2; private text absent; **3 of 6 fail with the selector removed** |
| `NumberTracer.capture.test.tsx` | mounted: two runs read as 6 and 8, corrected → evidence facts, score 95 / success unchanged, `evalMode: 'sequence'`, gate fires; all accepted or legibility-only rejections → no evidence |
| `numberTracerEvidence.test.ts` | 21 responses → 12 phases, every other-number reading kept, in order |
| `numberTracerObservationServer.test.ts` | real registry path: scope body, private text, trace and anonymous never read, abstention claims no origin |
| grader tests (eval-fix) | `NumberTracer.grading.test.tsx` 5, `gemini-number-tracer.sequence.test.ts` 3, each failing with its defect restored |
| Gates | `typecheck:lumina` 0; full tsc 770, no number-tracer diagnostics; vitest 440 files / 6204 tests; backend delivery pytest 6/6 |

**Real engines** (`scripts/probe-number-tracer-applicability.mjs`, expectations fixed before running;
artifacts `artifacts/learning-applicability/number-tracer/run1`, `run1-rates`):

| Stage | Result |
|---|---|
| Positive planner case per task shape (K, Grade 1) | 2/2 |
| Distiller | 5/5 as expected. Hypothesis for *after-run* ("writes the number that continues the sequence after the final displayed number rather than the number that fills the internal gap"), *neighbour* and *orientation* (6/9, copy mode). Abstained on *scattered* errors; the *single slip* (first-response 80) was stopped by the gate |
| Planner with delivered-shape evidence | 12/12: after-run, after-run + unrelated, after-run at Grade 1, neighbour → move; orientation and unrelated → abstain |
| Registry generation | 24/24 `pass`. Distilled ×2, two paraphrases ×2 each, neighbour ×2, hard and easy tier, Grade 1 ×2 → targeted with compiled pairs. Unrelated, orientation, teen digit order, counting back, contradictory ×2 each, and trace → unadapted. No `wrong-move`, `unexpected-abstain`, `content-drift` or `service-error` |
| Exploratory (number-line hop count) | 3/3 abstain (no pass criterion) |
| Authenticated (`backend/scripts/probe_number_tracer_authenticated.py`, `nt-http-qa-e9c1f11e…`) | PASS, cleanup verified: store with resolved K scope, 403 unsigned, signed delivery, unauthenticated / forged / write unadapted, 2 adapted draws, hypothesis still active, no receipt |
| Delivery replay, no login (pilot for the harness) | 2 signed calls with the right scope, 2/2 adapted with `source: saved-observation`, anonymous and forged unadapted, no private text |
| Window retest (NT-13) | 30/30, no failure, slowest 918 ms, windows in scope |

**Rates** (20,000 simulated sessions per window, code-owned builder + selector):

| Window | Chance contrast | Capacity miss |
|---|---|---|
| K 0-9, 1-9; Grade 1 0-20, 10-20, 0-10 | 0–0.1% | 0–0.4% |
| K 0-5 | 18.8% | 0% |
| K 1-5, 5-9 (two runs exist) | 75% | 0% |

In a five-number window the contrast is usually already present and is reported `already-targeted`;
the learner sees no change there.

**Failed or corrected runs, kept.** The first grader probe (transparent images) led to NT-5 and NT-6.
The first real-app drive failed on the wrong canvas, a race with generation, and single-item sessions
hiding "Finish"; all were drive bugs. The first rates run showed a 25–55% capacity miss in narrow windows
because the selector's rule was stricter than the builder's; the selector now uses the builder's rule.
The run1 `report.json` lost its rates when a second invocation rewrote it; they were rerun as `run1-rates`.

## Limits

- The drawings in every probe are canonical numeral paths with slant and wobble, not a child's handwriting.
- Evidence depends on one judge call per check. If that call fails, the check uses geometry and records no reading, so no evidence.
- K sessions never show 10 or teen numbers (band ceiling 9, NT-11), so Grade 1 windows are the only teen runs.
- Planner selection and delivered content are not learning, transfer or resolution.

## Residual

- `/misconception-test number-tracer` station inventory.
- NT-9 sequence answer reaches the tutor (`/tutor-test`), NT-10 write instruction shows the numeral (product ruling), NT-11 K ceiling below 0-10 and 11-20 (`/topic-fidelity`), NT-12 flat sequence tiers (`/add-support-tiers`).
- A handwriting-family move (e.g. numeral orientation) needs NT-10 decided first; queued in item 18.
- HUMAN-CHECKS #161.
- Harness: the per-primitive authenticated probe is replaced by the replay tier in the revised [handoff](../HANDOFF-misconception-probe-harness-2026-09-13.md).

Lines: production about 340 (new 162, component about 100, generator 63, judge 10, catalog 4), tests 460, probes 464, replay harness 127.
