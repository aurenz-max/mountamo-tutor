# molecule-constructor — workspace binding + `make_molecule` open build (OB-3S), 2026-10-07

Built in an agent worktree from e8e0191d, merged into the main tree with `tools/merge_wt.py` and re-gated there.

## Was `build` already open? No

`build` names a target (`build_target` against `targetAtoms`), so one molecule passes; `free_build` passes any build
with one bond and checks no valence. Both unchanged. `make_molecule` is the new open mode.

## Step 1: binding (W1, minimal)

- `MoleculeConstructorSurface` behind `withWorkspaceController` (`useWorkspaceProgressFor('molecule-constructor')`);
  local `challengeIndex` replaced by `progress.currentIndex`. Every check commits through `progress.commitCheck` with
  a work description and a named miss.
- Workspace path: no 2 s auto-advance, `useLuminaAI({ enabled: !tutorOwned })`, input closed while `canAttempt` is
  false, evaluation submitted from `onFinished`, Try again keeps the atoms. Scripted path unchanged. Instance id is
  now stable (was `Date.now()` per render).
- Harness hooks: palette `aria-label="Add X"`, input labels, `data-pip-object` on atoms, a transparent hit circle so
  a `<g>` gets taps.
- `moleculeConstructorWorkspace.ts` (misses `atoms_off`, `open_valence`, `name_off`, `formula_off`, `no_bonds`; an
  identify/formula key never reaches the tutor), adapter `moleculeConstructorLive.ts`, rows in `activityContract.ts`,
  `liveJourneySpec.ts`, `lessonWorkspacePlan.test.ts`. Catalog `teachingWorkspace`: grades 3-8, `levers: true`.

## Step 2: `make_molecule` (β −0.4, `answers: ['build']`)

- **Task.** "Make a molecule with a double bond [and exactly 2 carbon atoms / an oxygen atom / ...]." Empty board.
- **Judge** (`moleculeBuild.ts`, pure, at "I'm done!"): one piece, every atom's bonds = valence (H1 C4 N3 O2 S2 Cl1),
  every asked property holds. One miss, most basic first: `not_connected`, `too_many_bonds` (guard),
  `bond_order_short`, `open_valence`, `no_triple_bond`, `no_double_bond`, `carbon_count_off`, `element_missing`,
  `too_many_atoms`. Verdict names no atom or molecule; a pass shows the learner's formula.
- **Board** (`MoleculeBuildScene.tsx`, kit): tap element to add, tap two atoms to bond (again = double, triple),
  tap a bond to step it down; past-valence bonds refused with a note naming no atom. The `<svg>` holds only atoms
  and bonds; hit areas, selection ring and lever marks are `data-aid`. No formula, count or target before the check.
- **Scene facts:** `atomsPlaced`, `bondsMade`, `doubleBonds`, `tripleBonds`, `openBonds`, `pieces`
  (tested: `openBonds 0 → 11 → 1 → 2 → 0`).
- **Levers** (bare): `open_bonds` (hollow dot per unmade bond), `bond_tally` ("2 of 4"), `piece_colors` (tint per
  separate piece), `fewer_atoms` (simplify: the menu's smaller ask, ungraded). `too_many_bonds` is `unanswered`.
- **Generator.** Code picks every ask from a 12-entry menu with proof molecules for the ask and its practice ask;
  sessions distinct, open with the plain double-bond ask, easy tier single-property only. The model writes only
  title/description (digits or molecule names replaced). Pinned-only; the model's enum never offers it.
- **Watcher.** `numbers: 'never'`, `neverSay` molecule names plus "open/lonely/spare/parallel". Shared change:
  `twins?` added to the build-watcher number filter ("twin white bridges" counted bond order).
- Oracle `molecule-constructor` registered; backend prior; payloads `molecule-constructor.{build,make_molecule}.json`.

Size: ~1,300 production lines (component +409/−86), 340 test lines, 146 probe lines.

## Gates

| Gate | Result |
|---|---|
| `moleculeBuild.test.ts` / `MoleculeConstructor.workspace.test.tsx` | 9/9, 11/11 |
| vitest (worktree): live-activity, catalog/manifest, oracles, pip, chemistry | 156 files, 3870 pass, 0 fail |
| vitest (main tree after merge): biology, chemistry, oracles, build-layer, live-activity | 94 files, 1 failure = peer's in-progress `cvc-speller.make_word` payload |
| `typecheck:lumina` | 0 (main tree after merge) |
| full tsc | 770 = baseline (worktree) |
| journey sweep | 0 findings on both payloads, 4/4 misses named; all 395 payloads pass vs baseline |
| real generator + oracle | 5 lessons (G4, G5 easy, G7, G8, classic build): 0 violations; ≥2 passing molecules per ask by random search; menu molecule minus one H misses `open_valence` |
| real watcher | 20 flash-lite lines on real scene markup: 16 kept, 4 dropped; no number, element, molecule name or pointer at a short atom |

Artifacts here: `generations.json`, `journey-sweep.json`, `watcher-lines.json`. Probes:
`scripts/molecule-constructor-make-probe.mjs`, `molecule-constructor-watch-probe.mjs`.

## Not verified

- No browser drive: tap feel, atom hit radius ~41 px at 360 px (just under 44), narrow bond tap lines, the refused-
  bond note, lever marks, phone width; bonds between far slots may pass near another atom.
- No Live run or tutor replay; rides the family's class Live gate.
- Classic identify, formula_write, predict ran in jsdom only (no payload).

## Rulings owed

1. β −0.4 (closed `build` + 0.1) may be low for grade 6-8 asks (triple bond, two carbons).
2. The generator ignores `targetEvalMode` for classic modes (always mixes), so each classic mode lists all classic
   misses. Pin classic modes in the generator?
3. **Existing defect, queue for `/eval-fix`:** on identify and formula_write, the classic "Target Molecule" panel
   shows the target's name and formula when `showName` is on — the answer is on screen.
4. `levers: true` adds lever doctrine to all four modes; only make_molecule has levers (same question as array-grid).
5. The palette shows valence ("makes 4 bonds"). Move behind a lever for older bands?
6. Unpinned sessions never contain make_molecule.
