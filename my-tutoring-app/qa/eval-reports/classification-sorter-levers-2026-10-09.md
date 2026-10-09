# classification-sorter levers, 2026-10-09

One mode, `sort`. Only help levers. Code: `classificationSorterLevers.ts`, wired in `ClassificationSorter.tsx`;
catalog `teachingWorkspace.levers: true`.

## Failure inventory
| Failure | Miss | Class |
|---|---|---|
| Does not know what the groups mean (pre-reader cannot read the names) | all | documented (commonStruggles) |
| Places without checking the card against the rule; stuck on a boundary case | `wrong_group` | documented, synthetic (journey) |
| Guesses after a wrong placement | `repeated_group` | documented |
| Confuses a group with its parent or sibling (6-8 hierarchies) | `parent_group`, `sibling_group` | inferred |

No real-learner evidence. No demonstration logs, misconception or remediation files exist for this primitive.

## Levers
| Lever | Kind | Carrier | Answers | Leak rule (code, tested) |
|---|---|---|---|---|
| `group_meaning`: the group descriptions under each group name | help | both | all four | only where the band hides them (K-2); refused if a description names the card; group names inside read "this group" or `___`; the fact lists them by position, not by name |
| `card_clue`: the card's own hint under the card | help | both | all four | every word built on a group-name stem blanked (`blankGroupWords`, `namesAGroup`); offered only if 3 words remain |
| `sorted_marks`: rings the credited cards in their groups | help | shown | wrong, repeated, sibling | only once a card is sorted; marks only credited cards |

**No simplify, by design:** the one simpler shape of a sort is fewer groups. On the learner's own card that leaves a
two-way choice that gives away the answer. Any other card is a later graded item of the same lesson.
**No starting positions:** the generator has no `config.difficulty` tier harness.
**K-2 carrier:** both text levers are words, which a pre-reader cannot read. They work at K only if the tutor says them,
and the scene fact gives the tutor the words. No picture lever is possible: items have no images (`imagePrompt` is
never rendered).

## Gates
- `classificationSorterLevers.test.ts` 20, `ClassificationSorter.levers.workspace.test.tsx` 3, workspace test 5: pass.
- Sweep J1-J13 on `classification-sorter.sort`: 0 findings. The first sweep run hit J13 twice: the meaning fact repeated
  "Has Wings" beside the descriptions. The fact now lists the descriptions by position. Lever inventory: every miss answered
  (`parent_group` by meaning and clue).
- typecheck:lumina: 0 errors in these files (the remaining errors are in letter-workshop sibling files).
- Replay 5 samples (`replay/classification-sorter-2026-10-09-r3.json`): 0/5 on every check at start, miss, stuck
  (incl. `no_change_before_receipt`), lever, credit. In stuck, the tutor pulls `card_clue` itself in 5/5.

## Open
- In the lever moment the tutor reads both descriptions as "one says ..., the other says ...". It does not say which
  group each description is under, so a pre-reader cannot tell. The fact gives position only. A ruling is needed on
  whether naming the group beside its own description is allowed (the J13 key rule currently counts that as a leak).
- 3-5 and 6-8 items whose hint is all group words get only `sorted_marks`, and none on the first card. No such payload exists yet.
