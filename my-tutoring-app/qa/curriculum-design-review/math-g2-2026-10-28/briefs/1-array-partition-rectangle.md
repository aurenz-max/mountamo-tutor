# Cut a rectangle into rows and columns of equal squares

*Kind: new-mode · Curriculum design review math-g2-2026-10-28 · written 2026-10-28*

## Curriculum (published, verbatim)
- **GEOM002-02-a** (GEOM002-02 Partition Rectangles): Divide a given rectangle into a specific grid of equal-sized squares to build an understanding of area as an array. Focus: Partitioning rectangles into rows and columns. Examples: 2 by 3 grid, 3 by 4 grid, 4 by 4 grid, 2 by 5 grid, 3 by 5 grid, 5 by 5 grid, 2 by 6 grid, 4 by 3 grid. Constraints: Use a grid-snapping feature to ensure all created squares are of uniform size.

## Learning goal and gap
Grade 2 students partition a rectangle into rows and columns of same-size squares and count them (2.G.A.2), the first step toward area as an array. No Lumina mode asks the child to cut a given rectangle. `array-grid` has four modes, and each starts from an empty grid (`make_array`, `build_array`) or a finished array (`count_array`, `multiply_array`). `polygon-area-builder` and `area-model` are Grade 3 and later. Nothing else in the catalog partitions a rectangle (searched for "partition", "2.G.A.2", "unit square").

Recommendation: a mode on `array-grid`. It already has the rows-by-columns model, Grade 2 caps, row-strip and label levers and a teaching workspace. The implementing session may decide a separate primitive is cleaner after reading the code.

## Essential behavior
- The child starts with a rectangle outline and an ask: "Cut this into 3 rows and 4 columns of equal squares."
- The child places the cuts. Cuts snap so squares come out equal (the curriculum asks for grid snapping).
- After cutting, the child says or enters how many squares there are.
- Suggestion: later items give the rows and the total ("3 rows, 12 squares") and the child finds the columns.
- Squares should read as one covered rectangle, not separate icons. Today's cells are star icons with gaps.

## Worked example
"Cut the rectangle into 2 rows and 6 columns." The child draws one cut across and five cuts down and gets 12 equal squares.
Misconceptions: drawing 6 cuts for 6 columns (7 columns); swapping rows and columns (6 rows of 2); unequal spacing when cuts are free.

## Evidence of success
- Independent: correct rows and columns on a fresh rectangle, and the correct count, first try.
- Supported: help that shows where one cut goes, or a row already cut.
- Cut count and column count are different facts; record which one the child got wrong.

## Constraints and open questions
- Grade 2 sizes from the curriculum: 2x3 to 5x5, including 2x6 and 4x3. Observation: `build_array` caps at 5x5, `count_array` at 6x8.
- No multiplication notation at Grade 2 (see brief 2).
- Open: whether cuts are free lines that snap, or taps on grid positions.

**Handoff.** Inspect current repository guidance (CLAUDE.md, the owning primitive contract in `docs/contracts/` if present, and the relevant `/add-*` or `/primitive` skill) before designing. Schema, architecture, mode naming, generator approach and build order are yours to choose. Deliver the working capability with the verification those skills require, and recheck the observations below against the code first: they describe the code on 2026-10-28 (commit 253eecabde). Most were read in source, not reproduced: Gemini generation was blocked by a spend cap during this review.
