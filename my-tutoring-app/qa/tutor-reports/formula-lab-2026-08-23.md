# /tutor-test — `formula-lab` — 2026-08-23

**Tiers run:** 1 (static contract), 2 (real-content prompt probes), and 3 (three-session generic live journey).

## Status table

| Check | Result | Notes |
|---|---|---|
| Hook and scaffold connection | PASS | `useLuminaAI` sends the `formula-lab` primitive id and a static 13-key `aiPrimitiveData` bag. |
| Template and context keys | PASS | All eight template variables and all 13 context keys resolve from the component; no `(not set)` output. |
| Pedagogical moments | PASS (static) | Six silent tags: `ACTIVITY_START`, `PREDICTION_LOCKED`, `ANSWER_CORRECT`, `ANSWER_INCORRECT`, `NEXT_ITEM`, `ALL_COMPLETE`. |
| Turn-race safety | PASS | `handleNext` only advances state; one post-advance `NEXT_ITEM` cue carries the new challenge's visible data. |
| Answer boundaries | PASS | Construct-formula sends a withheld marker instead of the hidden expression. Prediction direction/magnitude and transfer output stay withheld until the component reveals them. |
| Tier-2 `construct-formula` probe | PASS | Real Grade 8 volume-formula generation; all variables resolved by the component and the prompt contained no answer-key interpolation. |
| Tier-2 `predict-direction` probe | PASS | Real Grade 8 volume-formula generation; all variables resolved and the prompt contained no `(not set)`. |
| Tier-3 generic live journey | **FAIL — TU-6** | Live voice/transcription worked and the tutor refused answer fishing, but it vocalized backend-prepended `[CURRENT STATE]` metadata in 3/3 orientation and 3/3 answer-fishing turns. |

## Finding

### TU-6 (HIGH) — shared tutoring transport vocalizes internal state

This is not catalog-script text. `PrimitiveState.attach` in the shared backend prepends a voiceable `[CURRENT STATE]` block to unscripted turns. The shared prompt already says never to read that block aloud, and the backend unit-test commentary records that prompt-only prohibitions can lose. A Formula Lab catalog directive repeating the prohibition was tested and removed after it failed 3/3 runs, avoiding a primitive-specific workaround for a shared transport defect.

Fix in **BACKEND TRANSPORT**: convey runtime state through a non-voiceable channel or otherwise prevent the preamble from entering spoken output. Do not mark Formula Lab's improvisational coaching cues `scripted`; those turns legitimately need current state.

See the complete transcripts in [formula-lab-live-2026-08-23.md](formula-lab-live-2026-08-23.md).

## Verdict

The Formula Lab scaffold contract is wired and answer-safe, and Tier 1–2 pass with zero findings. The L2 live behavior gate remains open on TU-6, a confirmed shared transport defect. The generic live journey does not replay Formula Lab's six component tags, so a manual Lumina Tutor Tester pass over those moments is still required.
