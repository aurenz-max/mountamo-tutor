# Draw a shape from its name (Grade 2)

*Kind: new-mode · Curriculum design review math-g2-2026-10-28 · written 2026-10-28*

## Curriculum (published, verbatim)
- **GEOM002-01-b** (GEOM002-01 Shapes by Attributes): Draw various polygons on a digital canvas based on prompts that describe their required number of sides and corners. Focus: Translating geometric attribute descriptions into accurate shape drawings. Examples: draw a triangle, draw a rectangle, draw a pentagon, draw a hexagon, draw a square, draw a quadrilateral, draw an octagon, draw a trapezoid. Constraints: Ensure snapping tools are available to assist with line segment precision; allow only closed shapes.

## Learning goal and gap
Grade 2 students draw shapes with given attributes and named shapes: "draw a pentagon", "draw a quadrilateral", "draw an octagon" (2.G.A.1). `shape-builder` `make_shape` already does the hard part well: an empty dot grid, any closed simple shape that fits passes, and code judges sides, square corners and equal sides. The probe drew "Make a shape with 5 sides", "3 sides", "4 sides", "4 sides and exactly 4 square corners".

Gaps: asks are always properties, never a name, so the child never turns "hexagon" into 6 sides; K-2 asks stop at 6 sides; trapezoid and parallel-side asks exist only at Grades 3-5.

The curriculum target `shape-tracer` `draw_from_description` is not the right base: it scores the corner count only, accepts three dots in a line and crossed shapes, and requires regular pentagons and hexagons.

Recommendation: extend `make_shape` with Grade 2 asks by name.

## Essential behavior
- Asks by name: triangle, quadrilateral, pentagon, hexagon, octagon; square, rectangle, trapezoid.
- Any shape that fits the name passes (an irregular hexagon is a hexagon).
- Some asks combine both ("a quadrilateral with no square corners").
- No picture of the target shape.

## Worked example
"Draw an octagon." The child connects 8 dots into a closed shape with 8 sides. An irregular one passes.
Misconceptions: drawing a hexagon for "octagon" (name confusion); drawing a shape with an extra collinear point (counts as 8 dots, 7 sides).

## Evidence of success
- Independent: a correct shape for a fresh name, first try.
- Record name-to-count errors apart from drawing errors (open shape, crossed sides).

## Constraints and open questions
- Observation: `MAX_CORNERS = 8` in shapeMakeBuild.ts, so octagons may already fit the grid.
- Open: whether "trapezoid" means exactly one pair of parallel sides or at least one; pick one and keep it consistent with any later grade.
- Queue separately: shape-tracer draw_from_description scoring defects.

**Handoff.** Inspect current repository guidance (CLAUDE.md, the owning primitive contract in `docs/contracts/` if present, and the relevant `/add-*` or `/primitive` skill) before designing. Schema, architecture, mode naming, generator approach and build order are yours to choose. Deliver the working capability with the verification those skills require, and recheck the observations below against the code first: they describe the code on 2026-10-28 (commit 253eecabde). Most were read in source, not reproduced: Gemini generation was blocked by a spend cap during this review.
