# di-spoken-practice levers: DI family 9 (2026-10-03)

`/add-support-tiers`, plan `qa/support-levers/di-lever-plan-2026-10-03.md` step 7. Table and failure inventory: `qa/support-levers/di-spoken-practice-lever-table-2026-10-03.md`. No real-learner evidence: synthetic (spoken-miss ids, explain bench probes) or documented.

## What was built

| Mode | Help | Simplify |
|---|---|---|
| count_and_say | `model_count`, `touch_marks` (tappable pictures), `five_rows` (above five) | `smaller_group` |
| compare_choice | `word_model` (one model pair per menu word, R1) | `far_pair` (the other word) |
| read_aloud | `model_read`, `sound_dots`, `word_underline` (2+ words) | `short_word` |
| say_answer | `model_answer` (a generated spare) | `easier_item` (the spare marked easier) |
| explain_concept | `model_explain` (a spare with a different concept) | `easier_item` |

- **Generator (R3):** say_answer asks count + 2 and explain count + 3; the model marks one item `easier` in a new schema field; the surplus and the easier item ship as `spares`, leak-checked against the session. A tier stamp sets where levers start.
- **Code tables:** six comparison dimensions with eight things each (the first version had four, and a session using two of them left no model).
- **New miss ids:** read_aloud (misread, sounds_not_blended, letter_names, word_dropped), say_answer (signature_error, said_stimulus), explain_concept (read_back, named_only, bare_number, opposite_idea). Advisory patterns; the explain judging key is unchanged.
- **Payloads:** read_aloud, say_answer and explain_concept saved (one Flash generation each; the latter two carry spares).
- **Catalog:** `levers: true`; guidance rewritten under the 2000-character cap.

**Size:** 250 lines of lever module and about 200 of component, workspace, generator and catalog change, against 280 lines of new tests.

## Measured

| Gate | Result |
|---|---|
| Unit (`diSpokenPracticeLevers.test.ts`, 23) | count model rules for 1-10; smaller group; rows; compare model has every menu word and no session thing; far pairs pass the menu gate for every dimension and both answers; read model shares no letter or digit; short word refusals; saved spares never leak; leaking spares refused; no spares → no lever; starting positions; miss → lever; every catalog miss answered, every named miss listed |
| Mounted (`DiSpokenPractice.levers.workspace.test.tsx`, 4) | rings and rows, no numeral; compare model pairs in menu order; dots under the print and no other text; easier spare ungraded, then the full question credited |
| Dry journey J1-J9 | 5/5 payloads |
| typecheck / suites | lumina 0; live-activity + DI + DI generators 2979 pass |
| Text replay (Flash, 5 payloads × 5) | 0 flags. Compare: "the bus is longer, and the ant is shorter" before the child's pair; say: "My turn: the opposite of day is night", then the child's word |

## Not covered

- A session built from the planner's targets (named sets, subject-verb) has no spares, so say_answer there gets no model or easier item. A named-concept explain session gets neither by design (the concept is the answer).
- No in-item help on say_answer or explain_concept, by design.
- Not browser-checked (HUMAN-CHECKS #183, spoken-practice row). No Live run: the DI class gate.

## Next

DI family 10, di-word-problem-setup (plan step 8).
