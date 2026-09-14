# Place-value opportunity contract — 2026-09-12

**Curriculum fit, generation and real Firestore transactions pass; HTTP retry safety and authenticated learner acceptance remain OPEN.** The original tag-without-opportunity false-resolution path is closed. Follow-up verification created one disposable synthetic student and removed its records with verified cleanup. No curriculum edits, commits or pushes were made.

Starting HEAD: `34a88028121e0fddce55f6892f881fb7b36cd422`. The already-untracked handoff was preserved. Required project/skill instructions were read; work and verification were performed without subagents.

## Change

Place-value resolution now uses server-certified compiled opportunities bound to student, server build request, component instance, canonical curriculum scope/version and hypothesis revision. Re-diagnosis increments the revision transactionally. Issuance checks the current revision; resolution atomically consumes the receipt with the canonical attempt ID after normal learning fan-out.

The production generation wrapper uses the existing registry/compiler. Private focus and certification travel over an additional signed service boundary. The browser receives an opaque reference and public context; the generation-context projection no longer returns stored place-value diagnosis prose. Capture sends the lesson grade and resolves published parent/version on the backend, without parent-ID slicing.

Policy `place-value-immediate-retest-v1` requires both same-digit/different-place diagnostic items to have correct first voiced responses, agreeing transcripts and affirmations. Every compiled item must open/close in order. Corrections, extra responses, missing/mismatched turn timing, late transcripts, tutor-audio overlap, replay and resync abstain. A diagnostic failure vetoes resolution regardless of average score. Legacy records cannot fall back to the score/tag rule. [Design, policy and trust limits](../ADR-misconception-opportunities-2026-09-12.md).

## Verification

| Check | Result and boundary |
|---|---|
| Initial defect | At original HEAD, a 100% matched tag without a receipt produced `fanout, resolve`; regression failed. |
| Revert non-vacuity | In-memory reversion fails the regression; restoring the new gate passes. Worktree is never reverted. [Log](../../../artifacts/misconception-opportunity-nonvacuity.log). |
| Backend | **73 passed**: policy vetoes, canonical scope, HMAC boundary, private-field rejection, storage method bodies, re-diagnosis, stale revision, duplicate consumption, modeled optimistic race, optional storage failure, fan-out and existing family/Live-harness tests. [Log](../../../artifacts/misconception-opportunity-backend.log). |
| Frontend | **5,978 passed, 10 skipped** across 384 passing files. Includes production compiler/server wrapper and mounted component + real runner with mocked speech transport. The prior fraction-circles failure does not reproduce. [Log](../../../artifacts/misconception-opportunity-full-unit.log). |
| Typecheck | Lumina **0 errors**. [Log](../../../artifacts/misconception-opportunity-typecheck.log). |
| Real generation | Four production `/api/lumina` calls: baseline, one-challenge saturation, one two-target contrast, one genuine compiler saturation. No receipts without authenticated reviewed scope. [Raw run](place-value-opportunities/2026-09-12T20-53-11-606Z/report.json). |
| Cross-language join | TypeScript recompiles the saved positive draw; Python uses those exact items/hash in production storage/submission methods. Persistence is modeled, not real Firestore. |
| Browser | Rechecked inventory: `apps: []`, `browsers: []`. No authenticated browser or microphone acceptance claimed. |

The second real targeted draw was `[4375, 3172, 1302]`, with both analyze highlights asking for three hundred. The compiler suppresses repeated worth; the selector preserves baseline item allocation, so it cannot manufacture a second surviving worth item. Certification correctly returns no eligible plan. The initial probe expected two targets on every draw and recorded **FAIL**; that artifact is retained. The probe now distinguishes saturation from targeting and still requires one positive draw. It was not rerun merely to replace the failure. Both saved real draws are permanent regression fixtures.

The generation probe reused the previous recorded synthetic real-D diagnosis, identified in its report. It did not make new D calls. Prior same-payload Live evidence remains historical; this slice did not rerun Live. Tutor script strings and IRT behavior were preserved.

## Open activation and acceptance gates

