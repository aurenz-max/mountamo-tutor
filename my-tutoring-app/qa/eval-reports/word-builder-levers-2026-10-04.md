# word-builder levers: literacy G2-6 family 1 (2026-10-04)

`/add-support-tiers`, plan `qa/support-levers/literacy-lever-plan-2026-10-03.md` step 1. Table and failure inventory: `qa/support-levers/word-builder-lever-table-2026-10-03.md` (rulings R1-R9 taken as recommended). No real-learner evidence: the misses are the spoken-miss ids, the 08-16 Live DI runs and `commonStruggles`.

## What was built

| Lever | Kind | Modes | Answers |
|---|---|---|---|
| `part_slots`: empty boxes labelled prefix / root / suffix, joined into one word box | help | all four | all seven misses |
| `model_word`: a solved card for a different word of the same shape and tier | help | all four | all seven misses |
| `small_board_word`: an ungraded practice word on a board of its own parts plus one foil per type; a 3-part greek_latin item practises a 2-part word | simplify | all four | root_only, other_part_only, part_missing, swapped_part, meaning_word |

- **Misses:** four new (`other_part_only`, `parts_not_joined`, `swapped_part` from the board, `meaning_word`); `part_missing` dropped from simple_affix, where a 2-part word cannot show it. Every catalog miss is answered.
- **Pools (R2):** 78 hand-written words in three tiers (everyday, academic, Greek/Latin), each through the same build gates as a generated word. The first multi_morpheme run found no practice word: every session item used `in`/`ion`/`able`, so eight academic words with other affixes were added.
- **Guidance (R3):** the "take the meaning apart part by part" move is gone; the tutor pulls a lever and never names the parts or their meanings. 1890 of 2000 characters delivered.
- **Tier (Phase 6):** the generator stamps `supportTier`; easy starts with `part_slots` drawn (not offered, not recorded).
- **Generator:** keeps only the targets the runner asks. The live adapter refuses a lesson carrying a target the runner would drop, so the step-0 clue gate had made the saved simple_affix payload unbindable until this change; it was regenerated.

**Size:** about 230 production lines (lever module 210 including the 78-word pool, component 80, misses 40), against 190 test lines.

## Measured

| Gate | Result |
|---|---|
| Unit (`wordBuilderLevers.test.ts`, 117) | every pool word passes the build gates; on every saved payload (6) every item has a leak-free model and practice word of the right shape; the scene fact names no part of the item; every miss → a help lever first, then the practice word |
| Mounted (`WordBuilder.levers.workspace.test.tsx`, 3) | frame and model change the screen and the scene in one commit and show no part of the word; the practice word is ungraded on a 6-card board, then the full 7-card board returns and only the full word is credited; easy draws the frame and does not offer it |
| R8 class check (`g26LeverStarts.test.ts`) | word-builder row |
| Dry journey J1-J11 | 6/6 payloads |
| typecheck / suites | lumina 0; full tsc 771 (baseline); live-activity + literacy suites 4454 pass |
| Text replay (Flash, 6 payloads × 5) | 0 flags on 19 checks. First run: one reply walked the item's part meanings ("one part means again, one means perform"); the guidance now forbids naming the parts' meanings, and 150 re-recorded samples show none |

## Not covered

- **Replay limitation:** when the tutor pulls `model_word` itself in the stuck moment and the sweep pulled `part_slots`, the replay answers with the pre-pull packet, so the tutor has no model word and sometimes makes one up (1 of about 20 such samples after the `does` fence). Live answers with the real receipt; the class Live gate will show it.
- Not browser-checked (HUMAN-CHECKS #184). No Live run: the class gate (plan step 5) runs when all four families are built.
