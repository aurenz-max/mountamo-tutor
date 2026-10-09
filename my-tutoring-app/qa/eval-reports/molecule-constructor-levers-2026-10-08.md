# molecule-constructor levers: `build` mode (2026-10-08)

Class sweep (user waived the Phase 2 confirm). Scope: the `build` eval mode. `make_molecule` already had levers. `identify` and `predict` are still without levers and are not covered here.

## Failure inventory

`build` is not pinned in the generator, so a build session holds `build_target` items (build the named formula) and `free_build` items (join any atoms). It can also hold typed items (`identify`, `formula_write`).

| Item type | Failure | Miss id | Evidence class |
|---|---|---|---|
| build_target | an atom too few or too many (misreads the subscripts) | `atoms_off` | observed-synthetic (journey wrong answer: one atom short); documented (catalog struggle "confuses molecular formula with atom count") |
| build_target | right atoms, bonds still open (a single bond where a double is needed) | `open_valence` | documented (catalog struggles "correct atoms but wrong number of bonds" and "does not understand double or triple bonds") |
| free_build | places atoms but never joins them | `no_bonds` | documented (catalog struggle 1); observed-synthetic (journey wrong answer, now two unjoined atoms) |
| identify / formula_write | wrong name or formula | `name_off`, `formula_off` | belongs to the identify mode, not built here |

There is no real-learner evidence. The demonstration logs, tutor reports and misconception reports hold nothing for this primitive, and there is no remediation module or DI script.

## Lever table

| Item type | Failure | Lever | Kind | Carrier | Leak rule | Existed before? |
|---|---|---|---|---|---|---|
| build_target | `atoms_off` | `atom_tally`: under the asked formula, one circle per atom it names. Each placed atom fills one; an atom past the count, or of an element the formula does not name, is ringed red. | help | shown | The tally shows only counts the screen already states. It is not declared when the formula is not on screen (neither in the instruction nor in the Target panel), or when the atom list the check reads disagrees with that formula (`atomTallyLeaks`). | no |
| build_target | `open_valence` | `bond_tally`: "made of makes" under each atom on the canvas, where a double bond counts as two | help | shown (digits) | Counts only the learner's own bonds and never draws or names a bond to add. The pull is refused when the canvas is empty. | no; the valence dots exist only as a generation option |
| build_target | `atoms_off`, `open_valence` | `fewer_atoms`: a smaller molecule from `SIMPLE_TARGETS`, ungraded, on an empty canvas | simplify | shown | The smaller molecule has fewer atoms, no higher bond than the item, and only elements in the palette. It is never the item's own formula or another session item's. Its bonding is solvable (`specForAtoms`). | no |
| free_build | `no_bonds` | `join_rings`: a green ring on every atom that can still make a bond | help | shown | Rings only the learner's own atoms. The pull is refused when fewer than two atoms can still bond. | no; a glow appeared only on the atom picked for joining |

No lever was built for these:
- free_build gets no simplify lever, because it already asks for a single bond.
- build `name_off` and `formula_off` are added to the catalog's `unanswered.build`, because their levers belong to the identify mode.
- There is no tier start position. The generator's `showOptions` are the starting presentation, the same as for make_molecule.

## What was built

- `moleculeConstructorLevers.ts` (extended):
  - pure functions `formulaCounts`, `atomTallyLeaks`, `atomTally`, `simplerTarget` (with `SIMPLE_TARGETS`) and `classicRefusal`
  - `moleculeLevers` and `leverFacts` now cover build_target and free_build
  - `simplerMolecule(c, ctx)` sends build_target to `simplerTarget`
- `MoleculeConstructor.tsx`:
  - levers are published for every type that declares them
  - a classic pull is refused when there is nothing to draw
  - draws the tally panel, the bond counts and the join rings
  - a practice item's correct answer adds no count and no unlock
