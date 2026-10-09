# addition-subtraction-scene levers (2026-10-08 class sweep, built 2026-10-09)

`/add-support-tiers` on act_out, build_equation, solve_story, create_story. The user waived the Phase 2 table check for this sweep, so the table was designed and built in the same pass.

## Failure inventory

No real-learner evidence (`logs/demonstrations` has nothing for this primitive). Every miss below is already named in code by `addSubMiss` (pictures, number sentences) or `additionSubtractionSpokenMisses` (spoken numbers), and listed in the catalog `misses`.

| Mode | Failure (miss id) | Class |
|---|---|---|
| act_out K, create_story | picture ends on the start number (`no_change`) | synthetic (journey wrong input) |
| act_out K, create_story | sent away on a joining story, or brought in on a leaving one (`wrong_way`) | documented (catalog "Confuses joining with taking away") |
| act_out K, create_story | one or more off (`one_short`, `one_over`, `short_by_more`, `over_by_more`) | synthetic |
| build_equation | unfinished sentence (`unfinished_equation`) | inferred |
| build_equation | sign reversed (`other_operation`), numbers not in the story (`other_numbers`), does not add up (`false_equation`) | synthetic (DI drive 08-15 used the reversed sentence) |
| solve_story, act_out G1 | says a number the story gave (`said_start`, `said_change`, `said_result`), other operation, off-by | documented (catalog commonStruggles) + synthetic (DI signature drive 08-15) |

## Lever table

| Mode | Failure | Lever | Kind | Carrier | Leak rule |
|---|---|---|---|---|---|
| all four | loses which objects were there at the start, which joined, which left | `story_groups`: the start group moves into a dashed pen on the left, joiners sit to its right, departures stay as faded outlines in the pen | help | shown | never on a solve-story asking for the change or the start (the set-apart group is the answer); never with no start group; the fact names what is drawn, never a count the learner has not made |
| build_equation | unfinished sentence | `sentence_frame`: the tray becomes five boxes, square for a number, round for a sign, filled by the learner's own tiles in order | help | shown | a box only ever holds a tile the learner placed |
| all four | cannot do the story even with help | `smaller_story`: ungraded `<item>~simpler` story, same mode/band/operation, one joining or going away, asking for the end | simplify | shown + voiced (story read aloud) | never the item's numbers, its answer or the number it hides, another item's story, or a bigger picture; not offered on the plainest shape (one joining, start ≤ 2) |

Per-item coverage: `story_groups` is on every item with a start group except solve-story change/start, where `smaller_story` (asking for the end) is the only lever and answers all its spoken misses. On a plainest act_out/create item (e.g. 2 + 1 = 3) there is no simplify; `story_groups` answers every picture miss there. A solve-story change/start item at the smallest numbers (no practice story passes the leak rule) would have no lever; none of the payload items hit this, and no `unanswered` entry was added.

## What was built

- `additionSubtractionSceneLevers.ts` (new): lever declarations, `groupLayout`, `departedSlots`, `groupsFact`, `frameBoxes`, `smallerStory`, `practiceLeaks`, `practiceParent`.
- `AdditionSubtractionScene.tsx`: lever and practice state, `pullLever`/`endPractice`, `onPracticeClosed`, pen + faded outlines, framed tray, practice badge. Render fix: an enacted scene now has a position for every object up to `maxNumber`; before, an object brought in past the story's count was counted but not drawn (a `one_over` picture looked right).
- `liveJourneySpec.ts`: the row rebuilds a `~simpler` item from its parent with `smallerStory`.
- Contract R9 + changelog.
- Not done: Phase 6 starting positions. The existing tier axes (count badges, grouped reveal, tile palette, unknown position) stay; every lever starts released at every tier.

## Tests

- `additionSubtractionSceneLevers.test.ts`: 24 pass (leak rules per lever, `smallerStory` over every in-band story for each mode/band, miss → `nextLever` tables).
- `AdditionSubtractionScene.levers.workspace.test.tsx`: 6 pass (pull changes picture + fact in one commit, next attempt records the lever, refused pull changes nothing, practice story ungraded then full item back blank and credited, sentence frame, solve-story change, over-built picture drawn).
- Existing suites (workspace, script, DI script, oracle, affordances, lessonWorkspacePlan): 183 pass. Journey sweep filtered to this primitive's 4 payloads: pass.
- `typecheck:lumina`: 0 errors in these files (1 error in a sibling's `hundredsChartLevers.test.ts`).
- Not run: tutor replay, Live.
