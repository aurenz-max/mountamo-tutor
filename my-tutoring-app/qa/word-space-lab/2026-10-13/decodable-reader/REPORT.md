# decodable-reader: a grade x tier difficulty ladder (2026-10-14)

Not a word space. The passage is prose, and the user ruled (10-14) that words inside model-written text stay
the model's. Instead, `config.difficulty` now sets the structure of the story, Gemini writes inside it, and
code counts every sentence: `primitives/visual-primitives/literacy/decodableReaderLadder.ts`, one table that
both the generator (prompt and retry gate) and the script (which lines are askable) read. Raw output:
`after.txt` (`run-probe.sh`, mode literal, one run per tier). Before this, the tier changed nothing.

## The ladder (words per sentence, sentences per story)

| Grade | Easy | Medium | Hard |
|---|---|---|---|
| K | 3-5, 2-3 | 4-6, 3-4 | 5-8, 4-5 |
| 1 | 3-6, 3-4 | 5-8, 4-6 | 6-10, 5-7 |
| 2 | 4-8, 4-6 | 6-10, 5-7 | 8-12, 6-8 |
| 3 | 5-10, 5-7 | 7-12, 6-8 | 9-15, 7-9 |
| 4-5 | 6-12, 6-8 | 8-14, 7-9 | 10-18, 8-10 |

Each rung also names the decoding load (K: CVC and sight words only, checked by the K decode gate; G1: blends,
digraphs, silent e, then vowel teams and -ed/-ing; G2: r-controlled, diphthongs, then two-syllable words and
prefixes; G3-5: multisyllabic, affixed, root-based and academic words) and the sentence structure (simple,
then joined, then clauses and dialogue). Without a tier, and in read-along, the benched 3-8 window and the old
grade guide apply unchanged.

The ladder now runs to grade 5. Above grade 2 the story is grade-level connected text, not phonics-controlled.
The catalog's workspace grades (the Live grade gate) and constraints now say K-5.

## After (probe)

| Grade | Easy | Medium | Hard | No tier |
|---|---|---|---|---|
| K | [4,4,5] "I see a cat." | [5,6,5] | [7,7,6,5] "I see a fat cat at home." | [5,7] |
| 1 | [5,5,4] "A frog sat in mud." | [5,6,7,6] | [8,8,8,7,8] "Tom said, "Look at that fish swim!"" | [7,6,6,6] |
| 2 | [6,6,5,6] | [7,7,6,7,6] | [9,8,9,9,9,9] "When the warm spring rain stopped, we went outside." | [6 x6] |
| 3 | [7,7,6,7,7,6] | [8,7,7,8,8,7,8] | [9,10,10,9,10,10] | [7,7,6,7,6,5] |
| 5 | [7,7,7,8,6,6,6] | [10,9,9,10,9,10,9] | [10,12,14,12,13,11,10,12] "Upon returning to the hive, forager bees transfer the nectar to younger worker bees." | [5,5,5,5,5,5,4] |

Every sentence of every run landed in its window, with no retries. Gemini writes near the bottom of the wide
windows (grade 3 hard: 9-10 of 9-15).

Flaws in the writing, not in the ladder: grade 2 hard printed dialogue without quotation marks; grade 5 easy
used "enzymes"; grade 1 hard "Then the frog did hop".

## Owed

- **Live sitting (user).** Windows above 8 words (grade 1 hard and up) are unbenched for `sentence_read_aloud`.
  `run_live_runtime.py` now takes `--difficulty`:
  `venv/Scripts/python tests/tutor_live/run_live_runtime.py --primitive decodable-reader --mode literal --grade 2 --difficulty hard --audio --runs 1`
  (then grade 5 hard for the 18-word top). The question is whether the tutor still catches one dropped, added
  or swapped word in a 10-18 word line.
- Browser check per tier in the tester (now in `DIFFICULTY_PRIMITIVES`).
- No contract exists for decodable-reader: `/primitive-contract decodable-reader`.
