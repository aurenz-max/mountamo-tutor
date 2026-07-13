# Misconception Loop: Phoneme Explorer — 2026-07-12

**Gate: PASS.**

Phoneme Explorer now participates in the declared-scope loop as a
primitive-scoped phonological-awareness manipulative.

## Wiring

- Catalog declares `misconceptionScope: 'primitive'`.
- Component records bounded wrong-answer observations and submits structured
  expected-versus-observed evidence when the final score is below 60.
- All four modes have private remediation moves:
  `contrast_phoneme`, `blend_through`, `segment_boundary`, and
  `isolate_operation`.
- Generator consumes the shared remediation prompt and code-stamps the move;
  baseline generation removes the private trace.
- Diagnosis Lab gained final-sound omission and onset-only blending signatures,
  plus a single-slip must-abstain case.

## Letter Sound Link follow-up

The earlier `hear-see` AFFORDANCE-BOUNDED finding is closed in code. A diagnosed
contrast is stamped only when both explicitly named letters are present in the
cumulative letter group; otherwise generation remains untagged and cannot
resolve the misconception.

## Verification

- Full Vitest suite: 711/711 passed across 43 files.
- Backend Probe R: 7/7 passed. The Phoneme Explorer case proves a strong
  sibling-primitive result cannot resolve its entry, while a strong tagged
  Phoneme Explorer result does.
- Real Firestore exposure: PASS; primitive-scoped key was `phoneme-explorer`.
- Repository-wide TypeScript remains red on the pre-existing baseline; filtering
  its output found no errors in the touched Phoneme Explorer, Letter Sound Link,
  or literacy catalog files.

## Probe verdicts

| Probe | Case | Verdict | Evidence |
|---|---|---|---|
| D | final-sound omission | **GENERATIVE** | High-confidence diagnosis predicts omission of the final consonant; no target word leaked. |
| D | onset-only blending | **GENERATIVE** | High-confidence diagnosis predicts selection by first phoneme while ignoring the remainder. |
| D | single sound-match slip, 3 draws | **ABSTAINED** | All three draws treated the corrected one-off miss as insufficient evidence. |
| G | segment null | **clean** | Five items, no remediation moves. |
| G | segment focused, 2 draws | **TARGETED** | `segment_boundary` on every item; every item included a final-phoneme-omission distractor. |
| G | blend null | **clean** | Five items, no remediation moves. |
| G | blend focused, 2 draws | **TARGETED** | `blend_through` on every item; distractors consistently shared only the onset with the answer. |
| G | leakage and drift | **clean** | No diagnosis/correct-rule text in `fullData`; mode, grade, and five-item shape held. |
| R | journey + sibling-primitive negative | **CLOSED** | Backend pytest 7/7. |
| R | real Firestore exposure | **CLOSED** | Store-to-context returned the correct primitive-scoped key. |

**Distiller handoff:** Probe G used Probe D's actual outputs, including: “The
student believes that segmenting a three-phoneme word only requires identifying
the first two phonemes, omitting the final consonant sound.”

**Not verified here:** S1 live capture in a browser (component evidence → POST →
Firestore on a real wrong session). The `misconception-test` skill explicitly
classifies this station as browser-owned and does not include it in the automated
PASS gate.
