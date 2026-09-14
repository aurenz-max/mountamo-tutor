# Fraction bar role-contrast consumer — 2026-09-13

Executor `/add-misconception-loop`; verify half `/misconception-test`. Outcome: **implemented and machine-verified for `build`; `identify` is not a legal target.**

## Scope change from the plan

The plan named `identify`. identify draws only unit fractions (1/2, 1/3, 1/4, 1/6, 1/8), so no number can be the numerator of one fraction and the denominator of another, and its denominator question never offers 1 (floor 2). The plan's own "holds" line (proper fractions, denominators 3–6) is the `build` window, where the move is legal. The plan also overstated `swap`: `wide` keeps the partner number too (insertion order), so build offers both numbers of each fraction at every tier.

## What shipped

| Station | Change |
|---|---|
| Evidence | `FractionBar.tsx` records every checked response into `studentWork.responses`; `fractionBarEvidence.ts` builds `DiagnosisEvidence` with per-phase expected/observed/support and `firstResponseScore` (fractions with all three questions right first try). Catalog `misconceptionScope: 'skill'`; `fraction-bar` added to `SERVER_DELIVERED_SOURCES` (no score-based resolution, prose blanked from generation-context). |
| Capture gate | Shared opt-in `firstResponseScore` gate by claude-web-tutor-03; the submitted score and success are unchanged. |
| Delivery | New shared, source-agnostic path owned by this slice: `service/generation/learningObservationServer.ts` → signed `POST /api/student-profile/learning-observation-context` → `scoped_misconception_observations` (active, skill-scoped, server-delivered producer, write-time `scope_context` subject/grade/skill equal to the resolved published scope; opaque IDs; ≤10; evidence ≤7000 chars). Client-supplied `learningObservations` are dropped; `source: 'saved-observation'` is stamped server-side only. `ctx.learningObservations` added. Consumed next by bar-model, number-line, fraction-circles and base-ten-blocks sessions. |
| Capability | `fractionBarRemediation.ts`: `contrast_shared_digit_roles`, eligible for `build` only. |
| Execution | `selectSharedDigitRoleContrast` reorders an existing pair first, else replaces one fraction; keeps count, window, uniqueness and the tier's choice builder. The planner runs in parallel with the number-free wrapper call. |
| Infra fix | `generation_auth.py` fell back to nothing when uvicorn was started without the key exported, so every signed route returned 403 "Generation certification unavailable" and delivery silently returned null for all consumers. It now also reads `settings.LUMINA_GENERATION_SIGNING_KEY`. Found independently by claude-web-tutor-6e. |

## Verification

- Unit/mount: `fractionBarRemediation.test.ts` (6), `gemini-fraction-bar.adaptation.test.ts` (4: seeded baseline without the contrast gains it, oracle clean, abstain/unknown move = byte-identical baseline, identify and blank make no planner call, private text absent from wrapper and output), `learningObservationServer.test.ts` (3: signed scope, forged observations/origin stripped, no delivery for ineligible/missing scope/no credentials), `FractionBar.capture.test.tsx` (2: swaps recorded factually with success/score unchanged, no evidence when all first tries correct). Backend `test_learning_observation_context.py` (3: producer/scope/status filter, lineage + bound + ordering, signature + owner + 422 on body identity). Existing fraction-bar oracle suite green.
- Full frontend suite: **6,077 passed / 10 skipped, 0 failed**. `typecheck:lumina`: zero errors in this slice's files; the only errors at run time were 4 in another session's in-progress `BaseTenBlocksDi.capture.test.tsx`.
- Real engines, fictional evidence (`scripts/probe-fraction-bar-applicability.mjs`, all draws saved under `artifacts/learning-applicability/fraction-bar/`): the real distiller diagnosed a successful score-87 session with `firstResponseScore` 0. **19/19 draws matched expectations defined before running:** distilled text (2), two paraphrases (2 + 3, including "Says the bottom number is how many are shaded") and hard tier (1) selected the move with a compiled consecutive contrast; unrelated (2), nearby comparison-by-denominator (3), contradictory evidence (2) and a place-value observation (2) abstained; identify with a positive observation made no change.
- Authenticated (`backend/scripts/probe_learning_observation_delivery.py`, run `fb-obs-qa-afd1b6675e3e4f7db75a9b98ed8d7729`): **PASS, cleanup verified absent.** Real Firebase auth, distiller, Firestore store with stamped scope; signed delivery returned only same-skill hypotheses (sibling subskill included, other skill excluded, grade 4 refused); unauthenticated and forged-observation baselines unadapted; two authenticated build draws carried `source: saved-observation`; identify unadapted; hypothesis unchanged, no other learner collections. The two earlier failed runs (connection reset during another session's reload; the 403 key defect) are retained in `qa/misconception/fraction-bar/`.

## Findings and limits

- **Low content yield.** 6 of 10 adapted draws were `already-targeted`: with 10 legal build fractions and 3 items, a consecutive role-swap pair usually occurs by chance. The move mostly guarantees the contrast rather than adding it; both authenticated draws left content unchanged. A higher dosage (e.g. a three-fraction chain) would need its own decision.
- Delivery matches on skill, not subskill: an observation from NF001-03-b also reaches NF001-03-a. The planner judges relevance.
- Not verified: browser drive of the adapted session, teaching effectiveness, learner transfer, resolution (fraction-bar has no resolution policy and no score-based clearing). Human check **#156**.
- Review artifact: `plans.json` fraction-bar entry updated to implemented; `build-review.cjs` was blocked by parallel consumers whose generators already carried the marker (number-line cleared 09-13; fraction-circles last), so index.html is not yet rebuilt. Whichever session finishes last runs build + check.
