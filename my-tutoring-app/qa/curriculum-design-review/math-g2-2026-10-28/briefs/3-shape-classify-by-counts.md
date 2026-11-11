# Name shapes by counting sides and corners, including irregular shapes

*Kind: repair · Curriculum design review math-g2-2026-10-28 · written 2026-10-28*

## Curriculum (published, verbatim)
- **GEOM002-01-a** (GEOM002-01 Shapes by Attributes): Identify common two-dimensional shapes by analyzing their specific number of sides and angles through interactive sorting. Focus: Recognizing defining attributes like sides and vertices in polygons. Examples: triangle, quadrilateral, pentagon, hexagon, octagon, trapezoid, rhombus, parallelogram. Constraints: Start with regular polygons and progress to irregular polygons; require identification based on explicit attribute counts.

## Learning goal and gap
Grade 2 students recognise and name triangles, quadrilaterals, pentagons, hexagons and octagons by counting sides and corners, whatever the shape looks like (2.G.A.1). The curriculum adds trapezoid, rhombus and parallelogram, and asks to move from regular to irregular shapes.

The two candidates fall short:
- `shape-sorter` `count` asks the child to say a side or corner count, but it is K-1, requires a microphone, draws pentagons and hexagons regular only, and has no octagon, trapezoid, parallelogram or quadrilateral.
- `shape-builder` `classify` sorts shapes into Triangles / Quadrilaterals / Pentagons & More by side count and can show irregular shapes. But each shape carries its model-written name as a label ("Pentagon"), which names the bin. And the key is the model's own label unless it is missing; a wrong label is kept even when the corners disagree (gemini-shape-builder.ts:775-778).

Recommendation: repair `classify` so code draws the shapes and computes the key from the corners, with no name on the shape; extend its range to 8 sides. A new primitive is not needed; the sort is the right action.

## Essential behavior
- Shapes are drawn by code, regular first and then irregular (a concave pentagon still has 5 sides).
- The child decides by counting; the screen does not name the shape.
- Bins or names cover triangle, quadrilateral, pentagon, hexagon, octagon at Grade 2.
- Suggestion: a second step names special quadrilaterals (square, rectangle, rhombus, trapezoid) by their sides and corners.

## Worked example
An irregular 5-sided shape with one corner pointing in. Good: "Pentagon, it has 5 sides and 5 corners."
Misconceptions: "not a pentagon, it doesn't look like one" (shape matched to a picture, not a count); counting a corner twice when the shape is rotated.

## Evidence of success
- Independent: correct name or bin for fresh irregular shapes, first try.
- Regular shapes alone are not enough; they can be recognised by look.
- Wrong bin on irregular but right on regular is the main gap to record.

## Constraints and open questions
- Observation to recheck: shape-builder has no contract file; derive one before editing classify.
- Open: whether the special quadrilaterals belong here or in a separate step.

**Handoff.** Inspect current repository guidance (CLAUDE.md, the owning primitive contract in `docs/contracts/` if present, and the relevant `/add-*` or `/primitive` skill) before designing. Schema, architecture, mode naming, generator approach and build order are yours to choose. Deliver the working capability with the verification those skills require, and recheck the observations below against the code first: they describe the code on 2026-10-28 (commit 253eecabde). Most were read in source, not reproduced: Gemini generation was blocked by a spend cap during this review.
