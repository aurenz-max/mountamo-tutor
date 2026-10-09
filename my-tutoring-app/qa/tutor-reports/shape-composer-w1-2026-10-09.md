# shape-composer — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C11. `withWorkspaceController`: the scripted path is kept (retry until right, Next).

## Modes and what code checks
All five catalog modes are gesture items; the activity's own check (`shapeComposerMatches`, `shapeComposerWorkspace.ts`) is the judge, so no `expectedAnswer` and no key in the scene facts.

| Mode | Learner input | Check | Misses (`shapeComposerMiss`) |
|---|---|---|---|
| compose-match | tap palette pieces, drag into the outline (snap), Check | every target spot holds a same-shape piece | pieces_left, piece_off_outline |
| compose-picture | tap palette shapes, drag onto the picture (snap), Check | every picture spot holds its shape | shape_missing, shape_off_spot |
| decompose | tap a shape per part, Check | taps = `expectedComponents` | not_a_part, missed_part, extra_part, wrong_mix |
| how-many-ways | type a number, Check | = `minimumPiecesNeeded` | too_few, too_many |
| free-create (open build) | build from the recipe, I'm done! | `judgeShapeBuild` (exact shapes, no overlap, all touching) | missing_piece, extra_piece, overlapping, not_touching, too_few_shapes (old payloads) |

Fixed on the way (both paths):
- **Decompose answer leak:** the buttons were exactly the parts, and a button turned green once tapped enough times. Now the parts plus non-parts, alphabetical, blue when tapped, never green.
- **Hint leak on a miss:** the generated hint showed after a wrong check ("Two triangles make a square!" style). A miss now shows the miss words.
- **Scripted evaluation never submitted:** submission sat behind "See Results", which the summary panel hid on the last correct check. Moved to a completion effect.
- Try again keeps the pieces (the learner fixes their build), clears decompose taps and the typed number. Check is disabled on an empty how-many box.

## Gates
- `typecheck:lumina`: 0.
- `ShapeComposer.workspace.test.tsx` 10/10 (drag modes by pointer events), `ShapeComposer.build.test.tsx` + `shapeComposerBuild.test.ts` pass.
- `components/live-activity` (workspaceContract, journeySweep, lessonWorkspacePlan, activityContract) + `misses.test.ts`: 39 files, 3063 passed.
- Sweep `-t shape-composer`: 5 payloads; decompose and how-many-ways 0 findings; compose-match, compose-picture, free-create baselined J1 (no drag input).

## Tutor replay (5 payloads x 5 samples)
- r1 (`replay/shape-composer-2026-10-09.json`): 1 flag, decompose stuck "Put your finger on one piece…" (a tracing strategy, not a fix). Read by hand: how-many-ways replies told the learner to drag triangles "onto the square on your board" — no square is drawn. Scene fact `board: empty, the shape is named not drawn` added.
- r2: how-many-ways stuck 2/5 said "drag two triangles" = the key. Guidance: never say the number "even as how many pieces to try"; add pieces one at a time.
- r3 (`-r3.json`): 0 key leaks; 2/10 `no_fix_before_try` on how-many-ways stuck ("Drag one triangle onto the board, then add another") — the one-at-a-time strategy the guidance asks for. Left.

Later (lever pass): the palette pieces cannot build the named shapes exactly, so guidance and miss words now ask the
learner to picture the small shapes fitting inside, not to build it on the board, and forbid saying how the shape
splits (see `qa/eval-reports/shape-composer-levers-2026-10-09.md`).

Only start moments run on the three drag modes (the sweep cannot drive them), so their miss/stuck replies are unread.

## Undriven modes
compose-match, compose-picture, free-create (drag only). Guidance for them is written but unreplayed beyond start.

## Open findings
1. **how-many-ways draws no target** (`/eval-fix` or `/add-support-tiers`): the learner is asked how many pieces build a shape that is not on the board.
2. **Generator, decompose** (`/eval-fix`): all 6 saved items are "2 triangles" or "2 squares"; templates give no variety.
3. **Generator, compose-picture** (`/eval-fix`): instructions name each shape and its place ("a big square for the base and a triangle on top for the roof").
4. **Harness, drag input** (shared): the dry sweep has no drag; 3 of 5 modes are J1-baselined.
5. Needs a browser check on every drag mode on the workspace path (JSDOM only).
