# cell-builder — support levers, 2026-10-15

Built on the W1 binding (`qa/tutor-reports/cell-builder-w1-2026-10-15.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception or remediation files for cell-builder; the 08-18 eval report
is a content pass). Documented = the contract (cytoplasm vs distributed, requirement 5) and the generator's distractor
pairings; synthetic = the journey's scripted wrong boards; the rest inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| cell_inventory | keeps another cell type's structure (`kept_impostor`), rejects a needed one (`rejected_needed`), both | documented, synthetic |
| organelle_placement | one structure vs many copies (`cytoplasm_distributed_swap`) | documented, synthetic |
| organelle_placement | nucleus vs the network around it (`core_network_swap`), `one_misplaced`, `several_misplaced` | inferred, synthetic |
| structure_function | two jobs swapped (`two_swapped`), `several_wrong` | inferred, synthetic |
| cell_specialization | under- or over-invests for the cell's job (`too_little`, `too_much`, `both_ways`); reads the levels as counts | inferred, synthetic |

## Lever table (built, `cellBuilderLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| cell_inventory | structure_jobs | help | every miss | each card's job line with kind-of-cell words blanked (plant, animal, bacteria, the lesson's own cell words): `namesCellKind` |
| organelle_placement | structure_jobs | help | every miss | each bay card's job line with region words blanked (control, center, storage, cytoplasm, throughout, membrane, nucleus...): `namesRegion` |
| structure_function | structure_hints | help | every miss | each structure's analogy with every word it shares with its own job card blanked: `sharesJobWords` |
| cell_specialization | level_meanings | help | every miss | a fixed legend (Few: fewer than a typical cell has ... Abundant: far more); names no structure |
| all | fewer_structures | simplify | every miss | same mission on about half the structures (min 2, by name; Stock keeps an impostor), own id `<mode>~fewer`, ungraded; never shrinks twice; the full board comes back cleared |

A lever is offered only when at least half the cards have a sayable line after blanking. Starting position: no tier
code; every board starts bare (the generator reads no `config.difficulty`).

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- `CellBuilder.workspace.test.tsx`: miss rules per mode, leak rules over the fixture, the smaller-board builder per mode,
  `nextLever` help-then-simplify for every catalog miss, each help lever changes the screen and the scene fact in one
  commit, a repeat pull is refused, the next attempt carries the lever; the smaller board is ungraded and the full board
  is credited with `fewer_structures` recorded.
- Sweep lever inventory: every catalog miss answered on every mode, 0 gaps (J9, J12, J13 pass).
- Replay `-r3`: every stuck reply pulls the mode's help lever itself and describes it after the call; 0 misses.

## Failures with no lever
- None by miss. The smaller board is part of the lesson's own cell (no other cell exists at runtime), so its answers
  carry into the full board; the full board's credit is recorded as assisted with the lever.

## Open
- Browser check on the lever lines (bay cards on Build the model now stack a second line).