- `moleculeConstructorWorkspace.ts`: the journey's free_build wrong answer is now two unjoined hydrogens instead of an empty canvas, so the documented miss is driven and the pull is not refused.
- `liveJourneySpec.ts` (molecule row only): rebuilds the `~simpler` item from its parent using the session's challenges and palette.
- Catalog `chemistry.ts` (molecule entry only): `unanswered.build`, and the comment.
- Not done: no contract doc exists for this primitive (`docs/contracts/molecule-constructor.md`), and none was written.

## Verification

- `moleculeConstructorLevers.test.ts`: 47 pass. Covers:
  - the tally's leak rule and counts
  - the simpler-target builder over 17 formulas × 2 palettes: fewer atoms, palette only, bonds no higher, solvable, never the source item, never another item in the session
  - `nextLever` for each miss
  - refusals
  - lever and fact text: no molecule name and no digit
- `MoleculeConstructor.levers.workspace.test.tsx` (mounted through workspaceHarness): 4 pass. Shows that:
  - a pull changes the screen and `onScreen` in one commit
  - the next attempt records the lever and is assisted
  - a refused pull changes neither the scene nor the screen
  - the simplify pull opens `c~simpler`, keeps its atoms on Try again, is ungraded, and the full item comes back blank and is credited
  - free_build rings
- The existing chemistry, oracle/generator, ScienceWorkspaces surface and lessonWorkspacePlan tests: 12 files, 232 pass. One assertion in `MoleculeConstructor.workspace.test.tsx` was updated: it had expected build_target to have no levers.
- A dry journey filtered to `molecule-constructor` (`-t molecule-constructor`, not the full sweep) passed for build and make_molecule with no new findings, J9 included.
- `npm run typecheck:lumina`: 0.
- Not run: tutor replay, Live.

---

# `identify` and `predict` modes (2026-10-09)

Same class sweep (Phase 2 confirm waived). `identify` = challengeTypes identify (name the molecule) + formula_write (write its formula). `predict` = predict_bonds + shape_predict. The generator does not pin classic modes, so either session can hold any classic type; build_target/free_build items keep the levers above.

## Evidence fixed first (Phase 1 step 4)

The identify mode could not be measured as it stood (MC-1 / MOLC-1, now resolved):
- an identify item drew **nothing** to identify (empty canvas); the only on-screen cue was the Target panel, which showed the name and formula (the answer) whenever `showName` was on, the generator's default;
- placeholders read "e.g., Water" / "e.g., H2O";
- formula_write showed its formula in the same panel.

Fix: code draws the molecule on identify/formula_write items (`drawnMolecule` → `layoutMolecule`: multi-bond atoms in a row, one-bond atoms beside the atom they join, from `specForAtoms`); the Target panel, formula panel, atom counts, palette, gallery and Clear All are hidden on those items; placeholders are neutral; the generator replaces an instruction or hint that contains the key. The scene gains `board: "a molecule drawn on the canvas..."`, with no name or formula.

## Failure inventory

| Item type | Failure | Miss id | Evidence class |
|---|---|---|---|
| formula_write | miscounts atoms / misreads what the small number counts | `formula_off` | documented (catalog struggle "confuses molecular formula with atom count"); observed-synthetic (journey wrong answer "X9") |
| identify | cannot name the drawn molecule | `name_off` | observed-synthetic (journey wrong answer); inferred (recall from structure) |
| predict_bonds, shape_predict | any one-bond build passes; no prediction is checked | `no_bonds` only | inferred from code: the check is `atoms > 0 && bonds > 0` |

No real-learner evidence. No demonstrations, tutor reports, misconception reports, remediation module or DI script exist for this primitive.

## Lever table

