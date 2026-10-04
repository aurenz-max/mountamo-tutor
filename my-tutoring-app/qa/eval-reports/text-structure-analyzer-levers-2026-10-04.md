# text-structure-analyzer levers: literacy G2-6 family 4 (2026-10-04)

`/add-support-tiers`, plan `qa/support-levers/literacy-lever-plan-2026-10-03.md` step 4. Table and failure inventory: `qa/support-levers/text-structure-analyzer-lever-table-2026-10-03.md` (rulings R1-R9 taken as recommended; R5 allows a practice passage of another structure, R6 keeps label words out of passages). No real-learner evidence: the misses are the spoken-miss ids, the 08-17 Live DI journeys and `commonStruggles`.

## What was built

| Action (every mode) | Help | Simplify |
|---|---|---|
| find-signal | `focus_sentence` (where the tier left it off), `link_model` | `short_link_sentence` |
| name-structure | `structure_model`, `say_choices` (where the menu is not spoken) | `structure_practice` |
| place-idea | `say_choices`, `anchor_idea`, `source_sentence` | `two_part_practice` (3-part charts) |

- **Pool (R2):** `textStructureModels.ts`, 17 link sentences (one linking word each) and 10 three-sentence mini passages, two per structure, none printing a structure's name.
- **Script:** `itemsFromPayload` now returns the spare ideas the cap held back; an `onCard` practice item asks about the card, not "sentence N"; `STRUCTURE_DISTANCE` moved from the generator so the runtime practice reads it. The generator asks for six key ideas (four asked, two spares).
- **Misses:** `not_in_sentence`, `said_topic` (from the title) and `said_signal_word` (from the session's linking words). Grade 2's structure ask has no lever by decision (a two-structure band answers by elimination); a unit test pins it.
- **Guidance:** trimmed by about 90 characters and one sentence added ("You may say an idea card, and read a model card aloud: it is not the passage"); 1919 of 2000 delivered.

**Size:** about 420 production lines (pool 60, lever module 250, component 110), against 240 test lines.

## Measured

| Gate | Result |
|---|---|
| Unit (`textStructureAnalyzerLevers.test.ts`, 105) | link sentences have one linking word; no mini passage names a structure; on every saved payload (12) the link model's word is not in the passage, the practice sentence is answer-free and on a card, the structure model is another in-band structure and the practice menu two far options, anchor and two-part ideas are never asked, a ringed source sentence never names the part; every miss → a help lever first except grade 2's structure ask |
| Mounted (`TextStructureAnalyzer.levers.workspace.test.tsx`, 4) | ring and link model, practice card, the full item returns credited alone; spoken-menu marks, a model of another structure, a two-option practice passage; anchor example, ringed source sentence, two-mat practice; easy draws the ring, not offered |
| R8 class check | text-structure-analyzer row |
| Dry journey J1-J11 | 12/12 payloads |
| typecheck / suites | lumina 0; full tsc 771 (baseline); live-activity + literacy suites 4723 pass |
| Text replay (Flash, 12 payloads × 5) | 0 flags. First run: 1/60, a tutor that pulled `link_model` itself and, answered with the pre-pull packet, made up a model with the item's own linking word. All four families' model levers now say to read only the card the receipt names; the genre and sentence-analyzer replays were re-run after it: 0 flags |

## Not covered

- The replay answers a tutor's own pull of a lever the sweep did not pull with the pre-pull packet; tool narration is Live's to show (class gate).
- Not browser-checked (HUMAN-CHECKS #184). No Live run: the class gate (plan step 5) is next.
