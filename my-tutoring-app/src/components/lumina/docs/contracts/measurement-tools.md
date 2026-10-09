# Contract: measurement-tools

- **Derived:** 2026-10-09 (W1 workspace binding; no earlier contract)
- **Component:** `primitives/visual-primitives/math/MeasurementTools.tsx` · **Domain:** `measurementToolsWorkspace.ts` ·
  **Generator:** `service/math/gemini-measurement-tools.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`measurement-tools`)
- **Modes:** `measure` · `compare` · `estimate` · `convert` (2.MD.A.1, 2.MD.A.3, 4.MD.A.1)

## Requirements

### R1 — the length is read, never printed · OBSERVED
- **Property:** a shape's width is code-owned and never rendered before a correct check; the shape snaps onto the ruler
  with its left edge at 0 and the learner reads the right edge. The scene facts carry no width, converted length or order.
- **Probe:** `MeasurementTools.workspace.test.tsx` (no digit in the facts before a try, every mode).

### R2 — compare's order is not the layout · OBSERVED (NEW 2026-10-09)
- **Property:** the generator presents the shapes shuffled, never shortest first (ids follow the presented order), and
  the ordering buttons (`orderChoices`) move the first shape last if a session still arrives sorted. Before 10-09 the
  session was sorted, so tapping the buttons top to bottom was the answer.
- **Probe:** workspace test (a sorted session is not listed in order).

### R3 — the hard tier withholds the conversion rule · OBSERVED (NEW 2026-10-09)
- **Property:** with `showConversionFactor: false` neither the convert prompt, the wrong-answer card nor the scene states
  1 inch = 2.54 cm or multiply/divide (the wrong-answer card used to state both).
- **Probe:** workspace test (hard tier).

### R4 — shared teaching workspace (W1, plain shape) · OBSERVED (NEW 2026-10-09)
- **Property:** under a live runtime the tutor owns every mode. Items: one per shape, plus `order-shapes` after the
  shapes on compare. `workspaceAssignment` gives a gesture task, no `expectedAnswer`. Each check commits through
  `progress.commitCheck` with `measurementMiss` (`one_over`, `one_short`, `whole_not_half` (estimate), `too_long`,
  `too_short`; convert: `same_number`, `wrong_operation`, `too_small`, `too_large`; order: `longest_first`,
  `two_swapped`, `out_of_order`). A right measurement on convert opens the conversion and commits nothing. Try again
  clears the checked answer and keeps the shape on the ruler and a checked measurement. "Put it on the ruler" is the
  drag's tap twin; the lengths are typed (or stepped). Auto-advance is off, input is closed while a checked answer
  waits, the legacy AI hook is off.
- **Probe:** `MeasurementTools.workspace.test.tsx`; journey sweep on `w1-payloads/measurement-tools.*.json`; tutor replay
  `qa/tutor-reports/replay/measurement-tools-2026-10-09-r4.json`.

### R5 — in-item levers, every mode · OBSERVED (NEW 2026-10-09)
- **Property:** `measurementToolsLevers.ts` declares levers per item, all drawn (`carrier: shown`), none writing a
  number. Reading (every mode's shapes): `space_shading` (every other unit space tinted along the whole ruler, never
  stopping at the shape), `edge_line` (dashed line from the shape's right edge; refused until the shape is on the
  ruler), `half_marks` (estimate: half ticks taller and brighter, no label), `shorter_shape` (practice: a shorter
  practice rectangle; 1.5 on estimate; none on a 1-2 unit item). Convert's second step: `inch_model` (a one-inch bar
  over a centimeter scale, words only), `smaller_length` (practice: one inch, or five centimeters; none on a cm item
  of 5 or less). Ordering: `order_steps` (wordless growing bars), `own_lengths` (each button shows the length the
  learner measured and had checked), `three_shapes` (practice: three practice shapes 6/10/2, listed out of order; only
  when the session has more than three shapes or two within one unit). Leak rules in code (`leverTextLeaks`,
  `practiceLeaks`). Practice items are `<id>~simpler`, ungraded; Try again keeps them; the full item comes back blank.
  The tier's ruler labels, method text and conversion hint stay the starting positions; no new tier code.
- **Probe:** `measurementToolsLevers.test.ts`, `MeasurementTools.levers.workspace.test.tsx`, journey sweep J9/J12/J13.

## Gaps

### G1 — an exact-offset miss gives the key away · OPEN (2026-10-09)
- **Shortfall:** `one_over` with the learner's answer is the length (8 and one over is 7). The packet carries the miss,
  so the tutor can derive the key; estimate's directional misses did exactly that in replay (r2/r3: "past the 2, on the
  half"), and were merged into `whole_not_half`. The same holds for every family with off-by-one misses.
- **Path:** a ruling on whether a miss's direction reaches the tutor → `/add-live-tutor-tools` (shared packet).

## Changelog

- 2026-10-09 — R5 levers on every mode (`/add-support-tiers`).

- 2026-10-09 — derived with the W1 binding. Generator shuffles the shapes (R2); hard-tier wrong card no longer names
  the rule (R3); convert's 1.2 s delay before the conversion step removed; "Put it on the ruler" button and typed
  length boxes added.
