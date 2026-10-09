# spatial-scene levers — 2026-10-08 (class sweep, built 10-09)

`/add-support-tiers` on all seven modes. Phase 2 confirmation waived by the user's class-sweep opt-in.

## Failure inventory

Evidence classes: **observed-real: none** (no demonstrations, tutor reports or misconception files name spatial-scene).
**observed-synthetic:** the journey harness's wrong answers (another option word, another empty cell, the opposite
spoken relation). **documented:** catalog `commonStruggles` (above/below reversal; beside vs between; losing track over
multi-step directions) and the checked misses `spatialMiss` already named. **inferred:** comparing with the wrong drawn
thing (four things on a 3×3 grid, the reference only named in text), left/right confusion from the YOU viewpoint.

`place` had no miss function. Added: `opposite_cell`, `same_axis_cell`, `other_axis_cell`, `off_line_cell` (from the
reference, against the asked word), and the catalog list.

## Lever table

| Mode | Misses (class) | Lever | Kind | Carrier | Leak rule (code) |
|---|---|---|---|---|---|
| identify, describe | other_axis_word (inferred) | `mark_reference` ring on the reference | help | shown | `markLeaks`: only a drawn reference, never the target or an answer cell |
| identify, describe | opposite / same_axis / other_axis_word (documented) | `word_picture` dot-and-square picture on EVERY word button | help | shown (no text) | `pictureLeaks`: pictures = exactly the options |
| identify, describe | all three | `fewer_things` two other things, two of the item's words (far foil first) | simplify | shown | `practiceLeaks`: item's key false on the practice pair; none of its things |
| place | other_axis / off_line_cell | `mark_reference` | help | shown | never an empty or acceptable cell |
| place | all four | `word_picture` of the asked word beside the grid | help | shown | the asked word only; never on the grid |
| place | all four | `fewer_things` same word, one other thing, exactly one right cell | simplify | shown | answer cells disjoint from the item's |
| place_in | other_object / next_to / away_from_container | `word_picture` of "in" | help | shown | — (ring refused: the container is the answer) |
| place_in | all three | `fewer_things` another container + one other thing | simplify | shown | container cell ≠ item's |
| place_between | next_to_one, touches_neither | `mark_reference` on both references; `word_picture` of "between" | help | shown | ring never on the gap |
| place_between | both | `fewer_things` two other refs alone on another line | simplify | shown | gap cell ≠ item's |
| follow_directions | later_step_cell, other_cell | `mark_reference` on the step's named thing; `word_picture` of the step's word | help | shown | `stepAsk` reads word + thing from the step sentence and holds them to its cell, else no lever |
| describe_scene | opposite_word (synthetic + documented) | `side_labels` left/right hands, "nearer you", same on every scene | help | both | `SIDES_FACT` constant; never on an object |
| describe_scene | opposite_word | `fewer_things` two other things, the relation the other way | simplify | voiced | practice relation ≠ item's |

Every MODEL lever's `does` fences the tutor: never which picture matches, never which square, never the relation.
Easy tier now also starts `mark_reference` shown (not a pull).

## What was built

- `spatialSceneLevers.ts` (new): levers, leak rules, facts, five simpler-item builders, `practiceParent`.
- `spatialSceneWorkspace.ts`: `place` misses in `spatialMiss`.
- `SpatialScene.tsx`: lever/practice state, `pullLever`/`endPractice`, ring on grid cells, `WordPicture`, side labels,
  practice badge.
- Catalog `misses.place`; journey row rebuilds `<item>~simpler` from its parent; contract R17.

Production ~240 lines (module ~330 incl. docblocks, component +96, workspace +8); tests 307 lines.

## Tests

- `spatialSceneLevers.test.ts` 34/34: `holds` = `positionHolds` on every word×cell pair; place miss table; ring/picture
  leak rules on all 22 saved items; simplify builders over saved items and 9 moved-reference variants each (same mode,
  new id, solvable, no leak); miss→lever tables; per-item J12 coverage at every follow-directions step.
- `SpatialScene.levers.workspace.test.tsx` 6/6: pull changes screen + fact in one commit; next attempt records the lever;
  refused pull (`mark_reference` on place_in) leaves HTML, levers, attempts, scene unchanged; simplify opens `i1~simpler`
  (2 things, no levers), practice attempts flagged, the full item back blank and credited with both levers; describe_scene
  side labels; easy start not recorded.
- Existing spatial-scene suites 154/154; journey sweep filtered to the seven spatial-scene payloads: clean, no baseline keys.
- `typecheck:lumina` 0.

## Without levers

- follow_directions has **no simplify**: every generated item is two steps round one thing; one step is `place`.
  Both its misses have help levers on every saved item.
- No miss is left without a lever on any saved item, so nothing was added to `unanswered`. If a follow-directions step
  sentence names no single word + thing that fits its cell, that step has no lever (J12 would show it).
