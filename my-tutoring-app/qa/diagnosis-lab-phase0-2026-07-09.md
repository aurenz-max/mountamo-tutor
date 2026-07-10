# Diagnosis Lab — Phase 0 live bench

**Date:** 2026-07-09
**Feature:** Misconception Loop (PRD_MISCONCEPTION_LOOP.md), Phase 0 — Contracts + Diagnosis Lab
**Gate:** bench review — diagnoses are student-model sentences, abstains are honest, no answer leakage.
**Model:** gemini-flash-latest (never flash-lite), via `/api/lumina` `distillMisconception`.

## Result: 10/10 expectation match — PASS

Live run of the golden evidence set (`evaluation/diagnosis/scenarios.ts`) through the
real distiller (`evaluation/diagnosis/distillMisconception.ts`).

| Scenario | Expect | Got | Verdict text (abridged) |
|---|---|---|---|
| maya-comparison | generative | generative/high | "…interprets 'how many fewer' as asking for the size of the smaller group, so they simply state the smaller number." |
| fraction-bigger-denominator | generative | generative/high | "…compares unit fractions by looking only at the denominators as whole numbers, believing a larger denominator makes the fraction greater." |
| subtraction-smaller-from-larger | generative | generative/high | "…subtracts the smaller digit from the larger digit in each column, regardless of which number is on top." |
| area-perimeter-confusion | generative | generative/high | "…believes the area of a rectangle is calculated by adding the lengths of all four sides." |
| reading-main-idea-judge (tier A) | generative | generative/high | "…equates the main idea with the first concrete fact stated in the opening sentence." |
| spoken-blend-first-sound-only (tier A) | generative | generative/medium | "…believes blending phonemes into a word requires only producing the first phoneme." |
| single-arithmetic-slip (OVERREACH trap) | abstain | abstain | single attempt, 6-vs-5 off-by-one slip |
| inconsistent-errors | abstain | abstain | errors follow no consistent rule |
| guess-then-quit | abstain | abstain | single attempt, 2s response — can't distinguish guess from misconception |
| tier-c-no-evidence | abstain | abstain | gate short-circuit, **9ms, no LLM call** |

## Honesty checks (Probe-D preview)

- **0 OVERREACH** — the single-slip trap correctly abstained.
- **0 LEAK** — no generative diagnosis contains the correct answer, a target number, or the
  correct rule. Maya = "state the smaller number" (predictive = min(a,b)), not "difference".
  Area = "adds four sides" (the wrong rule), not "length × width".
- **6/6 GENERATIVE on clear signatures** — all one sentence, student-model form, a distractor
  falls straight out of each.
- **Abstain-as-success confirmed** — 4/4 weak-evidence cases wrote nothing; Tier C never called the model.

## Verification status

- `tsc --noEmit`: zero NEW errors vs the 807-error baseline in any created/edited file.
  (Note: pre-existing untracked `service/qa/oracles/function-machine.ts` is corrupt —
  unterminated template literal — and poisons the full-project typecheck. Not part of this
  work; flagged for separate cleanup.)
- Behavior exercised at runtime against real Gemini (this bench). Browser Lab UI at
  `/lumina` → Developer Tools → Diagnosis Lab (🩺) renders the same run; not yet clicked-through
  in a browser, but the underlying endpoint is verified.

## Files (Phase 0)

- `evaluation/diagnosis/types.ts` — DiagnosisEvidence, MisconceptionDiagnosis/Abstain, classifyEvidenceTier
- `evaluation/diagnosis/distillMisconception.ts` — S2 distiller (schema, gate, abstain, flash-latest)
- `evaluation/diagnosis/scenarios.ts` — golden evidence set (10 packets, the compounding asset)
- `components/DiagnosisLab.tsx` — the bench UI (registered in DevPanelRouter + IdleScreen)
- `app/api/lumina/route.ts` — `distillMisconception` action
- `evaluation/types.ts` — optional `diagnosisEvidence` field on PrimitiveEvaluationResult (S1 handle)

## Next (not built this session)

Phase 1 — capture on the live path: **Firestore-native** misconception store (NOT the Cosmos
`add_or_update_misconception` the PRD names — Cosmos is deprecated per the 2026-07-08 ruling) +
`POST /api/student-profile/misconceptions` + evidence wiring on tape-diagram. Gate: Probe D.
