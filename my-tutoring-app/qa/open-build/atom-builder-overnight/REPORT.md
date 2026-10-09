# atom-builder `make_atom` (open build): report, 2026-10-08 (overnight)

On an empty board the learner makes any atom that has the property the ask states. Code judges the atom at "I'm done!". The mode is new and sits beside `build` and `ion_isotope`, which are unchanged. It is not bound to the teaching workspace. It runs in the tester and in my test runs, but it has not been driven in a real browser yet.

**Is it a real build?** Yes. The existing `build` mode names one element, so it has one answer. `make_atom` asks for a property, and many atoms have it:
- **Full outer shell:** He, Ne, Ar (and Kr in grades 6-8).
- **N outer electrons:** at least 2 elements for every N from 1 to 7 (for 7: F, Cl, and Br in 6-8).
- **Charge:** for each of -2, -1, +1 and +2, more than 10 elements can make it.
- **Isotopes:** all 36 elements, at any two neutron counts that hold together.

The vitest checks these counts by listing every atom the board can hold.

## What changed

**Judge (`chemistry/atomBuild.ts`, new, 164 lines).** Plain code with no React; the generator, the component and the tests all use it.
- **Four asks:**
  - N electrons in the outer shell
  - a full outer shell
  - a charge of ±1 or ±2
  - two isotopes of the same element
- **Eleven misses:** `no_protons`, `nucleus_off`, `not_neutral`, `shell_not_full`, `valence_off`, `still_neutral`, `charge_sign`, `charge_size`, `need_two`, `different_element`, `same_neutrons`. Each has its own words. The words say what is wrong and never which particle to add or remove; `same_neutrons` says "they are the same isotope" and does not say "isotopes differ in neutrons".
- **Real electron shells for this mode.** I used real Bohr shells (2,8,8,1 for K, 2,8,14,2 for Fe, 2,8,18,7 for Br, with Cr and Cu as exceptions) instead of the component's 2/8/8/18 model. The classic modes draw that model, and under it bromine shows 17 outer electrons, so a correct "7 outer electrons" bromine would fail. The classic modes still draw their own model.
- **Neutron rule.** The nucleus must "hold together": hydrogen may have 0 to 2 neutrons; any other element needs from p-1 up to 1.5p+2. This is a tolerance band, not a table of real isotopes; a learner is not expected to know which isotopes exist.

**Component (`AtomBuilder.tsx`).**
- **Scene:** a make_atom item draws a new single-svg board (`data-build-scene="atom"`) holding only the learner's atom. For an isotope pair, the kept atom sits in the top-left corner. The empty-board prompt is marked `data-aid`.
- **Hidden on this mode,** because each one reads the asked property off for the learner:
  - the Charge, Mass # and Valence e- readouts
  - the electron configuration
  - the shell capacity labels ("8/8")
  - the element's category badge and category colour (a "Noble Gas" badge or purple nucleus gives away the full-shell ask)
- **Still shown:** the element name and symbol, the particle counts, and the mini periodic table.
- **Buttons:**
  - "I'm done!" is disabled while the board is empty.
  - "Start over" clears the atom and the kept atom.
  - "Keep this atom" appears on the isotopes ask; the current atom stays on the board after Keep, so the learner can change it.
  - After a miss, the build stays on the board (Try again keeps it) and the miss words stay until the next check.
- **Watcher:** `useBuildWatcher` with `numbers: 'never'`. The task is described without the property, and a `neverSay` list blocks words like full, ion, charge, neutral, isotope, noble, valence and outer. The `made` facts name the learner's own element. The watcher line shows under the scene and turns off while solved or submitted.
- **Old payloads:** a make_atom item with no `ask` falls back to the classic Check Answer path.

**Generator (`gemini-atom-builder.ts`).**
- A pinned `make_atom` session goes to `buildMakeAtomData` and makes no model call. Code writes every ask and every instruction, and no targets are set.
- Asks are distinct within a session.
  - Grades 3-5 get three asks, all for neutral atoms: N outer electrons, full shell, a different N. This matches the generator's existing rule that grades 3-5 get no ions or isotopes.
  - Grades 6-8 get four asks: N outer electrons, full shell, a charge, isotopes.
- I added `CHALLENGE_TYPE_DOCS` (make_atom only) and `resolveEvalModeConstraint`.
- `make_atom` is not in the model's schema enum, so an unpinned session can never produce it. The unpinned and classic paths are unchanged.

**Registry.**
- Catalog mode `make_atom` with `answers: ['build']`, β 1.0. It sits between `identify` (0.5) and `ion_isotope` (2.0), because its asks draw on both.
- Backend `PROBLEM_TYPE_REGISTRY["atom-builder"]["make_atom"] = PriorConfig(1.0, ...)`.
- No catalog misses (the mode is not bound) and no oracle (atom-builder has none).

**Chemistry tester.** Added a general "Eval mode" select (`#chem-eval-mode`), listing the catalog's modes for the selected primitive plus Mixed. The default is Mixed, which sends `config: {}` as before. The drive needs this select to pin `make_atom`.

## Gates
- **vitest, judge** (`atomBuild.test.ts`, 11 tests):
  - full shell: Ne passes and Ar is a second, different pass; F gives `shell_not_full`; an ion gives `not_neutral`; Ne with 0 neutrons gives `nucleus_off`
  - 7 outer electrons: Cl and Br pass; one under (S) and one over (Ar) give `valence_off`
  - charge -1: F- and Cl- pass; too many electrons gives `charge_size`, Na+ gives `charge_sign`, neutral gives `still_neutral`
  - isotopes: C-12 then C-13 passes, and O-16 then O-18; a single atom gives `need_two`, the same nucleus twice gives `same_neutrons`, C and N give `different_element`
  - shells, the neutron rule, asks distinct and grades 3-5 neutral-only, at least 2 elements pass every ask, and pinned generation makes no model call
