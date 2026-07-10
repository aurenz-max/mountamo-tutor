# Misconception Loop — Phase 1 build + runtime probes

**Date:** 2026-07-10
**Feature:** Misconception Loop (PRD_MISCONCEPTION_LOOP.md), Phase 1 — Capture on the live path
**Gate:** store/endpoint exercised at runtime; distiller fed the real pilot-shaped packet.

## What shipped

### Capture engine (frontend, shared)
- `usePrimitiveEvaluation.submitResult` — optional 6th arg `diagnosisEvidence`,
  attached to `PrimitiveEvaluationResult` (backward compatible; all existing
  4-arg call sites unchanged).
- `evaluation/diagnosis/captureMisconception.ts` (new) — fire-and-forget S2/S3:
  gate (failure + tier A/B + real subskill + once-per-(subskill, session), latch
  set synchronously before async work) → `/api/lumina` `distillMisconception`
  (real Gemini flash) → generative diagnosis → `POST /api/student-profile/misconceptions`.
  Abstain writes nothing; every error swallowed (a dropped write costs one
  diagnosis, never a submission).
- `EvaluationContext.submitEvaluation` — calls the capture AFTER the
  `/api/problems/submit` round-trip resolves. Subskill precedence: result's
  authoritative ID, else the backend-resolved `demonstratedSkill` from this very
  submission; no ID → no write.
- `evaluation/index.ts` re-exports the diagnosis contracts.

### Pilot family (S1 evidence packets)
| Primitive | Tier | Sites hooked |
|---|---|---|
| TapeDiagram | B | represent, part-whole explore (whole), part-whole segment, comparison, multi-step — comparisonData (quantities, comparison word, asked-for part) rides the challenge string |
| ComparisonBuilder | B | compare-groups, compare-numbers, order, one-more-one-less — both quantities + instruction wording in every observation (flagship fewer/difference surface) |
| CompareObjects | B | identify_attribute, compare_two, order_three, non_standard |
| PhonicsBlender | A | confident no-match verdicts logged per word; `judgeFeedback` = judge reasoning + optional misconception |

Shared pattern: session-scoped `wrongObservationsRef` (bounded 8) +
`noteWrongAnswer`; at session submit on a failed session the latest wrong
observation is the headline (challengeSummary/expected/observed) and earlier
ones become `priorAttempts` — the consistency signal. Clean sessions carry no
packet (byte-identical behavior).

### Tier-A judge fast path
`gemini-blend-judge.ts`: `blendJudgeSchema` + `BlendJudgeVerdict` gained ONE
optional flat string `misconception` (never in `required`; schema-complexity
ruling), threaded through both the structured and loose-JSON parse paths;
prompt instructs abstain-by-default, never the target word. Verified the field
survives the `/api/lumina` `judgeBlendAudio` hop (whole verdict returned).

### Backend (S3)
- `FirestoreService` (backend/app/db/firestore_service.py):
  `_misconceptions_subcollection`, `add_or_update_misconception`,
  `resolve_misconception`, `get_active_misconceptions` —
  `students/{id}/misconceptions/{subskill_id}`, lineage-resolved doc id,
  `.set()` overwrite preserving `created_at`, migration metadata, fail-soft
  batch read for S4.
- `POST /api/student-profile/misconceptions` (student_profile.py): ~30 lines,
  student_id from auth context (never the body), Pydantic min/max length on
  text, fail-soft `{stored:false}` on store errors.

## Runtime verification (exercised, not just typed)

1. **Store probe** (backend venv python, REAL Firestore, synthetic student 999903):
   add → active; batch read all/filtered/none; overwrite keeps ONE doc and
   preserves `created_at`; resolve flips + second resolve returns False +
   hidden from active reads; re-detect reactivates. ALL PASSED, probe docs deleted.
2. **Endpoint probe** (real FastAPI app via TestClient, `get_user_context`
   overridden): 200 `{stored:true,status:'active'}`, write visible in Firestore
   with correct attempt link; empty text → 422. PASSED.
3. **Distiller probe** (running Next dev server, real Gemini): the EXACT
   packet shape TapeDiagram's wiring emits for the comparison mode (3 wrong
   answers, each picking the smaller quantity) →
   `"The student interprets the question 'how many fewer' as asking for the
   smaller of the two quantities given in the problem."` — abstain:false,
   confidence:high, tier:structured, zero answer leakage. This is the PRD
   acceptance-test misconception, produced from the wired evidence format.
4. **tsc**: 807 errors = exact pre-existing baseline; 0 errors in any touched file.

## NOT verified (needs a browser check)
- The in-browser glue end-to-end: drive a wrong session on TapeDiagram or
  ComparisonBuilder in a lesson (authenticated) and confirm the doc lands at
  `students/{id}/misconceptions/{subskill_id}`. Every hop past `submitResult`
  is individually runtime-verified, but the full chain hasn't been driven from
  the UI. PhonicsBlender's live judge `misconception` output also needs a
  spoken-session smoke.

## Next
- Phase 2 — S4 `activeMisconception` in generation-context (insertion point:
  `_objective_state` / objectives_out assembly, batched via
  `get_active_misconceptions(student_id, subskill_ids)`), S5 `remediationFocus`
  threading + pilot generator prompt blocks, tape-diagram `remediationMove` enum.
- Add the new evidence shapes (ComparisonBuilder group-compare, PhonicsBlender
  judge-verdict) to the Diagnosis Lab golden set as they produce live packets.