1. **Curriculum — closed for this bounded pilot:** Grade 4 `NBT004-01-b` is reviewed at its exact current publication, for 1111–9999. Grade 3 remains incompatible. [Fit report](../curriculum-fit/place-value-chart-2026-09-12.md).
2. **Service configuration — ready locally:** dedicated signing credentials are configured in the existing ignored backend/frontend env files, and Next targets `127.0.0.1:8000`. Backend settings now accepts the signing field with repr disabled. The key was rotated after the first startup validation error. No production deployment configuration was changed.
3. **Deployed authorization — verified:** the Firebase Rules API returned deployed ruleset `518d3ad9-c7fb-4f26-8f09-bfb4ed5eed4f`, which denies client access outside the owner-scoped user_profiles tree. Authenticated REST reads and writes to the disposable private hypothesis both returned 403. Rules snapshot: `artifacts/misconception-deployed-rules.json`.
4. **Authenticated runtime — API portion passes:** real Firebase sign-in → authenticated diagnosis capture → Next private-context fetch → production generation → signed issuance → student/revision-bound receipt passed. [API evidence](place-value-opportunities/pvc-http-qa-2b1fa50ecef746f6813e784ce95bd780/authenticated-report.json). Mounted microphone responses and canonical learning submission remain unverified. Prior [real-store evidence](place-value-opportunities/2026-09-12T21-17-43-669Z/real-store-report.json) separately proves consumption and contention.
5. **Human checks:** #113/#63 remain open. Headless generation or Live cannot close them.
6. **Submission retry safety — implementation owed:** repeating the HTTP submission still mints another normal attempt. Complete a stable request identity and safe fan-out/replay contract before claiming the handoff's retry requirement. Executor: `student-data-loop`; owned by DI backlog item 18.

## Grade 4 follow-up

Live retrieval and published-objective inspection found an existing compatible scope, avoiding a new mode or curriculum edit. The code change is small: allow Grade 4 deterministic selection and bind backend certification to one reviewed publication. Both targeted real generation draws retained two eligible items; baseline and saturation remained without receipts. [Generation run](place-value-opportunities/2026-09-12T21-17-43-669Z/report.json).

The real-store probe rejected an empty plan and wrong transcript, resolved exactly once under two concurrent consumers, joined the winning attempt reference on receipt and hypothesis, and rejected a receipt after re-diagnosis. It used synthetic diagnosis/events, not real speech or canonical progress writes. Cleanup was verified. Run `backend/scripts/probe_place_value_opportunity_store.py` with the saved positive artifact to repeat this bounded write probe.

Follow-up verification: **74 backend tests passed**, **5,979 frontend tests passed / 10 skipped**, and **Lumina typecheck 0 errors**. The initial full frontend run failed the unchanged AppChrome shortcut and solar-system mixed-diversity tests; both passed in isolation (22 tests), and the complete suite then passed without further source changes. Both full-run logs are preserved: `artifacts/place-value-grade4-full-unit.log` and `artifacts/place-value-grade4-full-unit-recheck.log`; backend/typecheck logs use the same prefix. No claim that the initial full run was clean.

No global taxonomy, sibling policy migration, new launcher or universal submission-idempotency rewrite was introduced. Receipt consumption is idempotent; separately repeating the existing HTTP submission can still create another ordinary attempt. Optional remediation failure returns the normal learning response and does not request a retry.

## Rerun

### Dedicated interactive tester

Open Lumina → Developer Tools → **Misconception Loop**. This pins place-value-chart / Grade 4 / compare / medium / `NBT004-01-b`, sends the current Firebase token to generation, and preserves the generated instance ID when mounting the actual chart. Finish the first activity, wait for submission and diagnosis capture, then use **Refresh saved status** and **Generate next activity**. The next activity explicitly reports whether a receipt exists. A missing receipt remains ordinary practice; no successful-resolution claim is inferred from score. The status projection reads only the signed-in student's record and omits diagnosis prose and private certification fields.

