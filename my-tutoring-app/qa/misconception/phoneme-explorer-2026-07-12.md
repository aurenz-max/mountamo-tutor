# Misconception Loop: Phoneme Explorer — 2026-07-12

**Implementation gate: PASS. Runtime probe gate: OPEN.**

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

- Focused remediation tests: 11/11 passed.
- Full Vitest suite: 670/670 passed across 43 files.
- Repository-wide TypeScript remains red on the pre-existing baseline; filtering
  its output found no errors in the touched Phoneme Explorer, Letter Sound Link,
  or literacy catalog files.

Still required for a full `/misconception-test` closure: real-Gemini Probe D/G
and one browser-owned wrong-session capture through Firestore.
