# bar-model picture_graph misconception loop — 2026-09-13

Executor: `/add-misconception-loop` for the review row `bar-model / picture_graph · contrast_icon_count_and_row_value`. Built in parallel with the fraction-bar, fraction-circles, number-line and base-ten sessions; shared delivery is theirs (d8/ac), consumed here unchanged.

## Result

Capture repair + consumer connection **implemented and verified at runtime** (real planner, real generator, real distiller, authenticated store and signed delivery). Browser acceptance and teaching effectiveness are not verified.

- **Scope correction.** The plan targeted Grade 2 / 2.MD.D.10. The published Grade 2 math curriculum has no picture-graph subskill; scaled picture graphs are Grade 3 `MEAS003-04-a` ("symbols represent more than one unit… scale factors 2, 5, 10"). Delivery binds to that published scope. The catalog description still says 2.MD.D.10.
- **Evidence producer.** Every picture_graph choice set now includes the bare icon count; the answer key is unchanged. `BarModel` records every tapped option (`studentWork.selections`) and, when a first choice was wrong, submits a structured `DiagnosisEvidence` packet (prompt, key value, icon count, choices, selections in order, highlight state, `firstResponseScore`). Catalog: `misconceptionScope: 'skill'`; backend: `bar-model` ∈ `SERVER_DELIVERED_SOURCES` (published scope required at capture, no score/tag resolution).
- **Capability + execution.** `service/math/barModelRemediation.ts`: one move, `contrast_icon_count_and_row_value` — one targeted row with 5 icons (25), another with 1 icon (5), same key. Code-owned gate: single-mode picture_graph, medium, grade 2–3, no numbers named in topic/intent. `generateBarModel` plans once, then a deterministic selector changes at most two targeted rows (fewest changes first), recomputes answers/choices/axis max, and falls back to the code prompt/hint template when LLM text cites a stale number.
- **Delivery.** `geminiService` → shared `generateWithLearningObservations` (signed `/learning-observation-context`, same subject/grade/skill). Source attribution is stamped server-side.

## Verification

| Station | Evidence | Result |
|---|---|---|
| Unit: selector, options, gate, real generator with mocked model | `barModelRemediation.test.ts` (6). Removing the selector call fails the causal test (checked). Abstain / no observation / ineligible → identical output. | PASS |
| Mounted component | `BarModel.pictureGraph.test.tsx` (3): wrong-then-right submits selections + structured packet, `firstResponseScore` 50; all-first-correct submits none | PASS |
| Backend | `test_bar_model_observation_scope.py` (3): same-skill delivery and exclusions, no score/tag resolution, capture requires published scope | PASS |
| Real planner + generator | 14 draws, outcomes fixed before running ([report](bar-model/2026-09-13T12-24-58-436Z/report.json)): distilled + 2 paraphrases targeted; unrelated, nearby axis-step ×3, contradictory ×2, place-value digit-worth ×3 abstained. Independent JS recompile of every draw; no private text in output | 14/14 |
| Authenticated loop | [bm-http-qa-bcb994bd…](bar-model/bm-http-qa-bcb994bd63aa434882975f25c71126ed/authenticated-report.json): real distiller produced a hypothesis on success=true / score=90 / firstResponseScore=25 evidence → stored at MEAS003-04-a → invalid signature rejected → signed delivery returned it → 2 draws `source: saved-observation` with compiled contrast; baseline and hard tier unadapted; hypothesis still active, no receipt; cleanup verified | PASS |
| Gates | full frontend 6,077 passed / 10 skipped ([log](../../../artifacts/bar-model-picture-graph-full-tests.log)); `typecheck:lumina` 0; affected backend 59 passed | PASS |

Three earlier authenticated runs failed and are kept (`bm-http-qa-2add51bf…`, `-9ed555a1…`, `-fe3f0430…`, cleanup verified on all). Cause: the shared backend was restarted without `LUMINA_GENERATION_SIGNING_KEY` in its process environment, so every signed generation call returned 403 "Generation certification unavailable" and generation ran silently unadapted for all consumers. d8 fixed `generation_auth.py` to fall back to settings. The harness now requires the "invalid signature" rejection, because the old "unsigned → 403" check passed with no key loaded.

Full `tsc --noEmit` against baseline was not run: four sessions were editing the tree concurrently.

## Residual (queued in `qa/di/BACKLOG.md` item 18)

1. **Answer readable from layout — `/eval-fix`.** Picture graphs render a numbered axis under the icon rows (`showAxis` for `iconValue > 1`), so a row's total is the tick under its last icon; the key is not needed. This weakens the mode and the contrast.
2. **Baseline convergence — `/add-number-pool-service` or `/eval-fix`.** Several unadapted sessions had all four targets = 20; one authenticated draw asked about Bananas in all four challenges.
3. **Key/row mismatch — `/eval-fix`.** The key emoji can differ from the targeted category (🍎 key on a Bananas row).
4. **Other option modes** record selections but emit no evidence; spoken modes' runner observations are not forwarded as `learningResponses`.
5. **Human:** HUMAN-CHECKS "bar-model picture graph choices and capture" — choice row in a browser and a real session producing a stored observation.
