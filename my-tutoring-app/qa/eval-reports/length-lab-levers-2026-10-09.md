# length-lab levers, 2026-10-09

/add-support-tiers on the C10 W1 binding. Not committed.

## Failure inventory
None of this comes from real learners. The misses are what `lengthMiss` observes (synthetic: the sweep's wrong inputs). The catalog `commonStruggles` documents two causes: mixing up longer and shorter, and gaps or overlaps when tiling. No demonstrations, misconception or remediation files exist for length-lab.

| Mode | Misses (class) |
|---|---|
| compare | reversed (synthetic + documented), said_same, missed_same (inferred) |
| tile_and_count | one_short, one_over, short, over (synthetic + documented gaps/overlaps) |
| estimate_then_tile | tiled_to_guess (synthetic), plus the tile misses |
| two_unit_compare | chose_bigger_unit (synthetic) |
| order | reversed_order (synthetic), swapped_pair, other_order (inferred) |
| indirect | chose_shorter (synthetic), said_same (inferred) |

## Lever table (built)
| Mode | Lever | Kind | Carrier | Answers | Leak rule |
|---|---|---|---|---|---|
| compare | word_model | help | both | reversed, said_same, missed_same | A model outside the item: grey bars tagged longer/shorter/same. Names no item object. |
| compare, order | end_lines | help | shown | said_same, missed_same / swapped_pair, other_order | Each bar's far end becomes a dashed line. Marks no bar. |
| compare, order | unit_marks | help | shown | as above (+ reversed on compare) | Unit cells, no count. Offered only where the session hides the marks. |
| compare | far_pair | simplify | shown | said_same, reversed | Two plain objects 3 vs 9, with the other answer word. Offered only when the item's lengths are within 2. Never on a "same" item. |
| tile, estimate | object_outline | help | shown | every tiling miss | A dashed outline of the object behind the units. No count. Refused before an estimate's guess. |
| tile, estimate | shorter_object | simplify | shown | short, over (+ tiled_to_guess) | A plain object about half as long (needs length 4 or more), same unit, its own guesses. |
| two_unit | unit_model | help | shown | chose_bigger_unit | A model outside the item: a grey bar with 4 small squares and 2 big ones. Uses neither of the item's units and draws no number. |
| two_unit | shorter_object | simplify | shown | chose_bigger_unit | A 4-cell plain object with a unit pair the item does not use. Offered on objects longer than 4. |
| order | order_steps | help | shown | reversed_order | Three wordless bars under the slots that grow left to right. |
| order | far_three | simplify | shown | swapped_pair, other_order | Three plain objects (6, 10, 2), never drawn in answer order. Offered only when two of the item's lengths are within 2. |
| indirect | chain_model | help | both | chose_shorter, said_same | A model outside the item: red, blue and green bars from one start, with "shorter than" captions. |

indirect has no simplify lever, because the step through the reference object is what defines the mode. Its help lever answers both misses. No miss is left unanswered, so the catalog has no `unanswered` entry.

## Built
- `lengthLabLevers.ts`: declarations, the three builders, `simplerLeaks`, `leverTextLeaks`, `leverFacts`.
- `LengthLab.tsx`: lever and practice state keyed by item, `pullLever`/`endPractice`, the scene fact `onScreen`, and the lever pictures.
- Catalog: `levers: true`. One guidance clause added: never say whether to add or take away units (see Replay).
- `liveJourneySpec.ts`: the length-lab row rebuilds a `~simpler` item with the same builder, for the Live `--lever` bench.
- Starting positions: no generator change. The tier's existing `showUnitTicks` and `showAlignmentFeedback` are the starting positions.

## Gates
- `typecheck:lumina`: 0 errors in length-lab files. The one remaining error is the sibling measure-lab row at `liveJourneySpec.ts:764`.
- `lengthLabLevers.test.ts` 25/25, `LengthLab.levers.workspace.test.tsx` 6/6, `LengthLab.workspace.test.tsx` + `pip/LengthLab.surface.test.tsx` 14/14.
- Full `journeySweep` + `workspaceContract` + `misses`: 2629 passed, 488 skipped. Re-run after the guidance and journey-row edits: `-t length-lab` 32/32, and `workspaceContract` + `misses` 2141/2141. length-lab J1-J12: 0 findings on all 6 payloads.

## Replay (6 payloads x 5 samples)
- **First run:** 0 misses on every check except miss `no_fix_before_try` 1/30. That reply said "Try adding more feet". On reading, some tile replies also said "use minus to take one away".
- **Fix:** one guidance clause, quoted in Built.
- **Second run:** every check 0. Stuck and lever replies describe the picture after the receipt and do not name the item's answer.

## Open findings
1. **Generator, two_unit_compare** (`/eval-fix`): unit B is always the bigger unit, so the answer is always the first unit. This is a positional key, and it predates the levers.
2. W1 findings 1-2 (instructions name the wrong units; an order instruction lists the objects in answer order) remain open.
3. The lever pictures need a browser check. They have only been exercised in JSDOM.
