# Contract: area-model

- **Derived:** 2026-10-09 (W1 workspace binding; no earlier contract)
- **Component:** `primitives/visual-primitives/math/AreaModel.tsx` · **Domain:** `areaModelWorkspace.ts` ·
  **Evidence:** `areaModelEvidence.ts` · **Generator:** `service/math/gemini-area-model.ts` ·
  **Remediation:** `service/math/areaModelRemediation.ts` · **Oracle:** `service/qa/oracles/area-model.ts` ·
  **Catalog:** `service/manifest/catalog/math.ts` (`area-model`)
- **Modes:** `build_model` · `find_area` · `multiply` (forward: cells, then the sum) · `perimeter` · `factor`

## Requirements

### R1 — numbers are code-owned; the tier changes scaffolding only · OBSERVED
- **Property:** the generator picks every factor pair locally; `config.difficulty` sets only `showCellEquations`,
  `showPerimeterExpansion` and `highlightCell`. Forward modes always print the column and row parts; factor mode
  always prints every cell product and leaves the parts blank.
- **Probe:** `gemini-area-model.adaptation.test.ts`, oracle `area-model`.

### R2 — every checked entry is evidence for the misconception loop · OBSERVED
- **Property:** each checked entry (cell, sum, perimeter, parts), right or wrong, is recorded as it happened
  (`AreaModelResponse`) and submitted through `areaModelDiagnosisEvidence`; a wrong entry carries its `areaMiss`.
  The `learningAdaptation` moves (`contrast_same_fact_across_places`, `contrast_equal_area_perimeters`) read it.
- **Probe:** `AreaModel.capture.test.tsx`, `areaModelEvidence.test.ts`, `areaModelObservationServer.test.ts`.

### R3 — shared teaching workspace (W1, plain shape) · OBSERVED (NEW 2026-10-09)
- **Property:** under a live runtime the tutor owns every mode. `workspaceAssignmentFor(mode)` gives the task in
  words (the model, the rectangle's sides, or the total area), gesture response, no `expectedAnswer`. A right cell is
  kept and is not a commit; a wrong cell, the sum, the perimeter and the parts commit through `progress.commitCheck`
  with `areaMiss` (cell: `added_not_multiplied`, `dropped_zeros`, `extra_zeros`, `one_group_off`, `wrong_product`;
  sum: `left_out_part`, `carry_slip`, `sum_off`; perimeter: `gave_area`, `two_sides_only`, `three_sides`,
  `perimeter_off`; parts: `swapped`, `one_part_wrong`, `parts_wrong`). Try again clears only the wrong entry: right
  cells and right parts stay. Factor accepts any parts that make every cell (`partsFit`). The scene names only what
  is printed. Next and the attempt counters are hidden, input is closed while a checked answer waits, the legacy AI
  hook is off. The scored session submits from `onFinished` with R2's evidence and the session's first-response score.
- **Probe:** `AreaModel.workspace.test.tsx`; journey sweep on `w1-payloads/area-model.*.json` (23/23 misses named);
  tutor replay `qa/tutor-reports/replay/area-model-2026-10-09-r2.json`.

### R4 — in-item levers, every mode · OBSERVED (NEW 2026-10-09)
- **Property:** `areaModelLevers.ts` declares levers per item, all drawn (`carrier: shown`); the tier's own aids count
  as pulled (`showCellEquations`, `showPerimeterExpansion`, `highlightCell`), so `config.difficulty` is the starting
  position. Forward: `cell_labels`, `tens_split` (a tens cell's parts as a one-digit fact and its tens, "3 × 4 × 10 ×
  10"; `textLeaks` drops any line naming an unprinted product, total or perimeter), `cell_dots` (cells with both parts
  10 or less as rows of dots), `stack_products` (the learner's right products in one column, no total; refused until
  every cell is right), `easier_model`. Perimeter: `all_sides`, `side_sum`, `smaller_rectangle`. Factor: `start_cell`,
  `shared_parts` (each column and row outlined in its blank part's colour), `easier_grid`. Simplify builds an
  ungraded `~easier` item of the same shape and mode with digits 1 to 3 (sides 5 or less), never the item, and nothing
  it asks or prints is one of the item's answers (`practiceLeaks`); it records nothing and is not evidence (R2).
- **Probe:** `areaModelLevers.test.ts` (leak rules per mode, builder over generated and saved items, miss → lever,
  J12 coverage); `AreaModel.levers.workspace.test.tsx`; journey sweep J9/J12/J13 on the saved payloads.
