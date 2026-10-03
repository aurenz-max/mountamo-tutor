# Contract: di-shapes

- **Derived:** 2026-10-03 (static: QA reports, tests, git history; no live census) · evidence window: 2026-08-07 → 2026-10-03
- **Component:** `primitives/visual-primitives/direct-instruction/DiShapes.tsx` (stage: `DiTeachingStage.tsx`) · **Domain:** `diShapesWorkspace.ts`, `diShapesLevers.ts`, `diShapesMenu.ts`, `diShapesGeometry.ts`, `diShapesScript.ts` · **Generator:** `service/direct-instruction/gemini-di-shapes.ts` · **Catalog:** `service/manifest/catalog/di.ts` (`id: 'di-shapes'`)
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K name 2D shapes regardless of orientation/size (GEOM001-01-A): name_shape, shape_review | catalog + QA | `/curriculum-fit` 2026-08-07; payloads `w1-payloads/di-shapes.name_shape.json`, `.shape_review.json` | 2026-10-03 |
| K-1 shapes in the world: find_real_object | catalog | payload `.find_real_object.json` (saved 2026-10-03) | 2026-10-03 |
| G1 count sides and vertices (GEOM001-01-b): count_sides, count_corners | catalog + QA | payloads `.count_sides.json`, `.count_corners.json` | 2026-10-03 |
| Live tutor + JEV on the shared workspace | tutor reports | rollout B3; `sweep-inventory-2026-09-29.json` | 2026-10-03 |
| Support levers (DI family 3) | `/add-support-tiers` | `qa/support-levers/di-shapes-lever-table-2026-10-03.md`, replay `qa/tutor-reports/replay/di-shapes-*-2026-10-03.json` | 2026-10-03 |

## Requirements

### R1 — One defensible name per drawing · OBSERVED
- **Property:** rectangles ≥1.6:1, ovals clearly non-circular, rotation within each shape's cap; the point count equals the corner count.
- **Probe:** `diShapesGeometry.test.ts`.

### R2 — Nothing on screen or in the packet gives the answer before a try · OBSERVED
- **Property:** the stage draws the shape only; a counting item never names the shape; the reward label renders only after credit; a missed item recaps unlabeled.
- **Probe:** `DiShapes.support-tier-context.test.tsx`, workspace sweep J3.

### R3 — Tier shapes the drawing, not the mode · OBSERVED
- **Property:** exemplar, rotation band and scale move with the tier; the answer and the mode never do.
- **Probe:** `gemini-di-shapes.test.ts`.

### R4 — DI's model is a different shape · OBSERVED (user ruling 2026-10-02)
- **Property:** `model_shape` / `model_object` / `model_count` show a DIFFERENT item of the mode, solved. `shapeLeaks` holds false: never the item's shape, its look-alike either way round (`NEAR_SHAPE`), or a shape sharing an accepted name (rhombus/diamond). Never a shape (or object) of a session item still to come. A counting model's count is more than one from the item's and is no count a later item asks; the model is never counted aloud and no shape is named on a counting item.
- **Probe:** `diShapesLevers.test.ts`.

### R5 — Naming gets no help on the child's own shape · OBSERVED
- **Property:** naming is recognition: no ticks, dots or tap targets on the child's drawing in name_shape, shape_review or find_real_object.
- **Probe:** `DiShapes.levers.workspace.test.tsx` (easy name_shape case).

### R6 — Counting help never counts for the child · OBSERVED
- **Property:** `start_mark` draws one dot; `touch_marks` marks only what the child taps (no numeral, no order); the scene fact gives no count of marks. Marks sit inside the shape's rotate/scale transform.
- **Probe:** `DiShapes.levers.workspace.test.tsx` (count_sides, count_corners).

### R7 — Simplify keeps the mode · OBSERVED
- **Property:** `plain_drawing` (naming, only when the item is a variant, turned past its gentle band, or shrunk) builds a different prototype upright full-size shape; `fewer_sides` (counting, 4-6 sides) builds a triangle or a square; both have id `<item>~simpler`, are ungraded, and return to the full item. find_real_object has no simplify (a bare outline is name_shape).
- **Probe:** `diShapesLevers.test.ts`; `DiShapes.levers.workspace.test.tsx` (plain_drawing case).

### R8 — A starting position is not a pull · OBSERVED
- **Property:** easy, or no tier, starts with the mode's model on screen and records no lever; the `support` scene fact says where levers start.
- **Probe:** `DiShapes.levers.workspace.test.tsx`; `DiShapes.support-tier-context.test.tsx`.

### R9 — Every named miss is answered · OBSERVED
- **Property:** `described_shape` (a description, no name) is named on the naming modes and answered by the model; every catalog miss has a lever.
- **Probe:** `diShapesLevers.test.ts`; `journeySweep.test.tsx` J9 on all five payloads.

### R10 — The tutor never describes a shape it is asking the child to name · OBSERVED
- **Property:** guidance forbids describing sides, corners or roundness and offering a choice of names on a naming item; when stuck with the model already on screen, it re-voices the model.
- **Evidence:** replay 2026-10-03, find_real_object stuck: 5/5 "four equal sides… triangle or square?" before the rule, 0/5 after.
- **Probe:** `tutor_replay.py --primitive di-shapes --samples 5`.

## Conflicts

None open.

## Catalog projection

- **description / guidance:** faithful as of 2026-10-03 (any model is a different shape; `levers: true`).
- **evalModes:** faithful. The scripted `tutoring` block is unused on the bound path (`tutoring: null`).

## Changelog

- 2026-10-03: derived (initial, static) with the DI lever slice. 10 requirements, 0 conflicts.
