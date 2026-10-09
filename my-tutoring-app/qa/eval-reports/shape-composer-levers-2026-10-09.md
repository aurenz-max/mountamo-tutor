# shape-composer — support levers, 2026-10-09

Phase 2 of C11, after the W1 binding (`qa/tutor-reports/shape-composer-w1-2026-10-09.md`). Pure module
`shapeComposerLevers.ts`; lever state in `ShapeComposer.tsx`, keyed by the session item; catalog `levers: true`.

## Failure inventory
No real-learner evidence (no demonstrations, misconception or remediation files for this id). Observable misses are
`shapeComposerMiss` (synthetic: the sweep and the workspace tests drive them); causes are documented in the catalog's
`commonStruggles` (far from the outline, not rotating, wrong shapes on decompose, stuck on how-many) or inferred.

| Mode | Miss (observed on screen) | Class |
|---|---|---|
| compose-match | pieces_left, piece_off_outline | synthetic; documented (placement, rotation) |
| compose-picture | shape_missing, shape_off_spot | synthetic; inferred |
| decompose | not_a_part, missed_part, extra_part, wrong_mix | synthetic; documented (wrong shapes) |
| how-many-ways | too_few, too_many | synthetic; documented (stuck) |
| free-create | missing_piece, extra_piece, overlapping, not_touching | synthetic (OB-9M drive) |

## Lever table

| Mode | Lever | Kind | Answers | Carrier | Leak rule |
|---|---|---|---|---|---|
| compose-match | empty_space: the outline's uncovered part lit | help | both | shown | lights only what no piece covers; never a piece's spot |
| compose-match | in_place: each board piece ringed green (in a place) / amber | help | piece_off_outline | shown | the learner's own pieces; never where one goes. Refused on an empty board |
| compose-match | fewer_pieces: another outline, two pieces | simplify | both | shown | not the item's target; fewer pieces; only for 3+ pieces |
| compose-picture | empty_spots: unfilled spots glow (even when spots are hidden) | help | both | shown | spots only (the medium tier's guides) |
| compose-picture | smaller_picture: lollipop or tent, two shapes | simplify | both | shown | not the item's picture; only for 3+ spots |
| decompose | split_lines (only where the session hides them) | help | missed/extra/wrong_mix | shown | names no part |
| decompose | parts_model: another big shape split, parts tinted and tagged | help | all four | both (tags read aloud) | never uses or names an item part shape |
| decompose | two_parts: a two-part big shape | simplify | missed/extra/wrong_mix | shown | not the item's shape; only for 3+ parts |
| how-many-ways | pieces_model: a shape built from outlined squares, count in words in the fact | help | both | both | never the item's shape or its number; no digit |
| how-many-ways | smaller_build: a known two-piece build of another shape | simplify | both | shown | not the item's target; only when the answer is above two |
| free-create | list_match: list icons light per matching shape; off-list shapes ringed | help | missing/extra | shown | the learner's own work against the shown list |
| free-create | join_marks: green touching / amber alone / red on top | help | not_touching, overlapping | shown | the learner's own work. Refused on an empty board |
| free-create | smaller_recipe: same list one shape shorter | simplify | all four | shown | a different, shorter list; only for 3+ shapes |

No lever: free-create `too_few_shapes` (older payloads with no recipe; catalog `unanswered`). Starting positions from
`config.difficulty` unchanged: the existing seams/snap-guide tiers stay the start; no generator change.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline).
- `shapeComposerLevers.test.ts` 25/25 (builders over generated shapes and saved payload items, leak rules per mode,
  miss → lever tables, every miss answered on every item); `ShapeComposer.levers.workspace.test.tsx` 6/6;
  `ShapeComposer.workspace.test.tsx` 10/10.
- `components/live-activity` + `misses.test.ts` + shape-composer tests: 41 files, 3094 passed. Sweep for shape-composer
  J1-J13: 0 new findings (decompose and how-many-ways driven; the three drag modes stay J1-baselined, so J12/J13 run on
  them only through the unit and mounted tests).

## Tutor replay (5 payloads x 5 samples)
- r4 (`replay/shape-composer-2026-10-09-r4.json`): how-many-ways key flags 14/15. Read by hand: the tutor could not see
  the model and counted it as "one, two" (the item's answer). Fixed: the fact and `does` carry the model's count in
  words; guidance adds "never say how the shape splits (such as cutting it corner to corner)".
- r5 (`-r5.json`): 13 key flags remain on how-many-ways, all the tutor counting the model "one, two, three" (the check
  matches "two" inside the count). Decompose stuck/lever replies pull `parts_model` and point at it without naming a
  part; 0/10 change-before-receipt. One stuck reply said "imagine cutting your square tile in half" (1/5): a split hint.

## Open findings
1. **Harness, replay `no_key_before_try`** (shared, `/add-live-tutor-tools`): counting a model aloud through the key's
   number reads as stating it. Exempt a counted sequence that runs past the key.
2. **how-many-ways split hint** (1/5 after the guidance fix): watch on the class Live run; the deeper fix is
   finding 3.
3. **how-many-ways has no buildable target** (`/eval-fix`): palette triangles are isosceles 50x50 boxes; two do not make
   a square. The mode asks about a shape the board cannot build.
4. The drag modes' levers are verified in JSDOM only: needs a browser check on empty_space, in_place, empty_spots and
   join_marks drawing.
