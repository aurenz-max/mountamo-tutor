# Catalog-declared observation consumers — 2026-09-13

Frontend half of the 2026-09-13 "catalog, not code" ruling (backend half: `misconception_opportunities.py` removed, `learning_observations.py` generic). Executor `/add-misconception-loop`, BACKLOG item 18 frontend residual.

## Finding

The user asked whether every new misconception consumer needs its own `if (item.componentId === …)` in the generation service. It did:

- `service/geminiService.ts` had six `componentId ===` delivery branches (place-value-chart, base-ten-blocks, fraction-bar, fraction-circles, bar-model, number-line). Five called the same wrapper with a per-primitive eligibility predicate; place-value called a different wrapper that also issued a retest receipt.
- `service/generation/learningObservationServer.ts`, `placeValueOpportunityServer.ts` and `numberLineRemediation.ts` each hardcoded `subject: 'MATHEMATICS'`, so a literacy consumer could never resolve a scope.
- The capture side (primitive → distiller → `/misconceptions`) was already generic: `captureMisconception.ts` reads `misconceptionScope` and `observationDelivery` from the catalog. Only delivery grew per primitive.

## Change

| Layer | Before | After |
|---|---|---|
| Catalog type | `observationDelivery: 'server'` only | `learningObservations?: { eligible(config); retest? }` (`types.ts`, `LearningObservationConsumer`, `LearningObservationRetest`) |
| Catalog entries | nothing | six `learningObservations` declarations in `catalog/math.ts`; the gates live with each primitive's remediation module (`*DeliveryEligible`), place-value adds `retest: placeValueRetest` |
| Generation service | six branches | one branch: `getComponentById(id)?.learningObservations` → `generateWithLearningObservations` |
| Observation server | `subject: 'MATHEMATICS'`; place-value in its own module | scope = `config.{objectiveSubject, objectiveGrade, skillId, subskillId}`; retest consumers read their own hypothesis via the primitive-keyed opportunity context and the same module issues the receipt from the catalog compiler |
| Manifest flatten | stamped `objectiveGrade` | also stamps `objectiveSubject` (manifest subject, else generation-context subject) on every component and the final assessment |
| Request scope | `placeValueOpportunityServer.withOpportunityRequest` | `generationRequest.withGenerationRequest` + `backend` (routes, trace script) |
| Place-value generator | planned on `ctx.remediationFocus` only | plans on `ctx.learningObservations`, `remediationFocus` fallback (same as base-ten) |
| Hardening | a client `remediationFocus` reached a server-delivered consumer when no context was available | the server strips `remediationFocus` and `learningObservations` from config for every declared consumer |

`placeValueOpportunityServer.ts` and its test are gone; the retest suite is ported to `learningObservationRetest.test.ts` and runs against the catalog declaration.

Adding a consumer now means: `observationDelivery: 'server'` + `misconceptionScope: 'skill'` + `learningObservations: { eligible }` in the catalog entry, and a generator that reads `ctx.learningObservations`. No service edit.

## Verification

- `typecheck:lumina` 0. Full `tsc --noEmit`: 771 errors, none in touched files (the one `api/lumina` hit is the pre-existing `.next/types` eval-test route error).
- vitest 95/95 across `service/generation`, `fractionCirclesRemediation`, `numberLineRemediation`, `service/manifest`. New: `catalogObservationDispatch.test.ts` drives `generateComponentContent` for fraction-bar through the real registry generator and the catalog declaration, and asserts every declared consumer is a server-delivered, skill-scoped source; `learningObservationServer.test.ts` asserts a `LANGUAGE_ARTS` scope flows through unchanged and a missing subject skips delivery.
- Authenticated probes, all PASS with `cleanup: verified absent`, against the live Next route and backend:
  - fraction-bar shared delivery (`fb-obs-qa-d72700f6…`): real distiller, stamped scope, signed delivery, two adapted build draws (already-targeted, targeted), forged observations ignored, identify ineligible.
  - place-value retest (`pvc-http-qa-650e7f19…`): private focus fetched through the catalog retest declaration, two compiled targets, student/revision-bound receipt issued.
  - number-line (`nl-obs-qa-073b0457…`): reviewed Grade 1 jump gate, `contrast_start_positions` targeted.
- Probe repair: `probe_learning_observation_delivery.py`, `probe_number_line_authenticated.py`, `probe_bar_model_authenticated.py`, `probe_fraction_circles_observation.py` posted captures without `delivery: 'server'` and had been stale since the backend ruling (no `scope_context` stamped, KeyError before generation). They now relay `subject` + `delivery`; bar-model and fraction-circles are patched but not rerun.

## Open

- USER RULING still owed (item 18): should a retest consumer (place-value chart) also receive shared-scope observations from other sources (blocks-origin)? The generic server keeps the two paths separate on purpose until then.
- Both servers were down when this slice started; they were restarted per the project commands (nothing else listened on :3000 / :8000).
- Uncommitted, shared working tree.
