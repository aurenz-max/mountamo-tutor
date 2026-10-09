# story-map — support levers, 2026-10-09

Bound at W1 the same day (`qa/tutor-reports/story-map-w1-2026-10-09.md`). Every mode levered.

## Failure inventory
No real-learner evidence (no demonstrations, misconception or eval reports for story-map). Observed-synthetic = the
journey's wrong inputs; documented = catalog commonStruggles ("confusing parts", "missing elements", "wrong sequence").

| Phase (modes) | Miss (`storyMapMiss`) | Class |
|---|---|---|
| identify (all) | `picked_not_in_story`, `missed_character` | documented ("missing elements"), synthetic |
| identify (all) | `wrong_setting` | inferred |
| sequence (all) | `next_part`, `far_part`, `one_part` | documented ("confusing parts") |
| sequence (all) | `reversed` | documented ("wrong sequence"), synthetic |
| analyze (plot_diagram, heros_journey) | `inside_outside`, `other_outside` | inferred |

## Lever table
| Phase | Lever | Kind | Carrier | Answers | Leak rule (code) |
|---|---|---|---|---|---|
| identify | `character_count` | help | shown (person spaces) + voiced count | picked_not_in_story, missed_character | counts picks, never which; declared only when some printed name is not a character (`countLeaks`) |
| identify | `easier_story` | simplify | shown | all 3 | pool story, same structure, no session name/event/title (`practiceLeaks`) |
| sequence | `part_pictures` | help | shown (🏠📈⚡🛠️✅ + words) | one_part, next_part, far_part | same on every story; no event/name/setting (`helpLeaks`) |
| sequence | `arc_arrow` | help | shown | reversed, far_part | no event on it |
| sequence | `easier_story` | simplify | shown | all 4 | as above; bme prints a 3-sentence telling |
| analyze | `conflict_pictures` | help | shown (💭 🧍🧍 🌪️ 👥📜 + words) | inside_outside, other_outside | on every choice; fact never repeats a label |
| analyze | `easier_conflict` | simplify | shown | both | one-sentence pool conflict, 3 choices incl. the crossed one |

No miss is unanswered. Since the follow-up, every story prints at least one non-character (generator ladder 1/1/1/2,
code fallback pool), so `character_count` is offered on every identify; `countLeaks` stays as the guard.

## Built
`storyMapLevers.ts` (declarations, facts, pictures, leak rules, pool builders); `StoryMap.tsx` lever state keyed by
phase, `shown` = practice story or session story, `pullLever`/`endPractice`, four `data-lever` renders, practice
marker; catalog `levers: true`; journey row rebuilds `<phase>~simpler` with the same builder. No `config.difficulty`
starting positions (the tier already sets the distractor count; a starting lever is not needed for a check).

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline).
- `storyMapLevers.test.ts` + `StoryMap.levers.workspace.test.tsx` + `StoryMap.workspace.test.tsx`: 55/55; all literacy
  tests 2967/2967.
- Sweep J1-J13 on 4 payloads: 0 findings; lever inventory: every miss answered on every mode (J9/J12); J13 passed on
  the first help-levered item of each payload. `workspaceContract`, `misses.test`, `activityContract`,
  `lessonWorkspacePlan` pass.
- Replay (`replay/story-map-2026-10-09-r3.json`, 4 x 5 samples, start/miss/stuck/lever/credit): 0 misses. By hand:
  at "I'm stuck" the tutor pulls `character_count` (plot_diagram) or `easier_story` (others) with no words, then
  speaks after the receipt; lever replies say what is on screen and ask "who else was in the woods?", naming no
  character as the answer.
- `replay_checks.py`: `no_change_before_receipt` now also catches "appeared", "I opened/brought up/pulled up" and
  "on the screen now" in a pulling turn (pinned in `test_replay_checks.py`, 53 pass). No story-map reply hit it.

## Follow-up: identify never "select all" (same day)
Re-gated after the change: story-map tests 66/66; sweep J1-J13 0 findings, every miss answered on every mode;
`typecheck:lumina` 0; replay r4 (`replay/story-map-2026-10-09-r4.json`, 4 x 5): 0 misses. By hand, `character_count`
is now pulled at stuck on all four payloads, the tutor speaks after the receipt and asks "who else was in the
story?"; one bme reply says "tap the puppy's name" (points at the role, not the name) and some say "you already
found Sam" (confirms a pick the screen does not mark).

## Open
- Replay moments cover the first item only: sequence and analyze levers are unit- and sweep-tested, not replayed.
- G2 (fixed setting distractors), G3 (conflict types cluster) in the contract.