Completed activities use the normal EvaluationProvider, canonical submission and diagnosis capture. They update the signed-in account's learning records; use a designated test account for deliberate error enactments. Automatic retries and pending-storage persistence are disabled in this panel while the general submission-idempotency gap remains open. A failed submission blocks the next activity and requires inspection rather than blind replay. This is a dedicated QA surface requested by the user, not a new student lesson launcher, planner test, or synthetic diagnosis seeder. The real microphone sitting remains OPEN.

Tester verification: 5,983 frontend tests passed / 10 skipped; 75 backend tests passed; Lumina typecheck 0. The panel integration tests use the real evaluation provider/hook with mocked voice component and network; they prove pinned auth/config, stable identity, canonical submission/capture dispatch, failure gating and sign-in gating. The live authenticated probe also verified the actual status endpoint: [run](place-value-opportunities/pvc-http-qa-c34241b75bed45eba5bc0eaa57c5a67b/authenticated-report.json). Logs: `artifacts/misconception-tester-full-unit.log`, `artifacts/misconception-tester-typecheck.log`, `artifacts/place-value-tester-authenticated.log`.

`backend/scripts/probe_place_value_authenticated.py` exercises real auth and local HTTP services with a disposable Firebase identity, Cosmos student mapping and ownership-marked Firestore student. It deletes those records and verifies absence. It intentionally does not send synthetic answers through canonical submission because that path updates shared item calibration. Use actual learner responses or an isolated calibration environment for that gate.

The first HTTP run failed because Next resolved localhost to `::1` while the backend listened on IPv4. It is preserved as `pvc-http-qa-49fe8b86578d48c193a45255fc47c4f1`. A subsequent full-composer check exposed the numeric-anchor veto on published curriculum examples. A failing-then-fixed regression now accepts only the exact reviewed Grade 4 objective text; numeric anchors in topic/intent and modified objective text still abstain. The final authenticated run uses the full published objective. No broad numeric-anchor parser or curriculum edit was introduced.

Authenticated-slice checks: 5,980 frontend tests passed / 10 skipped, 74 backend tests passed, Lumina typecheck 0. Logs: `artifacts/place-value-authenticated-full-unit.log`, `artifacts/place-value-authenticated-typecheck.log`, and `artifacts/place-value-authenticated-composer-probe.log`. The saved generated receipts belong to deleted disposable records; they are historical evidence and cannot be reused for a live resolution.

From `backend`, using the existing backend Python environment:

```powershell
& 'C:/Users/xbox3/miniforge-pypy3/envs/py311env/python.exe' -W ignore scripts/probe_opportunity_nonvacuity.py
& 'C:/Users/xbox3/miniforge-pypy3/envs/py311env/python.exe' -W ignore -m pytest tests/test_misconception_opportunities.py tests/test_place_value_misconception.py tests/test_misconception_generation_context.py tests/test_misconception_round_trip.py tests/tutor_live/test_run_tutor_live.py -q -p no:cacheprovider
```

From `my-tutoring-app`: `npm.cmd test -- --run`, `npm.cmd run typecheck:lumina`. With its configured dev server, `node scripts/probe-place-value-opportunities.mjs` makes four real generation calls and saves a timestamped artifact. It uses quota and never writes learner state.

### Frontend learning-observations preview (2026-09-12)

My Progress and the Misconception Loop tester share `LearningObservationsPanel`: explicit opt-in fictional profile, expandable evidence and support history, uncertainty/status, teaching implications, and exact subject/grade/subskill selection with exclusion reasons. Switching activity scope or disabling context updates the proposed generation/evaluation payload. Evaluation guidance preserves the current rubric and independent-response distinction. This preview makes no requests, writes no learner records and does not change live generation. Real profile loading and Gemini delivery are the next integration, after product review. Six focused tests pass and Lumina typecheck is zero; a visual browser check is still needed (no browser surface available to the agent).

### Saved observations behind the frontend (2026-09-12)

