# Birth certificate — you-and-me (2026-09-07)

**Current layer: support tiers implemented; structural assessment complete (support-only).** [Support verification](you-and-me-l3-2026-09-07.md): both modes at all tiers, mixed/blended generations, and tier-aware tutoring probes pass. [Structural assessment](you-and-me-structural-assessment-2026-09-07.md) found no clean within-mode lever under the current contract. [L2 tutoring](../tutor-reports/you-and-me-2026-09-07.md) and [L1 modes](you-and-me-l1-2026-09-07.md) remain recorded. Next: outstanding browser/microphone acceptance. The original L0 record below is retained as history.

**L0 implementation:** spoken Kindergarten perspective-taking, `describe_action`, six turns across three paired scenes. Runtime generation and component-contract QA pass; real browser/microphone acceptance remains owed. No L1 ladder or L2 catalog tutoring scaffold is claimed.

- Generator: fork B, three independent Gemini scene calls, bounded retry/deduplication, explicit fallback disclosure. Code assigns actor/speaker and balances three I / three you responses, including both pair orders.
- Spoken wiring: existing `useJudgedScriptRunner` owns silent scripted messages, mic lifecycle, capped corrections and outcomes. Tags: `[YOU_AND_ME_ITEM]`, `[YOU_AND_ME_HEAR]`, `[YOU_AND_ME_MOVE_ON]`, `[YOU_AND_ME_COMPLETE]`. Correct/incorrect moments use the shared runner's spoken verdict protocol.
- Metrics: canonical session aggregates and per-turn actor/speaker provenance, observed correction utterances, `onEvaluationSubmit` delivery.
- Curriculum: live MATCH, **LA004-04-B**, cosine 0.8127, Basic Pronouns family 3/5. Rehearsal is not proof of real-world conversational transfer.
- Answer-leak audit: no answer choices, pronoun placeholders, pre-attempt model sentences, fixed pronoun colors or fixed pair answer order. Scene replay names the actor; feedback may model a response after an error.
- Design gate: manipulation **exception**, speech is the learning action; simulation **pass**, roles visibly switch while the action stays fixed; production **pass**, original sentences accepted by referent/meaning; timer **pass**, none visible; layout **pass**, role cues supply the stimulus without a model answer.
- Hook exception: the shared spoken runner and `phaseResultsFromSummary` replace the click-oriented `useChallengeProgress`/`usePhaseResults` hooks. A second attempt ledger would introduce competing progression and scoring.
- Verification: 27 focused tests pass (generator, spoken contract, component state/submission). Four real API draws produced 24 turns; the final draw confirms both pair orders. Final `npm.cmd run typecheck:lumina` passes with zero Lumina errors. Full project baseline contains 770 legacy errors; no You & Me diagnostics. An intervening concurrent letter-workshop diagnostic was gone by the final gate.

## Follow-up queue

| Order | Skill / check | Concrete input |
|---|---|---|
| 0 | Browser + microphone acceptance | Open Language Arts tester → You & Me. Complete six turns; deliberately say a fluent wrong-perspective sentence, a bare pronoun, an echoed named scene and a valid paraphrase. Confirm correction, both pair orders, final metrics and regeneration. This pronoun-specific spoken contract is not yet live-audio validated. |
| 1 | `/add-eval-modes` | Retain describe_action; consider reflexive myself/yourself actor-binding (LA004-04-J) as a distinct task, not token-presence grading. |
| 2 | `/add-tutoring-scaffold` | Context: speaker, listener, actor, scene, challengeType. Struggles: fixed-person I/you labels, failing to change perspective, named-scene echo. Preserve scripted opener and hidden models. |
| 3 | `/add-support-tiers` | Withdraw extra actor highlighting and role reminders; retain audible scene access and unambiguous speaking role. |
| 4 | `/add-structural-difficulty` | After tiers: delayed role switches and longer gaps between paired scenes. Keep actor/speaker binding visible and age-appropriate. |
| 5 | `/add-sound` | Audit inherited runner sounds; optional speaker-token move and scene-change feedback without overlapping speech. |
| 6 | `/add-spoken-judge` | Evaluate the existing open-mic semantic judge, especially false affirmation of swapped pronouns, before adding any alternate judge. Preserve original sentence production and shared runner ownership. |
| Every layer | `/eval-test you-and-me` | Repeat generated payload checks and affected voice acceptance flow. |

## Files

New: `YouAndMe.tsx`, `youAndMeScript.ts`, their two tests, `gemini-you-and-me.ts` and its test, required-fields contract, eval JSON/report, curriculum-fit report and this record.

Registered in: `types.ts`, `config/primitiveRegistry.tsx`, `evaluation/types.ts`, `evaluation/index.ts`, `service/manifest/catalog/literacy.ts`, `service/registry/generators/literacyGenerators.ts`, `components/LanguageArtsPrimitivesTester.tsx`.
