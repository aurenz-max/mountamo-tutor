# Contract: measurement-tools

- **Derived:** 2026-10-09 (W1 workspace binding; no earlier contract)
- **Component:** `primitives/visual-primitives/math/MeasurementTools.tsx` · **Domain:** `measurementToolsWorkspace.ts` ·
  **Boss:** `measurementTools.card.ts` + `measurementTools.boss.ts` (lever set `measurementToolsLevers.ts`) ·
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
  shapes on compare. `measurementTask` is the ask; the boss's `bossAssignment` gives a gesture task, no `expectedAnswer`. Each check commits through
  `progress.commitCheck` with `measurementMiss` (`one_over`, `one_short`, `whole_not_half` (estimate), `too_long`,
  `too_short`; convert: `same_number`, `wrong_operation`, `too_small`, `too_large`; order: `longest_first`,
  `two_swapped`, `out_of_order`). A right measurement on convert opens the conversion and commits nothing. Try again
  clears the checked answer and keeps the shape on the ruler and a checked measurement. "Put it on the ruler" is the
  drag's tap twin; the lengths are typed (or stepped). Input is closed while a checked answer waits; the
  component is workspace-only (`withWorkspaceOnly`), with no scripted path.
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

### R6 — the tier picks the widths where width changes the work (code tier targets) · OBSERVED (2026-10-14)
- measure, hard: odd widths first (the hard ruler labels only even wholes, so each lands on an unlabeled mark). compare: easy widths at least 2 apart, hard a consecutive run, medium a plain draw. estimate and convert unchanged; no tier keeps the plain draw. Widths stay in the mode's pool and the scope cap. Probe: `gemini-measurement-tools.tier-widths.test.ts`, `scripts/difficulty-lab/tier-probe.mjs --component measurement-tools`.
- convert's units come from the lesson (ruling 10-15, closed 10-16 as QUEUE 8.1d): within one system, feet to inches (x12) or meters to centimeters (x100) when the lesson is metric, checked exact to a half; inches and centimeters (2.54, checked within 10%) only from grade 6 or when the objective asks between systems. `convertUnitsFor` in the generator; the unit table (`conversionRule`, `convertValue`, `crossSystem`) in `measurementToolsWorkspace.ts`. R3 now withholds whichever rule the session uses. `inch_model` is offered on inch/centimeter sessions only. Probe: `gemini-measurement-tools.convert-units.test.ts`.

### G1 — an exact-offset miss gives the key away · OPEN (2026-10-09)
- **Shortfall:** `one_over` with the learner's answer is the length (8 and one over is 7). The packet carries the miss,
  so the tutor can derive the key; estimate's directional misses did exactly that in replay (r2/r3: "past the 2, on the
  half"), and were merged into `whole_not_half`. The same holds for every family with off-by-one misses.
- **Path:** a ruling on whether a miss's direction reaches the tutor → `/add-live-tutor-tools` (shared packet).

## Changelog

- 2026-10-16 — convert within one system for grades 4-5 (feet/inches, meters/centimeters); inches/centimeters only for grade 6 or a between-systems objective. Units `feet` and `meters` added. Compatible: R1-R5 hold for every pair; `inch_model` narrowed to its own pair.

- 2026-10-09 — R5 levers on every mode (`/add-support-tiers`).

- 2026-10-09 — derived with the W1 binding. Generator shuffles the shapes (R2); hard-tier wrong card no longer names
  the rule (R3); convert's 1.2 s delay before the conversion step removed; "Put it on the ruler" button and typed
  length boxes added.
- 2026-10-14 — R6 added (item-space slice). Before, every tier drew widths at random from one pool. Compatible: R1-R5 untouched.
- 2026-10-20 — moved onto a boss (wave 3): card + boss replace `adapters/measurementToolsLive.ts`, the catalog
  `tutoring` block and guidance prose; levers declared once as `MEASUREMENT_LEVERS`; `edge_line` is offered only once the
  shape is on the ruler (was a pull-time refusal); the scripted path and its "Need a Hint?" button are gone. R1-R6 hold.
