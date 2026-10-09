# periodic-table levers (2026-10-08 class sweep, built 2026-10-09)

`/add-support-tiers` on explore (Element Hunt, tap), identify (Name It, spoken), trend (compare + outer electrons, spoken). Phase 2 stop waived by the user for this sweep.

## Failure inventory

No real-learner evidence (no demonstrations, misconception or tutor reports for this primitive). No contract doc exists (`docs/contracts/periodic-table.md`).

| Mode | Failure | Class | Miss id |
|---|---|---|---|
| explore | taps a box whose symbol shares the first letter (N for Na) | documented (catalog) + synthetic (journey neighbour tap) | `same_first_letter` |
| explore | taps a touching box / same row / same column / elsewhere | documented ("taps a box next to the right one") | `next_box`, `same_row`, `same_column`, `other_box` |
| identify | reads the symbol letters back instead of the name | documented (commonStruggles, DI harness signatureWrong) | `said_symbol` (new) |
| identify | names a box touching the asked one | documented (key, harness signatureWrong) | `next_box` (new) |
| trend | names the other element of the pair | documented (key) | `other_of_pair` |
| trend | says the group number for outer electrons | documented (commonStruggles) | `group_number` |
| trend | miscounts the tall columns | inferred | `one_short`, `one_over`, `short_by_more`, `over_by_more` |

Name It had no miss list. `periodicSpokenMisses` now names `said_symbol` then `next_box` (touching boxes' names as examples); catalog `misses.identify` added.

## Lever table

| Mode | Failure | Lever | Kind | Carrier | Leak rule (code) |
|---|---|---|---|---|---|
| explore, identify (group-and-period clue) | wrong row / column | `axis_marks`: rings the asked group number on the top axis and period number on the side | help | shown | never marks a box |
| explore, identify (number clue) | lands near the number | `row_ranges`: each period label shows its row's first-last atomic number | help | shown | the same for every item; never marks a box |
| explore (name/symbol clue), identify (symbol clue) | look-alike box | `letter_lit`: boxes whose name/symbol starts with the asked first letter lit, rest dimmed | help | shown | `litLeaks`: at least 3 lit and the target among them |
| identify | `said_symbol` | `box_key`: another element's box with number / symbol / name labelled | help | shown | `keyLeaks`: key element in no session item; pool disjoint from the practice pool |
| trend, size | `other_of_pair` | `column_model`: another group's column, each atom a circle sized by shell count | help (model) | shown | `columnModelLeaks`: not the pair's group, no session element; `does` forbids saying which of the pair is bigger, which is lower, or the rule |
| trend, compare | `other_of_pair` | `pair_marks`: both named boxes ringed alike | help | shown | both rings the same style; fact never says bigger/lower |
| trend, valence | group number / miscount | `tall_columns`: groups 3-12 dimmed | help | shown | no column numbered or marked |
| explore, identify, valence | any | `simpler_item`: same clue on an element in rows 1-2 (valence: group 1 or 2), ungraded, id `<item>~simpler` | simplify | shown | `practiceLeaks`: same kind and clue, plainer, element in no session item |

Easy tier starts every help lever shown (not recorded as a pull), simplify released. No generator change: the tier already arrives as `supportTier`.

## Per-item gaps (by design, not uncovered)

- `letter_lit` cannot exist for Potassium/Krypton/Zinc/Xenon on a symbol clue and Krypton/Zinc/Xenon on a name clue (fewer than 3 boxes share the letter). All are rows 4-5, so `simpler_item` answers their misses there.
- No `simpler_item` on items already in rows 1-2, on group 1/2 valence items, or on any compare (a two-element same-group pair has no simpler shape in the mode). Every such item still has a help lever for each miss.
- Reactivity compare has only `pair_marks`: a model column from another family would teach the wrong direction (alkali down, halogens up), and drawing the direction on the item's column states the answer. Rule reversal on reactivity is left to the scripted correction.

Unit test: every miss of every item the draw can make (35 familiar elements x every clue, every compare pair, every valence target) has a lever declaring it, and every item of the three saved payloads. No catalog `unanswered` entry needed.

## Built

- `primitives/chemistry-primitives/periodicTableLevers.ts` (new): levers, leak rules, builders, `leverFacts`, `periodicPracticeItem/Parent`.
- `periodicTableWorkspace.ts`: Name It spoken misses (`touchingNames`).
- `PeriodicTableGrid.tsx`: optional props `litNumbers`, `ringNumbers`, `markGroup/markPeriod`, `rowRanges`, `dimMiddle` (exploration table unaffected).
- `PeriodicTable.tsx`: lever state + practice item (LetterSpotter pattern), `pullLever`/`endPractice`, key card and column model, practice tap check.
- Catalog: `levers: true`, `misses.identify`, guidance "a lever is the only mark you can put on the table".
- `liveJourneySpec.ts`: the periodic-table row rebuilds a `~simpler` item from its parent.
- New payload `w1-payloads/periodic-table.identify.json` (save_payload.py, code draw, no LLM).

## Tests

- `periodicTableLevers.test.ts` 168/168 (leak rules, builder over every askable item, nextLever table, per-item coverage, payload simplify reachability, scene facts).
- `PeriodicTable.levers.workspace.test.tsx` 7/7 (pull changes screen + fact in one commit, refused pull leaves scene/levers/attempts unchanged, next attempt records the lever, tap and spoken practice items ungraded with the full item back blank and credited, easy start is not a pull).
- Existing: `PeriodicTable.workspace.test.tsx`, `periodicTableWorkspace.test.ts`, DI script test, catalog `misses.test.ts`, `lessonWorkspacePlan.test.ts`, W1 contract (periodic) all pass. `typecheck:lumina` 0.
- Not run (batch step): journey sweep, tutor replay. No Live.