The shared judged runner now supplies correction item/phase evidence to the existing Next distiller, which returns a hypothesis plus teaching implication and next-check guidance. Capture persists the bounded problem/phase packet with the existing misconception record after normal submission. The authenticated owner-only learning-observations projection feeds My Progress and the tester; successful capture triggers refresh. Samples remain opt-in and separate. Active hypotheses display as suspected, regardless of model confidence. This is still the existing failure-only, per-scope capture policy and latest-record storage, not an accumulated strengths/history engine. Source references retain the existing client attempt identity; canonical attempt/retry reconciliation remains outstanding. Context selection previews use saved records now, but automatic generation/evaluation-context delivery remains the next slice.

Verification: full frontend suite 5,987 passed / 10 skipped, plus one separately added saved-profile refresh/owner-isolation test; 43 focused backend tests passed; Lumina typecheck zero. Real Next LLM -> authenticated Firestore -> profile projection passed with synthetic evidence and a disposable identity, cleanup verified: `place-value-opportunities/pvc-http-qa-ebe0e2625ed948e9a1d96b9f602081cc/authenticated-report.json`. Reproduce with `scripts/probe_place_value_authenticated.py --observations-only`. This does not certify a live microphone journey or next-generation adaptation.

### Empty-profile capture visibility (2026-09-12)

The tester now displays the capture stage and reason from the shared evaluation provider: skipped, distilling, abstained, saving, stored or failed. Storage is reported only on explicit backend confirmation. The owner profile distinguishes legacy diagnoses missing phase packets using `legacyCount`; no backfill or invented observations. The current capture policy remains failure-only. Focused frontend tests (11 plus a separate provider-to-tester status test), two backend tests and Lumina typecheck pass. Browser microphone acceptance is still open.

### 67% completed activity lost diagnosis evidence (2026-09-12)

Confirmed user attempt: place-value-chart 67% submission returned HTTP 200; review saves to CosmosDB and Firestore succeeded. Root cause: the runner assembled diagnosisEvidence only below its 60% pass threshold, while the chart submitted success=false for an unsolved phase. Capture received no evidence and skipped. Shared runner now preserves correction evidence irrespective of the aggregate pass threshold; capture still owns qualification/abstention. Place Value also includes the generated problem and diagnosis evidence in canonical student_work so future review records retain them independently of LLM capture.

Mounted regression reproduces phase scores 67/100/67/0/100 and fails before the fix, passes afterward. Backend submission test verifies problem/evidence reaches both review writers with the canonical attempt ID. Full frontend suite: 5,993 passed, 10 skipped; three focused backend tests pass. Real authenticated LLM/store/profile probe at score 67 and success=false passes with disposable cleanup: `place-value-opportunities/pvc-http-qa-dfb8ab86b49f49c2bb54ee18296aba42/authenticated-report.json`. This verifies upload/capture separately from microphone quality; historical evidence discarded before submission is not reconstructed from percentages.

### Saved observation drives generation (2026-09-12)

Place-name/value confusion now maps narrowly to `contrast_place_name_and_value` for compare/medium in the existing reviewed scope. The existing bounded selector chooses the same nonzero digit across two positions, preserving paired find-place/say-value compiler items, task allocation, number bands, support and scripts. The wrapper LLM receives no diagnosis text. Safe `learningAdaptation` metadata reports targeted/already-targeted/insufficient-capacity and trusted saved-observation origin in the tester. Certification explicitly accepts only the older digit-worth move; this new adaptation cannot resolve a hypothesis through that unrelated policy.

Checks: 27 focused contracts; full frontend 5,994 passed / 10 skipped; Lumina typecheck zero. A fixed-seed generator regression proves changed content (not a no-op), preserves allocation and prevents new-move certification. Real LLM diagnosis -> authenticated saved record -> two targeted real generation draws passes; baseline is unadapted and both targeted draws preserve scope/count/mode. Evidence: `place-value-opportunities/pvc-http-qa-a55fe2b3dfc143ae992de47ca6b80eb2/authenticated-report.json` and its generation files; disposable cleanup verified. Reproduce via `probe_place_value_authenticated.py --observations-only --generation-context`. Gate is PASS for generation targeting; live teaching effectiveness and resolution for place-name confusion remain OPEN. No broader primitive rollout or general evaluation-context injection is claimed.
