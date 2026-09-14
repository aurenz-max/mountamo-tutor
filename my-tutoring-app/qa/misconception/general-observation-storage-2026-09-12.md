# Shared observation capture and storage

This continuation moves the math pedagogy review's common evidence/profile foundation beyond the tester-only preview. It does not claim that all 69 entries implement the five-stage elicit/discriminate/teach/fade/transfer sequence.

`EvaluationContext` now dispatches `captureLearningObservation` after accepted submission. Evidence, resolved scope and signed-in identity gate the shared path; aggregate success does not. It reuses the successful-response distiller, confirms authenticated storage before reporting success, and refreshes the saved profile. A changed signed-in identity during distillation prevents a write. Score-only input and model abstention save nothing. Failed observation writes can be retried without replaying canonical learning submission; this does not repair generic submission retries.

Backend POST `/api/student-profile/learning-observations` validates bounded successful-response evidence, distinct cited items in one phase, and recorded corrections for support observations. Identity comes from authentication. Records are immutable and keyed by client attempt plus primitive; duplicate requests preserve the first inference. Curriculum IDs pass through the existing lineage resolver. Storage is `students/{id}/learning_observations`, separate from misconception slots and progress/calibration/rollup writers. GET returns the most recent 50 plus existing diagnosis projections. Answer keys remain private; projected speech is explicitly unverified transcription. All observations remain tentative, with client activity references explicitly not certified as canonical attempt joins.

Only Place Value currently emits the new successful-response ledger. Shared capture/storage contains no Place Value-specific dispatch. Saved strengths/support are inspectable in My Progress and the tester; their generation/evaluation payload is still a preview. Existing scoped place-name/value generation targeting remains the sole live saved-focus consumer in this pilot. No support fading, new representation bridge, mastery transition or broader rollout is claimed.

Verification:

- Frontend: **6,002 passed / 10 skipped**, Lumina typecheck **0**. Logs: `artifacts/general-observations-full-tests.log`, `artifacts/general-observations-typecheck.log`.
- Backend: **5 passed**, covering owner-only projection, invalid citations/kinds/status rejection, distinct attempt storage, immutable retries, and existing evidence/review persistence. `artifacts/general-observations-backend.log`.
- Real Next LLM → authenticated Firestore → profile: [PASS with cleanup](place-value-opportunities/pvc-http-qa-da7b82ddce4e4396b67df3c9698a7339/authenticated-report.json). Strength and support both persist, retries retain the first summary, the existing active diagnosis and revision remain unchanged, and direct Firebase client access is denied. Fictional evidence, disposable learner; no canonical learning submission or shared calibration mutation.
- Review rebuilt from `progress.html` / `build-review.cjs`. `check-review.cjs` validates scripts, two saved observation examples, existing generation evidence, links and all 69 inventory entries.

Reproduce from backend with the documented Python environment: `scripts/probe_place_value_authenticated.py --general-observations`. Both local services must already be running. Do not start a second Next instance. The harness returns before its final console print; inspect the saved report.

Next: implement and verify a second producer/consumer through the shared contracts, then demonstrate one scoped teaching decision. Preserve current-rubric grading and distinguish assistance detection from demonstrated support benefit. Canonical retry identity, longitudinal reconciliation, deliberate fading, transfer and human #113/#63 acceptance remain open.
