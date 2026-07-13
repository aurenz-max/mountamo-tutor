# Misconception Test: Picture Vocabulary — 2026-07-12

**Gate: PASS.**

Picture Vocabulary is a content-generic delivery vehicle, so its declared
identity is skill-scoped: `picture-vocabulary::<canonicalSkillId>`.

## Wiring inventory

- Catalog declares `misconceptionScope: 'skill'`.
- Spoken no-match verdicts provide Tier-A `heard` + judge reasoning or the
  judge's optional misconception; tap misses provide Tier-B expected/observed
  evidence. Failed completion passes the packet as submit argument six.
- Generator feeds remediation into its category-specific pool prompts, then
  code-stamps one of five private moves: `semantic_contrast`,
  `relation_contrast`, `reverse_relation`, `context_contrast`, or
  `adjacent_scale`.
- Challenge objects are assembled in code rather than emitted in the Gemini
  schema. Accordingly, their bounded remediation move is also code-owned; this
  is the orchestrator-safe equivalent of a response-schema enum.
- Golden set includes two repeatable signatures and one judge-backed
  must-abstain case.
- Permanent backend coverage proves primitive + skill matching.

## Probe verdicts

| Probe | Case | Verdict | Evidence |
|---|---|---|---|
| D | animal-label overgeneralization | **GENERATIVE** | Tier A, high confidence; predicts `dog` for other four-legged animals without naming the current target. |
| D | repeats prompt object in association | **GENERATIVE** | High confidence; predicts repetition instead of the functional partner. |
| D | single corrected naming slip, 3 draws | **ABSTAINED** | All three draws rejected the self-corrected one-off mismatch. |
| G | naming null | **clean** | Five naming items, no remediation traces. |
| G | naming focused, 2 draws | **TARGETED** | `semantic_contrast` ×5; at least one non-dog animal offers `dog` as the misconception-consistent distractor in each draw. |
| G | association null | **clean** | Five association items, no remediation traces. |
| G | association initial focused draw | **DEAD-FIELD → FIXED** | Prompt-only targeting lost the same-category distractor during randomized option assembly. |
| G | association focused after fix, 2 draws | **TARGETED** | `relation_contrast` ×5; every item includes its pictured base object as the diagnosed repetition distractor. |
| G | leakage + drift | **clean** | No diagnosis text in `fullData`; grade, mode, and five-item structure held. |
| R | skill-scoped journey + sibling negative | **CLOSED** | Backend pytest 8/8; sibling primitive cannot resolve the entry. |
| R | real Firestore exposure | **CLOSED** | Composite key `picture-vocabulary::MISCONCEPTION_PHASE2_SKILL` returned through generation context. |

Tier 0: **742/742** Vitest assertions passed across 44 files. Touched-file
TypeScript filter is clean; repository-wide TypeScript remains red on its
pre-existing baseline.

**Distiller handoff:** Probe G used the actual Probe D outputs, including “The
student uses the label ‘dog’ to refer to any four-legged animal” and “The
student believes that naming something that ‘goes with’ an object means
repeating the name of the given object.”

**Not verified here:** S1 live browser capture from a real spoken/tap failure
through the authenticated POST into Firestore. The skill explicitly keeps this
browser-owned station outside its automated PASS gate.
