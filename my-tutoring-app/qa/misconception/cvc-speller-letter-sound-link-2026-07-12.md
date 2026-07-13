# Misconception Test: cvc-speller + letter-sound-link — 2026-07-12

First run of `/misconception-test` (skill created this session — Phase 4 verify
half pulled forward as a thin wrapper over the existing probes).

**Gate: PASS** — 0 LEAK, 0 OVERREACH, 0 LEAKY, 0 DRIFTED; Probe R CLOSED with
scope matrix green. One AFFORDANCE-BOUNDED finding logged (below), not a gate fail.

## Phase 0 — Wiring inventory

Both primitives fully wired (catalog `misconceptionScope: 'primitive'`,
component `diagnosisObservationsRef` + 6th-arg evidence, generator
`buildRemediationPrompt` + code-stamped `remediationMove` enum, 3 golden
scenarios each, round-trip pytest coverage).

## Tier 0 — Pure contracts

`npm test`: **603/603 passed** (41 files) — includes the new
`gemini-cvc-speller.test.ts` / `gemini-letter-sound-link.test.ts` move-mapping
and topic-scope tests.

## Probe D — distiller honesty (real gemini-flash-latest, 6 scenarios)

| Scenario | Expected | Verdict | Evidence |
|---|---|---|---|
| cvc-speller-vowel-substitution | generative | **GENERATIVE** (high, structured) | "represents the short-i vowel sound with the letter 'e'" — predicts the e-choice, names no target word |
| cvc-speller-spoken-final-omission | generative | **GENERATIVE** (medium, judge) | "pronouncing only the onset and the vowel, omitting the final consonant" |
| cvc-speller-single-vowel-slip | abstain | **ABSTAINED** | "single error followed by a self-correction… insufficient" |
| letter-sound-voicing-confusion | generative | **GENERATIVE** (high, structured) | "confuses the letter T and its sound with the letter D and its sound" |
| letter-sound-spoken-onset-omission | generative | **GENERATIVE** (high, judge) | "omitting the initial consonant sound and pronouncing only the rime" |
| letter-sound-single-mistap | abstain | **ABSTAINED** | "single attempt with no corroborating pattern" |

0 LEAK, 0 OVERREACH, 0 VAGUE. Evidence tiers stamped correctly by code
(judge-backed packets → `judge`).

## Probe G — generation fidelity (eval-test route, Probe D outputs as focus)

remediationFocus (cvc): *"The student represents the short-i vowel sound with
the letter 'e'."* — the actual Probe D output, so the D→G handoff is real.
remediationFocus (lsl): *"The student confuses the letter T and its sound with
the letter D and its sound."*

| Run | Verdict | Evidence |
|---|---|---|
| cvc-speller spell_word NULL | **clean** | no `remediationMove` on any challenge; short-i topic honored |
| cvc-speller spell_word +focus | **TARGETED** | `phoneme_slots` ×4; distractor spellings set/tep/pet/sep = exact i→e swaps; `e` present in letter bank; count/mode/grade unchanged |
| cvc-speller fill_vowel +focus | **TARGETED** | `contrast_vowel` ×5; every vowelOptions pair is exactly [e, i] — wrong option IS the diagnosed confusion |
| letter-sound see_hear NULL | **clean** | no moves; varied distractors |
| letter-sound see_hear +focus | **TARGETED** | `contrast_sound` ×6; T-challenges use /d/ as the wrong sound; other letters use /t/ as distractor (both directions of the contrast) |
| letter-sound hear_see +focus (2 draws) | **AFFORDANCE-BOUNDED** | `contrast_letter` stamped, emphasis shifted to T, but NO draw ever offers `d` as a distractor — `d` is a group-2 letter and the cumulative-group rule (`s,a,t,i,p,n`) wins the prompt conflict, deterministically |

Leak scan: no student-visible string in any run quotes the misconception, the
correct rule pre-attempt, or an answer. commonErrors feedback is post-attempt
corrective (same shape as null run).

### Finding: hear_see is affordance-bounded for cross-group confusions

The voicing contrast t↔d is only representable where the confusable target is
in scope: see_hear affords it (sound options aren't group-restricted — /d/
plays fine), hear_see does not (the letter `d` may not be shown before its
group is taught — scope correctly beats remediation). Today
`letterSoundRemediationMoveFor` stamps `contrast_letter` regardless, which
overpromises: the tag says the content targets the confusion when this mode
structurally can't. Per the PRD's structural-gating principle (no affordance →
no remediationFocus → no tag), the move stamp could gate on the confusable
letter being inside the cumulative group. **Not fixed here — follow-up
decision.** Impact is soft: the content still stresses T and the see_hear
sibling carries the true contrast.

## Probe R — round trip

- `pytest tests/test_misconception_round_trip.py`: **6/6 passed** — CLOSED
  journey (fanout→resolve on strong matched submit only), mismatched-tag and
  skill-scope negatives green, cvc-speller and letter-sound-link
  primitive-scoped resolution tests green. (pytest installed into
  `backend/venv` this session — it was missing.)
- `probe_misconception_phase2.py --primitive cvc-speller` and
  `--primitive letter-sound-link` vs **real Firestore**: both `pass`,
  `misconceptionKey` = the primitive id, `scope: primitive` — S4 exposure
  correct for both key shapes.

## Not verified here (browser-owned)

S1 live capture: a real wrong session in the browser driving
`diagnosisObservationsRef` → `submitEvaluation(..., diagnosisEvidence)` →
Firestore doc. The evidence-shape and gate logic are covered headlessly; the
in-component wiring has not been clicked.
