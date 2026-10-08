# Knowledge-check Jev review — calibration, 2026-10-06

`service/knowledge-check/reviewKnowledgeCheck.ts` asks Jev four things about each generated problem; code decides.
This folder holds the labelled run its thresholds were set on.

**Data:** 64 real `gemini-flash-latest` problems from 16 orchestrated sets (no objectives): six of one topic
(green excavators and pink dump trucks, K-2) and ten across subjects K-5 (adding within 10, community helpers,
plants, nouns and verbs, telling time, states of matter, equivalent fractions, main idea, food chains, water cycle).
Labels are one reviewer's pass/fail by hand. Raw signals per problem: `calibration-2026-10-06.json`.
Rerun: `node scripts/kc-review-calibrate.mjs` with `IN=<saved sets json>` and `OUTFILE=<path>`.

**Result:** 19 problems labelled fail; the review fails 17 of them and no labelled pass (62/64 agree).

| Judgment | Primitive | Cut | Caught |
|---|---|---|---|
| gives the answer away | Noul | >= 0.75 | "Which toy is the green excavator?" (0.98), definition-box blanks (0.82-0.96), sort groups that name their items (0.82-0.87) |
| evidence agrees | Choice | contradicts / gives_answer at >= 0.5 | choices missing from the picture, a number line without the fraction asked, an emoji row with a "fourth vehicle" |
| repeats an earlier problem | Choice over earlier problems | >= 0.8 | three "which one digs?" items in one K set |
| a wrong answer is tempting | Noul per wrong answer | fail when the most tempting < 0.25 | kite / sailboat / letter / hat distractors |

**Misses (both borderline):** a comparison picture missing two choices scored `agrees` 0.55; an MCQ restating an
earlier sort scored `same_as` 0.60.

**Wording fixes the labels forced:** a repeat is a reworded copy (same answer, same reason), not the same skill on new
content — a check wants two items per objective; a passage or table the learner reasons from is evidence, not a copied
answer; "every wrong answer is absurd" is the failure, not "no wrong answer is above 0.5" (that failed fair K items).

## End to end, review on (6 sets, 24 problems)

`generateKnowledgeCheck` with the review: 9 of 24 problems failed the first review and were redrawn; 7 of 24 still fail
the final review (29%, against 15 of 36 = 42% in comparable unreviewed sets; the truck topic 12/24 -> 2/12).
**All three definition-box problems still fail after the redraw** (“based on the definition box …” with the key in the
box or paraphrased in a choice): the planned inset is the cause, and a reworded question cannot fix it. That is the case
for inset-first planning. Cost: 31 generator calls for 24 problems (+29%), 48 Jev calls, ~0.5 s added per set.
