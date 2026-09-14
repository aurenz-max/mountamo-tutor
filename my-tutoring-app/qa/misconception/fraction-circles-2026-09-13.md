# fraction-circles compare — misconception loop, 2026-09-13

Executor: `/add-misconception-loop`. Verification half: `/misconception-test` (not yet run as its own pass). Uncommitted.

Result: **capture repair plus consumer connection implemented; machine verification PASS.** A saved observation that a learner judges fraction size by the number of slices now reaches Grade 3/4 compare lessons at medium support. When the shared planner selects the move, two pairs are rewritten to share a numerator (for example 2/4 vs 2/6). No learner transfer, teaching effectiveness or browser capture is claimed.

## What changed

| Station | Change | Files (under `my-tutoring-app/src/components/lumina/` unless noted) |
|---|---|---|
| Capture | Compare advances only after a correct answer, so it always submitted score 100 and capture never fired. Every compare response is now recorded in `student_work.compareResponses`. A session with any wrong response attaches factual `DiagnosisEvidence` (each pair's first response, earlier wrong responses, `firstResponseScore`) and opts into the shared first-response gate added by the number-line session. The packet states choices only. | `primitives/visual-primitives/math/fractionCompareEvidence.ts`, `FractionCircles.tsx` |
| Scope | `misconceptionScope: 'skill'`; `fraction-circles` added to `SERVER_DELIVERED_SOURCES` (canonical scope stamped at write, prose kept off the client manifest, no score-based resolution). | `service/manifest/catalog/math.ts`, `backend/app/services/misconception_opportunities.py` |
| Delivery | Shared `generateWithLearningObservations` (owned by the fraction-bar session) with a fraction-circles gate: compare, medium, and one of five reviewed subskills whose comparison structure admits same-numerator pairs (G3 NF001-02-e, NF001-06-b, NF001-06-c; G4 NF002-02-b, NF002-02-e). Like-denominator, benchmark and common-denominator objectives are excluded. | `service/geminiService.ts`, `service/math/fractionCirclesRemediation.ts` |
| Capability | `contrast_same_numerator_denominators`: same numerator, different denominators, equal-sized wholes. States that unequal parts, like-denominator comparison and naming/shading/building cannot be taught here. | `service/math/fractionCirclesRemediation.ts` |
| Execution | Planner runs alongside the content draw. After validation and tier flags, a deterministic selector rewrites one fraction in at most two pairs that share neither numerator nor denominator and are not equal, using the grade's legal denominators (Grade 3: 2, 3, 4, 6, 8; a named family narrows them). Compare instructions are rebuilt from the final values. All-or-nothing; reports targeted / already-targeted / insufficient-capacity. Explicit fractions in the topic, intent or objective statement block adaptation. | `service/math/gemini-fraction-circles.ts`, `FractionCircles.tsx` (metadata type) |

## Verification

Expected outcomes were fixed in the probe scripts before any model call.

- **Unit/mounted.** `fractionCirclesRemediation.test.ts` (5): causal selector change against a fixed baseline, preserved ids/types/flags/untouched pairs, capacity, code gates, the real generator with observation text absent from content calls and output, the delivery gate and wrapper-owned source stamp. `FractionCircles.capture.test.tsx` (2): a mounted wrong-then-right session submits score 100 with `firstResponseScore` 33 and factual phases; an all-correct session attaches nothing. Existing fraction-circles suites (grade-band, touch, mixed, FractionTouch) green.
- **Gates.** Full frontend suite 6,077 passed / 10 skipped. `typecheck:lumina` 0. Full tsc 771 errors, none in touched files. Backend observation/misconception suites 61 passed.
- **Real distiller** on the component's own evidence builder (fictional five-pair session, four first responses choosing the circle with more slices): *"The student judges fraction size by the total number of slices the circle is divided into rather than the shaded area, so they choose whichever circle has more partitions."*
- **Real planner**, 9 cases × 3 draws = 27/27 as expected. Selects for the distilled text and two paraphrases (eighths vs fourths; same shaded count, more slices). Abstains for counting unshaded slices, shading when building, adding denominators, a like-denominator error, unequal parts, and unreliable evidence. With the backend's evidence packet attached: 3/3 select.
- **Real registry generations** (eval-test path, Grade 3, medium): baseline, distilled, paraphrase, unrelated and unequal-parts cases. Adapted only where expected; `comparisonCount` matched the compiled same-numerator pairs; labels hidden, tier and instructions intact; no observation text in output.
- **Authenticated** `backend/scripts/probe_fraction_circles_observation.py`, run `fc-http-qa-3d3f963ccc994f1fab6be6e14b4ebddf`: PASS. Forged signature rejected by the signature check; capture stored one active skill-scoped record with canonical scope; the signed read returns it for NF001-06 and nothing for NF001-02; unauthenticated baseline, the like-denominator objective, and a reviewed objective in another skill were unadapted; two delivered draws targeted (`2/4 vs 2/6` + `1/6 vs 1/2`; `1/2 vs 1/3` + `3/4 vs 3/6`) with `source: saved-observation`; hypothesis unchanged, no receipt, cleanup verified.

Evidence: `artifacts/learning-applicability/fraction-circles/` (distiller, planner with raw model output, every generation draw, planner-with-evidence), `artifacts/learning-applicability/fraction-circles-*.log`, `qa/misconception/fraction-circles/<run>/`.

## Failures kept

- Two authenticated runs before the PASS came back unadapted. The first ran while the backend process had no signing key (every signed call 403; fixed by the fraction-bar session). The second is unexplained: the direct signed read succeeded, and a local replica of the Next path (`scripts/trace-fraction-circles-delivery.mjs`, `--trace`) delivered and targeted with the same token. Backend reloads caused by concurrent sessions' saves are the likely cause; the shared delivery degrades silently to unadapted content, which is fail-soft by design but invisible. Reports retained under `qa/misconception/fraction-circles/`.
- An early harness "unsigned → 403" check passed for the wrong reason while the key was missing. The probe now requires the signature-check detail.

## Residual work

1. **Grade 3 content scope** — Grade 3 draws use denominators 5, 10 and 12 and wholes (2/2, 4/4) in untouched pairs; the 3-5 pool is wider than the Grade 3 standard (2, 3, 4, 6, 8). Pre-existing, outside this move. Executor `/topic-fidelity`.
2. **touch_fraction capture** — declaring the scope lets failed touch sessions reach the distiller and store observations (they never match the compare gate). Not probed. Executor `/misconception-test`.
3. **Threshold** — the shared gate needs first-response accuracy below 60%; two misses in five pairs is not captured. Shared decision, not changed here.
4. **Browser and teaching** — tap → saved observation → next lesson, and whether the pairs help a child: HUMAN-CHECKS row.
5. **Second move** — a same-denominator contrast (2/6 vs 5/6) after learner evidence on this one.
