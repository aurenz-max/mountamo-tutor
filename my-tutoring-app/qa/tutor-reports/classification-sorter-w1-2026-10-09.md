# classification-sorter W1 binding (ROLLOUT C14), 2026-10-09

**Shape P, one mode.** The catalog had no eval modes, so a graded binding had nothing to mount. The existing task was
registered as one mode, `sort` (β 2.5 = the backend's `default` prior, which stays for earlier sessions;
`/add-eval-modes` single-mode wiring: the generator logs the pin and keeps it out of the data).

## What is checked by code
Each item is one challenge, staged alone at every band on the workspace path; tapping a group card is the answer,
checked by `sortMatches` (`classificationSorterWorkspace.ts`). Misses (`sortMiss`): `repeated_group`, `parent_group`,
`sibling_group`, `wrong_group`. The tutor gets the rule, the group names, the card and the credited cards; never the
card's group. The scripted path (tester, no tutor) keeps its drag, Submit and cues.

## Gates
- typecheck:lumina: 0 errors in my files (2-43 errors over the run, all in sibling files mid-edit: life-cycle-sequencer, light-shadow-lab, letter-workshop, story-map). Full tsc 772 (baseline 770 at 047ee634; no error in a classification file).
- Tests: `ClassificationSorter.workspace.test.tsx` 5, reader-fit 11, ScienceWorkspaces surface, generator reader-fit: 57/57.
  `workspaceContract`, `misses.test.ts`, `lessonWorkspacePlan`, `activityContract`: pass.
- Sweep on `classification-sorter.sort` (K-2, 8 items): 0 findings J1-J12, misses named 8/8, J10 score 100, J11 score 67.

## Replay (5 samples, text)
| run | start | miss | stuck | credit |
|---|---|---|---|---|
| first guidance (`-2026-10-09.json`) | 0/5 | 0/5 | 0/5 | 0/5 |
| guidance + "saying whether the card's thing has the feature is the answer" (`-r2`) | 0/5 | 0/5 | 0/5 | 0/5 |

Read by hand: run 1 passed the checks but 2/5 stuck replies told the answer in other words ("Birds use their wings to
fly"). One guidance sentence fixed it; run 2's stuck replies ask ("What does a robin use to fly?").

## Undriven modes
None.

## Open findings
- The payload is K-2 only; a 3-5 or 6-8 sort (and the hierarchical misses) is covered by the workspace test, not a payload.
- Needs a browser check on the workspace path at 3-8 (tap cards in place of drag).
