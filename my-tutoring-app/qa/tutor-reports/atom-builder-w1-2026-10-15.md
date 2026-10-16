# atom-builder W1 binding (ROLLOUT C26), 2026-10-15

**Shape P, four modes, all bound.** The component kept its own index and a 2 s auto-advance; it now runs on
`useScriptedProgress` / `useWorkspaceProgressFor('atom-builder')` through `withWorkspaceController`. Not committed.
Levers: `../eval-reports/atom-builder-levers-2026-10-15.md`.

## Files
- New: `chemistry/atomBuilderWorkspace.ts` (assignment, scene, `atomMiss`, `describeAtom`, harness inputs),
  `chemistry/atomBuilderLevers.ts`, `adapters/atomBuilderLive.ts`, `chemistry/AtomBuilder.workspace.test.tsx`,
  `w1-payloads/atom-builder.{build,identify,make_atom,ion_isotope}.json`, `replay/atom-builder-*-2026-10-15*.json`.
- Edited: `AtomBuilder.tsx` (Surface + controller, levers drawn, tray buttons named "Add proton" etc.), `atomBuild.ts`
  (element table moved here from the component, `USUAL_MASS`, a practice-only `neutral` ask), `AtomBuilder.build.test.tsx`
  (finds the tray buttons by their new names), `activityContract.ts`, catalog `chemistry.ts` (`teachingWorkspace`),
  `liveJourneySpec.ts`, `lessonWorkspacePlan.test.ts`.

## What is checked by code
Classic items (build_element, identify, fill_shells, make_ion, make_isotope): the three particle counts against the
item's targets, misses `protons_off`, `neutrons_off`, `electrons_off` in that order. make_atom: `judgeAtomBuild`, its
eleven misses. The tutor gets the learner's own counts and the name the identity card shows; never a target count or a
passing atom. The identify item's question ("what element is it?") is not checked: the check reads the build. The
guidance says so.

## Pedagogy leaks fixed (both paths)
- A wrong classic check printed "Need 8 neutrons (you have 6)" and then the generated hint ("carbon-14 has 8
  neutrons"). On make_isotope and the "discover neon" items, whose instruction states no neutron count, that was the
  answer. A wrong check now shows only which count is off ("The number of neutrons is not right for this atom.").
- Workspace path only: the auto-advance timer and the scripted cues are off; the tray, Keep, Start over, Clear and the
  check are shut while a checked answer waits for Try again.

## Gates
- `typecheck:lumina`: 0 in my files (the one error is `MixingAndDissolving.workspace.test.tsx`, another session's).
  Full tsc 771 = 770 + that same error; 0 in an atom-builder file.
- `AtomBuilder.workspace.test.tsx` 24, `AtomBuilder.build.test.tsx` 3, `atomBuild.test.ts`, ScienceWorkspaces surface;
  live-activity + `misses.test.ts`: 40 files, 4081 passed.
- Sweep on the four payloads: 0 findings J1-J14, misses named 5/5, 5/5, 5/5, 4/4, J10 score 100, J11 score 67; lever
  inventory 0 gaps. J14: no item has a sayable answer (every build is several tray presses).

## Replay (5 samples x 4 modes, text)
| run | start | miss | stuck | lever | credit |
|---|---|---|---|---|---|
| first guidance (`replay/atom-builder-2026-10-15.json`) | 0/20 | 0/20 | 0/20 | 2/20 | 0/20 |
| guidance names no button, "never which particle" (`-r2`) | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 |

Read by hand: run 1's two misses were "press Check Answer" (the shared protocol pattern; the guidance named the
button). Run 1 also passed the checks while stating the fix: "Use the minus button to take away that extra electron"
(about 6 of 40 stuck and lever replies). Run 2: no reply says which particle to add or remove; stuck and lever replies
describe the pairs and ask what they show. Some first-miss replies pull `pair_up` themselves and describe it in the
same turn.

## Undriven modes
None. Payloads are grade 7 only (6-8 band); the 3-5 band is covered by the workspace test fixtures, not a payload.
The replay records only each payload's first item (all make_atom replies were on the valence ask).

## Open findings
- The three classic modes are not pinned: build, identify and ion_isotope payloads hold the same five-type mix, and at
  grades 3-5 every classic mode gets build_element and fill_shells only. `/add-eval-modes`.
- Generated instructions state every count the check reads ("Add 10 protons ... 10 neutrons and 10 electrons") on 3 of
  5 build items, so those items test copying; others check a count they never state (neutrons on "discover neon").
  fill_shells checks nothing beyond the counts (the shells always fill in order). `/eval-fix`.
- FIXED 10-15 (orchestrator, both paths): the identity card named the element live as protons were added, so "Build
  neon" was solvable by adding protons until the card read Neon. On `build_element`, `identify` and `find_on_table`
  items the card now says "The name shows once your atom is checked." until the item is credited, and the scene and
  `learnerWork` drop the name too; ion, isotope, shell and open-build items still name it (the element is given).
  Tests: two cases in `AtomBuilder.workspace.test.tsx`, 29/29.
- Browser check needed on the workspace path: tray lock after a check, the keyed periodic table's width, the pair row.
