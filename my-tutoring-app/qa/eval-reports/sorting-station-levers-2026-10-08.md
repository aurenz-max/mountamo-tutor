# sorting-station — in-item levers (2026-10-08 class sweep)

`/add-support-tiers` on all seven modes. The user waived the Phase 2 confirmation stop for this sweep. Production code: `sortingStationLevers.ts` (228 lines, about 60 of them docblock) and about 150 lines in `SortingStation.tsx`, plus the journey row's `~simpler` rebuild. Tests come to about 300 lines.

## Failure inventory

Every answer is spoken. The misses are what `sortingStationSpokenMisses` names, and the catalog lists them.

| Mode (item kind) | Miss | Evidence |
|---|---|---|
| sort_one / sort_variety / sort_attribute (sort) | `said_object`: says the card's name back | documented (commonStruggles), synthetic (DI drives 08-18) |
| same | `other_group` | synthetic (plain wrong in every drive) |
| sort_attribute (pick_rule) | `other_rule` | synthetic |
| odd_one_out | `belonging_card`, `said_all_belong` ("they all go together") | documented + synthetic |
| count_compare / tally_record (count_group) | `one_short`, `one_over`, `short_by_more`, `over_by_more` | synthetic (signature off-by-one), documented (counting aloud) |
| count_compare (compare) | `other_group`, `said_same`, `bare_more` | synthetic, inferred |
| two_attributes | `one_criterion_only`, `opposite_verdict` | documented + synthetic |

There is no observed-real evidence. No demonstrations, misconception reports or remediation module exist for this primitive.

## Lever table (built)

| Kind | Lever | Type | Answers | Leak rule (code) |
|---|---|---|---|---|
| sort | `try_each`: the card's picture plus "?" on every tray | help, both | said_object, other_group | identical on every tray; no tray marked |
| sort | `tray_examples`: a card credited in an earlier round, shown on its tray | help, shown | other_group | same rule, another challenge, never a card on this page (`trayExamples`) |
| sort (readers) | `tray_pictures`: the tray picture on Grade 1 trays | help, shown | other_group | withheld if a tray picture is the card's own (`trayPicturesLeak`) |
| pick_rule | `show_trays`: the empty trays under the cards | help, shown | other_rule | withheld if a tray is named with a way to sort; trays render empty (`showTraysLeak`) |
| odd_one | `odd_model`: a fixed row of 3 blue circles and 1 red square | help, both | said_all_belong, belonging_card | fixed model, never the cards |
| odd_one | `three_cards`: 3 new cards (2 of one kind, 1 of a far kind) | simplify | belonging_card, said_all_belong | pool pictures never on the page; only offered on 4+ cards |
| count_group | `focus_tray`: the other trays dim | help, shown | over_by_more, one_over | no number |
| count_group | `tap_marks`: tap a picture in the tray to ring it | help, shown | all four off-by misses | rings only the learner's taps |
| compare | `line_up`: each group in a row, one picture per column, aligned | help, shown | other_group, said_same, bare_more | no number, no row marked |
| compare | `far_compare`: 2 new groups of 1 and 4 | simplify | other_group, said_same | only when the item's groups differ by 2 or less; never "the same"; new kinds and pictures |
| both_criteria | `check_boxes`: an empty box beside each criterion that the learner taps (✓/✗) | help, both | one_criterion_only, opposite_verdict | start empty; code never fills them |

Coverage is checked per item: on every item in the 7 saved payloads, every miss the item names has a lever on that item (unit test). No catalog `unanswered` entry was needed. The `QUEUE-item-gaps-2026-10-09.md` file and the baseline have no sorting-station rows.

## Left without a lever, and why

- **No simplify on sort.** Every saved payload sorts into 2 trays, which is already the simplest form. With 3 or more trays, a simpler sort would need a new card that belongs to the generated groups, and no picture pool is organised by those groups (word-sorter has the same gap). The help levers cover both sort misses on every item.
- **No simplify on count_group.** Saved counts are 1 to 3, which is already the simplest. A smaller-count builder would never be offered (lesson d).
- **No simplify on both_criteria.** Dropping a criterion turns the item into `sort_one`, a different mode.
- **No starting positions from `config.difficulty`.** The generator's existing tier stamps (showCounts, the model item, naming the groups, tray pictures) remain the starting positions.

## Tests

- `sortingStationLevers.test.ts`: 22/22. Covers the miss → `nextLever` table, the per-item coverage over saved payloads, each leak rule, and the builders. Both builders fire on every saved odd and compare item and never reuse a page picture.
- `SortingStation.levers.workspace.test.tsx`: 5/5 through `workspaceHarness`:
  - A pull changes the screen and the `onScreen` fact in the same commit.
  - The next attempt records the levers and is marked assisted.
  - A refused pull leaves the HTML, levers and attempts unchanged.
  - `far_compare` and `three_cards` open a `~simpler` practice item with new pictures and no levers. After it, the full item comes back and is credited.
- Existing suites: 11 files, 143/143. `SortingStation.workspace.test.tsx` now expects `pull_lever` among the tutor's tools.
- `typecheck:lumina`: 0 errors in these files. The 3 remaining errors are in the sibling's `calendarExplorerLevers.ts`.
- Not run, as instructed: the journey sweep (J1–J12), tutor replay, Live, or a browser check. The levers' visual layout needs a browser look.
