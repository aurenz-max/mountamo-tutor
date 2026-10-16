# cell-builder W1 binding (ROLLOUT C24), 2026-10-15

**Shape P, four modes, all bound.** The component had no `useChallengeProgress`; each mission (eval mode) is now one
challenge on `useScriptedProgress` / `useWorkspaceProgressFor('cell-builder')`. A pin is one board; a blend runs its
missions in canonical order. Not committed.

## What is checked by code
Every board is checked by `cellMiss` / `boardScore` (`cellBuilderWorkspace.ts`) against the generated key when every card
has an answer and the learner presses Check mission. Misses: inventory `kept_impostor`, `rejected_needed`,
`kept_and_rejected`; placement `cytoplasm_distributed_swap`, `core_network_swap`, `one_misplaced`, `several_misplaced`;
jobs `two_swapped`, `several_wrong`; abundance `too_little`, `too_much`, `both_ways`. The tutor gets the cell, the
structures on the board, the regions / job cards / levels, and the learner's work; never `belongsInCell`, a region, a
pairing or an abundance key. The scripted path (tester, no tutor) keeps its lock, reveals, Next mission and Run cell report.

## Pedagogy leaks fixed (both paths)
- Stock the cell listed the needed structures first (generator order): cards are now alphabetical.
- Stock the cell printed "Cell wall: ..." and the membrane line under the board: hidden on that board.
- Analogies on Stock the cell may name a kind of cell ("solar panels of a plant"): those words are blanked.
- Build the model: a "Cytoplasm" card went into the "Cytoplasm" region (2 of 2 placement payloads); a structure named
  after its own region is left off the board and out of the score. "Central storage" renamed "Main storage" (it matched
  "Large Central Vacuole").
- Wire the jobs: a job card word built on a structure's name is blanked.
- Workspace path only: a wrong check marked every card right/wrong and printed the corrections, which Try again would
  turn into copying. A wrong board now shows only the count; marks and reveals show after a right check.

## Gates
- typecheck:lumina 0. Full tsc 770 (baseline 770), no error in a cell-builder file.
- `CellBuilder.workspace.test.tsx` 23, `__tests__/CellBuilder.test.tsx` 4 (one re-based to alphabetical cards, one to
  "Main storage"). live-activity + biology + `misses.test.ts` + ScienceWorkspaces surface: 66 files, 4373 passed.
- Payloads: `w1-payloads/cell-builder.<mode>.json` for all four modes (grade 4-5 leaf cell).
- Sweep on the four payloads: 0 findings J1-J14, misses named 4/4, J10 score 100, J11 score 67.

## Replay (5 samples x 4 modes, text)
| run | start | miss | stuck | lever | credit |
|---|---|---|---|---|---|
| first guidance (`replay/cell-builder-2026-10-15.json`) | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 |
| + "never use the biology to point at a card" (`-r2`) | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 |
| + "or point at one by what it does" (`-r3`) | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 |

Read by hand: run 1 passed the checks but pointed at the wrong card in other words: "take another look at the jobs
for the nucleus and the mitochondria, and try swapping" (jobs, 3/5 miss + stuck), "where the nucleus best fits"
(placement), "what a plant cell needs to store water and stay upright" (abundance, 2/5), and "see which one doesn't
belong" (inventory, a count the tutor is not told). Run 2 fixed naming; the abundance miss still pointed by job
("what keeps a plant cell upright and powered", 3/5). Run 3: no reply points at a card; misses ask about the cell's
job or the region notes; every stuck reply pulls the mode's help lever.

## Undriven modes
None.

## Open findings
- Generated description sometimes states the rule ("leaving out the animal cell parts"); a hint, not a key. `/eval-fix`.
- The inventory payload had 1 distractor where the grade 4-5 prompt asks 2-3. `/eval-fix` (generator count check).
- Payloads are grade 4-5 only; 6-8 boards (ER, Golgi) are covered by the workspace test, not a payload.
- Browser check on the workspace path: tap-to-place on Build the model, lever lines under the bay cards.
