# area-model levers, 2026-10-09

`/add-support-tiers` on the W1 binding of the same day (`qa/tutor-reports/area-model-w1-2026-10-09.md`).

## Failure inventory

No real-learner evidence (`logs/demonstrations` has no area-model entry; `qa/misconception/` none). The misses are
what `areaMiss` observes.

| Mode | Failure (miss) | Class |
|---|---|---|
| forward | wrong partial product (`wrong_product`, `one_group_off`) | documented (catalog commonStruggles) |
| forward | place-value slip in a tens cell (`dropped_zeros`, `extra_zeros`) | documented (commonStruggles, remediation move `contrast_same_fact_across_places`), synthetic (sweep) |
| forward | the two parts added (`added_not_multiplied`) | inferred |
| forward | a cell left out of the sum, a carry slip (`left_out_part`, `carry_slip`, `sum_off`) | documented ("forgetting to add partial products"), synthetic |
| perimeter | two sides only, three sides (`two_sides_only`, `three_sides`) | documented (remediation module), synthetic |
| perimeter | the area for the perimeter (`gave_area`) | documented (remediation move `contrast_equal_area_perimeters`) |
| factor | rows and columns swapped (`swapped`) | synthetic |
| factor | a wrong part (`one_part_wrong`, `parts_wrong`) | inferred |

## Lever table

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| forward | `cell_labels`: each cell shows its column part × row part (tier aid; pulled at easy/medium) | help | added, one group off, wrong product | no product |
| forward | `tens_split`: under each tens cell, "3 × 4 × 10 × 10" | help | dropped/extra zeros, wrong product | `textLeaks`: no unprinted product, total or perimeter |
| forward | `cell_dots`: cells with both parts ≤ 10 as rows of dots | help | one group off, added, wrong product | no number drawn |
| forward | `stack_products`: the right products in one column by place, no total | help | left out, carry slip, sum off | refused before every cell is right; no total |
| forward | `easier_model`: same shape, digits 1 to 3 | simplify | every cell and sum miss | `practiceLeaks`: shares no answer with the item |
| perimeter | `all_sides`: bottom and right sides labelled | help | two sides, three sides, area | no total |
| perimeter | `side_sum`: L + W + L + W written out (tier aid; pulled at easy/medium) | help | every perimeter miss | no total |
| perimeter | `smaller_rectangle`: sides ≤ 5 | simplify | every perimeter miss | no shared perimeter |
| factor | `start_cell`: top-left cell highlighted (tier aid at easy) | help | wrong parts | no number |
| factor | `shared_parts`: each column and row outlined in its blank part's colour | help | every factor miss | no number |
| factor | `easier_grid`: same shape, digits 1 to 3 | simplify | every factor miss | no shared part, and no printed cell is a part of the item |

Every catalog miss is answered by a lever on every saved payload item and on every generated item, at both tiers
(`areaModelLevers.test.ts`, J9/J12). No miss is unanswered. Starting positions: the generator's existing tier
(`showCellEquations`, `showPerimeterExpansion`, `highlightCell`) is read as levers already pulled; no generator change.

## Built

`areaModelLevers.ts` (declarations, leak rules, builders), `AreaModel.tsx` (lever state keyed by item, practice item,
`pullLever`/`endPractice`, scene `onScreen` and `practice` facts, the five drawings), catalog `levers: true`, journey
row rebuilds `~easier` items. Production for both phases: levers module 219 lines, workspace module 192, adapter 24,
component +304/−69; tests 517 lines (two workspace tests, the levers unit test).

## Gates

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| `areaModelLevers.test.ts` | 25/25 |
| `AreaModel.levers.workspace.test.tsx` + `AreaModel.workspace.test.tsx` | 16/16 |
| `workspaceContract`, `misses`, `activityContract`, `lessonWorkspacePlan`, capture, surface, evidence | 2413 pass |
| journey sweep `-t area-model`, 5 payloads, J1-J13 | 0 findings; 23/23 misses named; every mode `levers`, no open miss |

## Tutor replay (5 × 5, gemini-3.8-flash)

r3 (`replay/area-model-2026-10-09-r3.json`): 9 `no_fix_before_try` misses, all perimeter: after `all_sides` the tutor
says "try adding all four sides together". Guidance: after a lever, say where to look and ask; do not tell them to
add the four sides or count the zeros. r4 (`-r4.json`): 2 misses, both still perimeter "add the four sides". Other
modes ask ("How many tens are being multiplied together?").

## Open findings

- **Narration before the receipt (class, not this primitive):** in r4, 13 of 25 `stuck` replies that pull a lever
  describe it as already on screen ("The screen now outlines each row and column", "Now all four sides are
  labelled"). `replay_checks.CHANGE_DONE` does not match these forms, so `no_change_before_receipt` reads 0/25.
  Executor: `/add-live-tutor-tools` (shared check + doctrine), one check over every lever family.
- One r4 perimeter `stuck` reply pulled `smaller_rectangle` and `all_sides` in one turn.
- Perimeter "add all four sides" remains in 2/50 replies after the guidance fix; it states the definition rather than
  an amount. Left as is (one guidance fix per gate).
- build_model `stuck`: "What do 14 tens make?" computes 7 × 2 for the learner. Not the key; close to it.
- Needs a browser check on the lever drawings (dots, splits, coloured outlines, the stack), none seen outside jsdom.
