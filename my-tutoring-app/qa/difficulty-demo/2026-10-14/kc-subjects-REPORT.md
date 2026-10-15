# knowledge-check: requested difficulty across subjects (2026-10-14)

Probe: `scripts/difficulty-lab/kc-subject-tier-probe.mjs` through the registry generator (lesson path), 13 objectives
(math K/1/2/4/5, science K/2/4/5, literacy K/1/3/5) x easy/medium/hard, 4 problems each.
Runs: `kc-subjects-before/` (old code), `kc-subjects-after/` (tier wired), `kc-subjects-after2/` (K/1/4 after the
same-skill and near-option rules). Each folder: one JSON per cell, `summary.txt`, `logs.txt`.

## What was wrong
`config.difficulty` was read only by the math item space. Everything else ignored it: the orchestrator picked its own
easy-to-hard mix and the per-type writers never got the tier. Before: G2 science "hard" shipped 4/4 problems labelled
easy; K science medium = easy.

## What changed
- `service/knowledge-check/knowledgeCheckTier.ts`: per-subject task ladder (math, science, reading/language, social
  studies); shape ramp held to grade bounds (blanks 1/2/3, matching 3/4/5, categories+items, steps 3/4/5, near vs far
  wrong options; Grade 1 keeps its fixed shapes); code stamps the tier and logs shape misses.
- Orchestrator plans every problem at the requested tier; Pulse's text problems now pass the tier.
- Duplicate MC option ids re-lettered; the key follows the `distance: key` tag.

## Result (written problems; item-space math was already tiered)

| | Easy | Medium | Hard | Distinct? |
|---|---|---|---|---|
| Math K count | count 4 apples | count 7 ding sounds, last-number-said | count 9, conservation (spread vs packed), one more | yes, mild |
| Math G2 time | hands on 3 and 3 → 3:15 | hour hand between 3 and 4 → 3:25 | compare two clocks and say why; 5-pair matching; 3 blanks | yes |
| Science K needs | puppy needs water | puppy and flower both need water | plant with sun but no water; puppy in a closed box needs air | partly: wrong options still random objects |
| Science G2 solid/liquid | definition → pick the solid | pour milk into a bowl (shape changes) | honey flows slowly; dry sand pours but is solid | yes |
| Science G4 energy | light lets us see | lamp gives light AND heat | refute a claim with a table; sound cannot cross space | yes |
| Science G5 plants | soil stays same weight | predict growth with a pinch of soil | judge two students' claims about light vs matter | yes |
| Literacy K first sound | same sound as ball → bear | sun vs ship (digraph confusion) | van vs fish; odd one out | partly |
| Literacy G1 silent e | which has a long vowel | cap → cape (TF) | cap / cape / cup minimal set; the exception "have" | yes |
| Literacy G3 main idea | main idea of a short passage | the off-topic detail as a TF trap | pick among two true details; 5-pair matching | yes |
| Literacy G5 context clues | definition clue in the sentence | contrast clue | inference about a character's feeling | yes |

Shape: 0 misses over 180 written problems (two runs).

## 2026-10-15 follow-up (runs in `../2026-10-15/`)
- 8.1l DONE: K questions are checked against what is on screen (`preReaderEvidence.ts`); counting uses a code-drawn
  `arrangement`, drawn to the key. 4 K runs: 0 phantom pictures, 0 dropped problems in the last two. The same gate
  redraws "starts with" questions with two right answers (map/mug, star/sun, bat/ball) and questions that state the answer.
- 8.1m DONE: an unlike-denominators objective gets unlike items only (24/24 over two runs), each labeled with the requested tier.
- K tiers: a K wrong-picture ladder (different kind / same kind / the classic mistake). Science medium now offers juice
  or milk for water, hard offers sunshine for a cactus's drink. A toy still shows up as a "near" option in about 1 in 8 K items.

## Open (queued in WORKSTREAMS)
- K: a toy still shows up as a "near" option in about 1 in 8 K items (prompt-level; no code check).
