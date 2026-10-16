# planetary-explorer levers, all modes (2026-10-15)

`/add-support-tiers` on explore, identify, compare and apply, in the same pass as the W1 binding
(`qa/tutor-reports/planetary-explorer-w1-2026-10-15.md`). Non-interactive run: the lever table was built without a
review stop.

## Failure inventory
- **Real-learner evidence:** none (no demonstrations, misconception, remediation or eval-report files name this primitive).
- **Documented:** catalog `commonStruggles`: answering without reading the card; mixing up planets already visited;
  comparing across planets; a pre-reader cannot read the card or the choices.
- **Synthetic:** the journey's wrong answers (`planetHarnessAnswers`).
- **Inferred:** the quiz misses (the planet next door, the same kind, the other kind).
- **Evidence corrupted, fixed first:** "Red none" on explore cards (generator unit), the labelled quiz map.

| Mode | Misses (class) |
|---|---|
| explore | true_false_flipped (synthetic), other_planet_fact (documented), other_number, other_choice, other_planet (inferred) |
| identify | quiz: neighbour_planet, same_family_planet, other_family_planet (inferred); warm-ups as explore |
| compare, apply | other_planet (documented: compared pair), other_planet_fact (documented), other_number, other_choice |

## Lever table (built, `planetaryExplorerLevers.ts`)
| Lever | Kind | Where | Answers | Leak rule (code) |
|---|---|---|---|---|
| `planet_card`: this stop's fact cards back beside the question | help | stop questions | stop misses | `cardLeak`: withheld when any choice is printed on a card value (whole words or number), when half a long choice's words are, and on every true-false statement |
| `visited_cards`: every visited planet's cards side by side, none marked | help | stop questions after the first stop | stop misses | same rule over every card; a planet-name menu needs a card for every named planet |
| `family_model`: a small grey rocky world and a big striped giant, not from this trip | help | quiz menus that span both kinds | other_family_planet | names no planet |
| `drop_far_choice`: greys out one wrong choice | simplify (on the item, user ruling 09-27) | 4-choice questions after one wrong answer | every choice miss | never the key; planets: farthest in order from the Sun, numbers: farthest, words: fewest words shared with the key; at least two untried choices left |

Starting position (Phase 6): `supportTier: easy` (already stamped by the generator) starts the help levers that may be
shown, except `visited_cards`, drawn and declared pulled, not recorded as help. No generator change.

**Considered and rejected:** the card back on explore questions whose answer is on it (it is the answer: `cardLeak`
withholds it); the map's names as a quiz lever (they answer the distance and size clues); a code-built practice
question (a simpler item about the same planet repeats the card's facts, and one about another planet changes what is
recalled).

## Gates
- `planetaryExplorerLevers.test.ts` 18/18 (leak rule cases, every payload item, the greyed choice table, miss -> lever).
- `PlanetaryExplorer.workspace.test.tsx` 9/9: a pull changes the screen and the scene fact in one commit, a repeat pull
  is blocked and changes nothing, the next attempt records the levers, an easy item opens with its levers drawn.
- Sweep: 0 findings on 4 payloads (J9, J12, J13 included). Every catalog miss is answered by a lever except
  explore's `true_false_flipped`.
- Replay r2: on "I'm stuck" the tutor pulls `planet_card` or `drop_far_choice` itself and describes it after the call
  (`no_change_before_receipt` 0/20); no reply names the key.

## Failures with no lever
- `true_false_flipped` (explore): a true-false statement is already the smallest judgement and its truth is read off
  the cards, so no card may come back beside it. Listed as unanswered in the catalog.
- On explore questions whose answer is printed on the card (colour, moons) only `drop_far_choice` is left, and only on
  4-choice questions.
