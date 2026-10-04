# sentence-analyzer levers: literacy G2-6 family 2 (2026-10-04)

`/add-support-tiers`, plan `qa/support-levers/literacy-lever-plan-2026-10-03.md` step 2. Table and failure inventory: `qa/support-levers/sentence-analyzer-lever-table-2026-10-03.md` (rulings R1-R9 taken as recommended; R7: no wall narrowing). No real-learner evidence: the misses are the spoken-miss ids, the 08-17 Live DI drives and `commonStruggles`.

## What was built

| Action (modes) | Help | Simplify |
|---|---|---|
| name-pos (identify_pos, label_all) | `model_sentence` (a different sentence, every word labelled; both members of each pair on the wall), `wall_examples` | `short_sentence` |
| name-role (identify_role) | `two_row_model` (part of speech over job; every role on the wall), `wall_examples` | `short_sentence` |
| name-side (parse_structure) | `split_model` (the subject bracketed on another sentence) | `short_subject` (refused at a subject of two words or fewer) |
| name-type (parse_structure) | `wall_examples` (one sentence per kind) | `plain_kind` |

- **Pool (R2):** `sentenceModels.ts`, 16 model sentences, 31 practice sentences and 3-4 examples per label, all keyed by hand.
- **Answer-blind (R1):** every pick depends on the wall, the session's words and the item id; a unit test pins that two items differing only in the answer get the same model and practice.
- **Misses:** `describing_word` (adjective and adverb asks) and `named_the_side` (role asks that are not subject or predicate). Every catalog miss is answered.
- **Guidance:** "No word of the sentence is labelled until credit" plus one sentence fencing the models; about 1975 of 2000 delivered (the live-activity cap test passes).
- **Tier:** easy starts with the wall examples drawn (D5 closed: the tier now changes what the learner sees on the workspace path).

**Size:** about 300 production lines (pool 110, lever module 200, component 90, misses 10), against 230 test lines.

## Measured

| Gate | Result |
|---|---|
| Unit (`sentenceAnalyzerLevers.test.ts`, 74) | pool keys; on every saved payload (9) every item has its model, examples and practice, leak-free; pairs and roles covered; answer-blind picks; every miss → a help lever first |
| Mounted (`SentenceAnalyzer.levers.workspace.test.tsx`, 4) | model card and examples change the screen and the scene, no label on the item sentence; the practice sentence is ungraded and the full item returns, credited alone; two-row and split models; easy starts with the examples, not offered |
| R8 class check | sentence-analyzer row |
| Dry journey J1-J11 | 9/9 payloads |
| typecheck / suites | lumina 0; full tsc 771 (baseline); live-activity + literacy suites 4525 pass |
| Text replay (Flash, 9 payloads × 5) | 0 flags. First run: 2/45 lever replies read the grade-2 model card's labels aloud, which says the answer label among the four; the `does` text now has the tutor walk the card by what each word does and leave the labels to the reader |

## Not covered

- At grade 2 the learner reads the model card's labels; a struggling grade-2 reader may need them voiced, which this build does not do (it would say the answer label before the try). Browser check: HUMAN-CHECKS #184.
- No Live run: the class gate (plan step 5) runs when all four families are built.