| Item | Failure | Lever | Kind | Carrier | Leak rule (code) |
|---|---|---|---|---|---|
| identify | `name_off` | `show_formula`: the drawn molecule's formula beside it | help | shown (symbols) | Only declared when the item's formula agrees with the drawn atoms (`showFormulaLeaks`); never the name |
| identify | `name_off` | `fewer_atoms`: a smaller molecule to name, ungraded | simplify | shown | `simplerTyped`: fewer atoms, never a session item's molecule (canonical counts), drawable, no "... gas" names (the exact-match check would reject "hydrogen") |
| formula_write | `formula_off` | `formula_model`: a *different* small molecule drawn with its formula under it | help | shown | `formulaModelLeaks`: the model is never the item's or any session item's molecule; it has 2+ elements and a subscript |
| formula_write | `formula_off` | `fewer_atoms`: a smaller molecule to write, ungraded | simplify | shown | as identify's |
| predict_bonds, shape_predict | `no_bonds` | **no lever** | | | The item checks no prediction, so there is no miss a lever could teach to. `unanswered.predict: ['no_bonds']`; queued as MC-2 (/add-eval-modes) |

Per-item coverage: on the smallest items (a 2-atom identify, e.g. HCl; formula_write H2) there is no simplify lever, but the help lever remains (tested). No tier start positions: the drawn molecule is the item.

Lever text and facts state what is drawn ("Beside the drawn molecule is its formula", "a different molecule, drawn with its formula written under it"); none names a molecule, a formula or a count.

## What was built

- `moleculeConstructorLevers.ts`: `layoutMolecule`, `drawnMolecule`, `isTypedItem`, `showFormulaLeaks`, `formulaModel`/`formulaModelLeaks`, `simplerTyped`; `moleculeLevers`, `leverFacts` and `simplerMolecule` cover identify/formula_write.
- `MoleculeConstructor.tsx`: canvas renders `canvasAtoms/canvasBonds` (drawn on typed items, read-only); typed items hide answer-bearing panels; `show-formula` and `formula-model` lever panels (`MoleculePicture`).
- `moleculeConstructorWorkspace.ts`: typed-item `board` fact.
- `gemini-molecule-constructor.ts`: key-stating instruction/hint replaced on typed items.
- Catalog (molecule entry only): `unanswered.predict`, comments. `unanswered.build` keeps `name_off`/`formula_off`: those items now have levers, but the saved build payload holds no typed item, so J9 cannot see them answered there.
- Journey row unchanged: it already rebuilds `~simpler` through `simplerMolecule`, which now covers typed items.
- EVAL_TRACKER: MC-1, MOLC-1 resolved; MC-2 added.

Size: about 190 production lines, about 190 test lines.

## Verification

- `moleculeConstructorLevers.test.ts`: 125 pass. Covers the layout over 17 formulas (every atom drawn, in canvas, at least 44 px apart), both leak rules, the model over 17 formulas, simplerTyped over 17 × 2 types, `nextLever` per miss, smallest-item coverage, and lever and fact text.
- `MoleculeConstructor.levers.workspace.test.tsx`: 6 pass (2 new, mounted with `showName: true`). Covers:
  - identify: the molecule is drawn and nothing names it; `name_off`; pulling `show_formula` changes the panel and `onScreen` in one commit; a refused second pull leaves the DOM, scene, levers and attempts unchanged; the next attempt is assisted with the lever recorded.
  - formula_write: `formula_off`; the model draws; `fewer_atoms` opens `e~simpler` (CH4 drawn), which stays ungraded across a retry; the full item comes back with a blank input and is credited with both levers recorded.
- `gemini-molecule-constructor.typed-items.test.ts` (new, mocked Gemini): 1 pass.
- Chemistry dir, ScienceWorkspaces surface, chemistry service, oracles and lessonWorkspacePlan: 47 files, 988 pass. One assertion in `MoleculeConstructor.workspace.test.tsx` was updated: it had expected identify items to have no levers.
- `npm run typecheck:lumina`: 0.
- Not run: journey sweep and tutor replay (left to the batch verify step), Live, and a browser check of the drawn molecule and the lever panels at phone width. The browser check is needed.
