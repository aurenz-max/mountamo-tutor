# Eval Report: foundation-explorer — 2026-07-04

Verb-driven primitive (no challengeTypes). Swept the four Bloom verbs that drive
the self-check style. Newly wired: per-concept graded multiple-choice self-check
+ PhaseSummaryPanel + evaluation submission.

## Results

| Eval Mode (verb) | Status | Issues |
|------------------|--------|--------|
| identify | FAIL | 1 (HIGH) |
| explain  | PASS | — |
| apply    | PASS | — |
| compare  | PASS | — |

All modes generate cleanly (status `pass`, ~9–13s): 3 concepts each, exactly 3
options, `correctIndex` in range and varied across concepts, correct answers
factually accurate, distractors plausible (the sibling landforms / real
misconceptions — no joke options). No crashes, no missing fields, no impossible
items. The `correctIndex` position is additionally re-shuffled client-side, so
answer position never leaks.

## Issues

### identify — correct option paraphrases the visible definition (answer leak)

- **Severity:** HIGH
- **What's broken:** For the IDENTIFY verb, the self-check's correct option is a
  near-verbatim restatement of the `briefDefinition` rendered directly above it in
  the same panel. A student passes by string-matching the definition they're
  reading — never engaging the diagram, which is the whole point of an IDENTIFY
  check. EXPLAIN/APPLY require reasoning not present in the panel (clean); COMPARE
  needs the *other* concept's definition, which is not co-visible (clean).
- **Data:**
  - `Mountain` def=`"A very tall piece of land that rises high above the ground around it."` → answer=`"The tall land with a high peak"`
  - `Island` def=`"A piece of land that has water all the way around it."` → answer=`"The land with water on all sides"`
- **Fix in:** COMPONENT (preferred) — gate the definition/`briefDefinition`
  visibility while an IDENTIFY self-check is unanswered, so the check forces a look
  at the diagram; reveal the definition on completion. Alternative GENERATOR fix:
  for IDENTIFY, constrain the correct option to a *diagram-visual* referent
  distinct from the definition sentence. Structural root cause: study content and
  a pure-recall check are co-visible on one panel — fine for reasoning verbs,
  trivializing for recognition verbs.

## Notes

- This is strictly better than the prior version (self-attestation "I understand"
  with no graded check). The leak is specific to the IDENTIFY verb.
- Not visually confirmed in-app yet — see Step 3 (open FoundationExplorer in the
  tester / a live lesson, answer a check, confirm the MCQ FSM + PhaseSummaryPanel
  render).
