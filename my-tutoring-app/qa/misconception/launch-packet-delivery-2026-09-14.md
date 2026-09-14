# Learning-observation delivery: signed launch packet, no backend call during generation

Date: 2026-09-14. Executor: this slice (user direction), files under `/add-misconception-loop` ownership.
Uncommitted on `ship/2026-08-10-judged-loop`.

## What changed

User direction: the pipeline lives on the frontend; the backend is storage, learner ownership and
curriculum scope resolution. Before this slice the Next generation server called the backend once per
eligible item (HMAC-signed `POST /learning-observation-context`, learner token attached), so tests needed
a login, generation failed with the backend down, and the delivered shape was defined in Python.

Now the backend signs the learner's observations once, inside the existing launch read:

| Step | Where | What |
|---|---|---|
| Launch | `useExhibitSession` STEP 1.5 → `POST /generation-context` | objectives carry `grade`; response adds `learningObservations: { payload, signature }` |
| Packet | `backend/app/services/learning_observations.py` `delivery_packet` | owner's active, stamped, skill-scoped hypotheses (stamped scope verbatim, lineage-resolved `skillId`, `hypothesisId`/`revision`, evidence phases without item ids, cap 50) + each objective's live `resolve_scope` result |
| Signature | `backend/app/core/generation_auth.py` `sign_learning_observations` | HMAC-SHA256 with `LUMINA_GENERATION_SIGNING_KEY`, prefix `lumina-learning-observations:v1\n`, TTL 2 h; no key → `null` |
| Transport | `geminiClient-api.buildCompleteExhibitFromManifestStreaming(…, learningObservations)` → build-stream body; `/api/lumina` accepts it top-level too | client forwards the packet verbatim, never reads it |
| Verify | `service/generation/generationRequest.ts` `withGenerationRequest({ authorization, learningObservations })` | one verification per request (`openLearningObservations`); a bare token string is still accepted |
| Format + join | `service/generation/learningObservationPacket.ts` | types, sign/verify, per-task scope join (`subskillId` → published scope, subject and normalized grade equality), newest-first limit 10, 7000-char evidence bound, opaque ids, exact-scope `retestHypothesis` |
| Consumer | `learningObservationServer.ts` | reads the request packet; no fetch; receipt issuance is the only signed backend write left |

Removed: `/learning-observation-context`, `/misconception-opportunity-context`, `scoped_misconception_observations`,
`_bounded_evidence`, `backend/tests/test_learning_observation_context.py`, and six per-primitive
`probe_*_authenticated.py` (area-model, bar-model, fraction-circles, number-line, number-tracer,
`probe_learning_observation_delivery.py`). `probe_place_value_authenticated.py` now fetches the packet the way a
lesson does. `MisconceptionLoopTester` fetches the packet for its pinned objective before generating.

Costs accepted, as stated in the direction: a larger request body, observations fixed for the lesson, and the
signing key on both services (already true).

## Verification

| Check | Result |
|---|---|
| `backend/tests/test_learning_observation_packet.py` + ported `test_number_line_observation_scope.py`, `test_bar_model_observation_scope.py`, `test_observation_bridge_scope.py`; eleven observation/misconception files | 78 passed |
| `learningObservationPacket.test.ts` (signature, non-ASCII parity vector, expiry, tamper, scope join, lineage, limit, evidence bound, retest exact scope); `learningObservationServer.test.ts`; eight delivery suites ported from the fetch stub to `signedObservation` fixtures | pass; `src/components/lumina/service` + `src/app`: 2350 passed |
| `typecheck:lumina` | 0; full tsc 770 (legacy), none in touched files |
| Replay, number-tracer, packet signed by Python `--key`, 2 draws (`scripts/misconception-harness/replay-delivery.mjs`) | learner 2/2 `contrast_gap_positions_in_one_run` `targeted` `source: saved-observation`; anonymous, forged-config, tampered, foreign-key all unadapted; 0 backend calls during generation; no private text |
| Generic authenticated smoke (`backend/scripts/misconception_authenticated_smoke.py --case … --draws 2`, disposable learner, real Firestore, real Next generation) | PASS, cleanup verified: capture stamped with a published scope; `/generation-context` issued one packet whose signature verified under the configured key, with the live scope + curriculum version and the stored hypothesis, no attempt reference, legacy inventory prose blank; no-packet and forged/tampered draws unadapted; 2/2 packet draws adapted |

Finding while verifying: the shared `uvicorn --reload` on :8000 (py311env) did not pick up the backend edits
(a touch did nothing; `/openapi.json` still listed the removed routes). The smoke ran against a second backend
started from this checkout on :8001 (`LUMINA_SMOKE_BACKEND`). The first smoke attempt against :8000 failed at
the packet assertion for that reason and cleaned up (`qa/misconception/smoke/obs-smoke-c96a…`). Restart the
:8000 backend before driving a lesson.

Not exercised: a lesson launched in the browser as a signed-in learner with a saved observation
(HUMAN-CHECKS #162). The route, hook and client changes are covered by unit tests and the smoke drives the
same `/api/lumina` route with the same body shape.

## Follow-ups (queued in `qa/di/BACKLOG.md` item 18)

- Retest issuance (`/misconception-opportunities`) is still a signed generation→backend write. If it should
  also leave the generation path, the receipt becomes a signed token carried in the content and checked at
  submission — a separate slice with `submission_service.py` as its consumer.
- The probe-harness runner and fixtures (handoff steps 1–2) are unchanged in plan; the replay and smoke are
  their delivery stage.
