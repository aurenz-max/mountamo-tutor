# number-line contract check — reader-fit 14k

**Date:** 2026-08-04  
**Verdict:** COMPATIBLE — C1 resolved by a scoped contract fork.

## Change checked

The 14k slice lets an explicit canonical Grade-1 missing-number objective retain a full
0–120 domain, prefers the intent's local focus window, and gives exact missing-number
`between` cards additive `exactTargetValue` metadata with adjacent bounds. It does not
remove the ordinary K-2 legibility clamp or change legacy any-interior `between` grading.

## Requirement replay

| Contract surface | Result | Evidence |
|---|---|---|
| R1 range resolution | PASS | Live exact probe retained `range:{min:0,max:120}`. |
| R2 canonical grade | PASS | Live exact probe retained `gradeBand:'K-2'`; existing grade-band regression suite passes. |
| R3 K identify pin | PASS | Focused K counting-to-5 plot control stayed within 0–5; full suite covers identify. |
| R4/R5 jump + order | PASS | No contract/schema change; full Vitest passes. |
| R6 between fork | PASS | Exact 104–106 accepts only 105; ordinary between emits no exact target and accepts any interior value. |
| R7 support/difficulty | PASS | Exact adjacency bypasses `boundGap`; legacy bound-gap behavior remains covered. |
| R8 local display window | PASS | Browser rendered the 0–120 task as a legible local window; focus targets were 97, 100, 105, and 106 in the live probe. |
| R9 distinctness | PASS | Four live exact targets were distinct. |
| R10 theme neutrality | PASS | No personalization/theme surface changed. |
| R11 tutor handoff | PASS | `visibleMin`, `visibleMax`, and `exactTargetValue` resolve; tutor-test reports zero findings. |
| R12 hard config | PASS | Full regression suite passes; magnitude widening remains scope-driven, not difficulty-driven. |

## Compatibility boundary

- Existing K and generic K-2 ranges keep the protective clamp.
- Existing `between` payloads without `exactTargetValue` keep any-interior grading.
- The widened ceiling is limited to canonical Grade 1 with an explicit resolved range
  above 30 and no higher than 120.
- The full range, local focus window, and exact-task identity are represented separately.

## Gates

- Reader-fit focused suites: **29/29**.
- Full Vitest: **1,569/1,569**, 138 files.
- TypeScript: **0 errors in the touched surface**; repository-wide run reported 805,
  including two unrelated existing `gemini-story-map.ts` errors in the dirty tree.
- Real `/api/lumina/eval-test`: PASS, 4/4 exact adjacent challenges in 0–120.
- Tutor live: standalone **3/3**, lesson **3/3**, no answer leakage.