- **vitest, component flow** (`AtomBuilder.build.test.tsx`, 3 tests):
  - the board opens empty with no property readouts
  - F gives `shell_not_full` and the build is kept; F with one more electron gives `not_neutral`, and the words stay while the learner edits; Ne passes, and "I'm done!" turns off after a pass
  - the next item opens empty
  - isotopes: `need_two`, then Keep draws the kept atom, then `same_neutrons`, then `different_element`, then a pass
  - Start over clears the kept atom
  - an older payload with no ask keeps Check Answer
- **Wider vitest:** chemistry folder, the manifest catalog tests, evalMode, chemistry services and the ScienceWorkspaces surface test: 19 files, 341 tests, all passing.
- **`typecheck:lumina`:** 0 errors. The known peer error at `liveJourneySpec.ts:2313` did not show up in this tree.
- **Full tsc:** 770 errors, which matches the roadmap baseline. None are in files I touched.
- **Real generator run** (`scripts/atom-builder-make-atom-probe.mjs --run`): 19 of 19 clean.
  - 18 pinned sessions, grades 3-8, 3 each, every ask checked against the judge (routing, asks distinct, grades 3-5 neutral-only, instruction written by code, no targets, at least 2 elements pass, readouts off).
  - 1 unpinned grade-7 session on flash-lite came back as build_element, identify, fill_shells, make_ion, make_isotope, with no make_atom.
  - Saved to `qa/open-build/atom-builder-overnight/generation.json`.
- **Not needed:** live-activity suite and journey sweep (the mode is not bound).

## Not done
- **Browser drive not run** (no dev server allowed). The drive script is written and syntax-checked. Watcher lines have not been recorded yet, and phone width has not been checked yet; the drive does both. **Owed: a browser check of the make_atom flow** in the Chemistry tester.
- **Legacy tutor can see the answer properties.** atom-builder is not on the teaching workspace. The old `useLuminaAI` tutor block still receives charge, valenceElectrons and shellsCorrect on make_atom items, so the scripted tutor could state the property the learner is building toward. Binding the primitive (`/add-live-tutor-tools`) and adding levers is the next step.
- **Peer files copied from the main tree** so the worktree typechecks against the in-flight OB-3S molecule-constructor work. These are identical to the main tree and carry none of my changes: `buildLayer.ts`, `buildLayer.test.tsx`, `gemini-build-watch.ts`, `MoleculeConstructor.tsx`, the three `moleculeConstructor*` files and their three tests, `moleculeConstructorLive.ts`, and the base versions of `catalog/chemistry.ts` and `problem_type_registry.py`.
- **Pre-existing defect, not fixed:** the catalog's `challengeTypes` for `build`, `identify` and `ion_isotope` (`'build'`, `'make-ion'`, `'fill-shells'`) do not match the generator's type names (`build_element`, `make_ion`, `fill_shells`), and the classic path ignores `targetEvalMode`. So pinning a classic mode currently gives the model's own mix. This needs queuing for `/eval-fix`.
- **Scoring:** the score counts every item completed, and an item only advances once it is right, so a finished session always scores 100. Recording a first-try score for this mode needs the workspace path.
- **Ruling owed:** the "nucleus holds together" band rejects a neutron-free neon. That is a new requirement compared with the classic modes, which each want an exact neutron count. Keep the band, or ignore neutrons on the property asks?

## Worktree
`C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-6`. It was fast-forwarded to `af7df5b8`. The node_modules junction is removed and the shared install is intact. Nothing is committed.

## Changed files (mine)
- `my-tutoring-app/src/components/lumina/primitives/visual-primitives/chemistry/atomBuild.ts` (new)
- `my-tutoring-app/src/components/lumina/primitives/visual-primitives/chemistry/atomBuild.test.ts` (new)
- `my-tutoring-app/src/components/lumina/primitives/visual-primitives/chemistry/AtomBuilder.build.test.tsx` (new)
- `my-tutoring-app/src/components/lumina/primitives/visual-primitives/chemistry/AtomBuilder.tsx`
- `my-tutoring-app/src/components/lumina/service/chemistry/gemini-atom-builder.ts`
- `my-tutoring-app/src/components/lumina/service/manifest/catalog/chemistry.ts` (one line on top of the main-tree version)
- `backend/app/services/calibration/problem_type_registry.py` (one line on top of the main-tree version)
- `my-tutoring-app/src/components/lumina/components/ChemistryPrimitivesTester.tsx`
- `my-tutoring-app/scripts/atom-builder-make-atom-probe.mjs` (new)
- `my-tutoring-app/qa/open-build/atom-builder-overnight/drive.mjs` (new)
- `my-tutoring-app/qa/open-build/atom-builder-overnight/generation.json` (new, probe output)

The main-tree copies listed under Not done are also in the worktree, unchanged.

## Drive command
The script needs `next dev` on :3000 serving the merged tree, and playwright-core installed in a scratch folder. It writes screenshots and `drive.json` to `C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/atom-builder-overnight/`.
```
cd <scratch folder with playwright-core@1.52.0 installed> && node "C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/atom-builder-overnight/drive.mjs"
```

## Browser drive (coordinator, after merge into the main tree, 2026-10-09)
**28/29**. The one fail is the pre-existing svg `rx/r undefined` console errors seen on every tester page. Watcher 4/4 clean; card fits 360 px.
