# di-shapes levers: DI family 3 (2026-10-03)

`/add-support-tiers`, plan `qa/support-levers/di-lever-plan-2026-10-03.md` step 1. Table and failure inventory: `qa/support-levers/di-shapes-lever-table-2026-10-03.md`. No real-learner evidence. Every failure is synthetic (the spoken-miss ids) or documented (catalog `commonStruggles`).

## What was built

| Mode | Help | Simplify |
|---|---|---|
| name_shape, shape_review | `model_shape` | `plain_drawing` (only on a variant, turned past its gentle band, or shrunk) |
| find_real_object | `model_object` (a different object beside the outline of its shape) | none: a bare outline is name_shape |
| count_sides, count_corners | `model_count` (a different polygon, a tick on each side or a dot on each corner), `start_mark`, `touch_marks` | `fewer_sides` (4-5 → triangle, 6 → square; none on a triangle) |

- **New capability:** tappable sides and corners. Each side is a `<line>` and each corner a `<circle>` inside the shape's own rotate/scale transform, with a wide transparent hit stroke; a tapped one turns amber. No numeral, no order.
- **New miss:** `described_shape` (a description, no name) on the three naming modes, answered by the model.
- **Pure menu:** `SHAPE_MENU` moved from the generator to `diShapesMenu.ts`, so the runtime levers read the same table. The generator re-exports it.
- **Session-aware levers:** the lever object is built in a `useMemo` over the session's items. A model never shows a shape, object or count that a later item asks.
- **Scene fact:** the bare `supportTier` fact became a `support` sentence saying where levers start (the di-math-facts pattern).
- **Catalog:** `levers: true`; the guidance points at the model lever.

**Size:** 201 lines of lever module, 35 of menu, and about 140 lines of component, workspace and catalog changes, against 261 lines of new tests.

## Measured

| Gate | Result |
|---|---|
| Unit (`diShapesLevers.test.ts`, 30) | leak table; every drawable shape on a naming mode has a non-leaking model alone and before every other core shape; every polygon has a counting model more than one away; every real object has a model; every saved item has a model and its fact never says the answer; builders keep the mode and never repeat the item; miss → lever; every catalog miss is answered |
| Mounted (`DiShapes.levers.workspace.test.tsx`, 5) | start dot, then tapped sides marked with no number; corner model and corner tap targets; easy start is not a pull and naming has no in-item marks; `plain_drawing` is ungraded and returns to the full shape; refused pulls change nothing |
| Dry journey J1-J9 | 5/5 payloads clean (three of them new: shape_review, find_real_object, count_corners) |
| typecheck | lumina 0 |
| Text replay (Flash, 5 payloads × 5) | first run 5 flags, all one class (below); after the fix 0 flags. After a miss on counting the tutor pulls `touch_marks`; the start dot is narrated after its receipt |

**Found and fixed in the slice:** on find_real_object, "I'm stuck" with the model already on screen (easy) and no other lever left the tutor nothing to pull, and it described the item instead: "four straight sides that are all the same length. Is it a triangle or a square?" (5/5). The guidance now forbids describing the shape or offering a choice of names on a naming item, and says to re-voice the model when stuck. Replay 5/25 → 0/25.

## Not covered

- **Naming modes have no in-item help by design**, and find_real_object no simplify; a stuck child there gets the model only.
- Not browser-checked (HUMAN-CHECKS #183, shapes row: tap target size after a shape is shrunk). No Live run: the DI class gate waits for all 37 DI modes.

## Next

DI family 4, di-letter-sounds (plan step 2).
