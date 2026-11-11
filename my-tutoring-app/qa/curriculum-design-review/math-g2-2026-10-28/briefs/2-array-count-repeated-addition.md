# Count an array by rows and check with repeated addition (Grade 2)

*Kind: repair · Curriculum design review math-g2-2026-10-28 · written 2026-10-28*

## Curriculum (published, verbatim)
- **GEOM002-02-b** (GEOM002-02 Partition Rectangles): Count the total number of squares within a partitioned rectangle by identifying the number of rows and columns. Focus: Calculating total squares using row and column structure. Examples: 2 rows of 3, 3 rows of 4, 4 rows of 5, 2 rows of 8, 5 rows of 2, 3 rows of 6, 4 rows of 4, 6 rows of 3. Constraints: Display the array visual alongside a field to input the total count; verify by repeated addition.

## Learning goal and gap
Grade 2 students find the number of squares in a rectangle by its rows and columns and write the total as a sum of equal addends (2.OA.C.4, 2.G.A.2): 4 rows of 5 is 5 + 5 + 5 + 5 = 20. `array-grid` `count_array` is the right surface: a finished array with row and column labels at easy and medium, a total field, and a row-strip lever. Three things make it a Grade 3 multiplication task at Grade 2:
1. After a correct answer the screen shows "4 x 5 = 20" (ArrayGrid.tsx:986), and build says "You built a 4 x 5 array".
2. The generator prompt tells Gemini to "motivate arrays-as-multiplication", and the tiered path routes count to the mult-div-facts item space.
3. Credit is the total only. The curriculum says "verify by repeated addition"; nothing asks for or scores the sum.

Recommendation: repair the mode for Grade 2, not a new mode. The task is the same; its framing and evidence are wrong for the grade.

## Essential behavior
- Grade 2 sees addition language and an equal-addends sentence, never x.
- The child gives the total and the repeated-addition sentence that checks it (5 + 5 + 5 + 5).
- Rows or columns may be the addend; both are correct.
- Grade 3 and later keep the current multiplication framing.

## Worked example
3 rows of 6 squares. Good: "6 + 6 + 6 = 18." Also good: "3 + 3 + 3 + 3 + 3 + 3 = 18."
Misconceptions: 6 + 3 = 9 (adding the dimensions); 6 + 6 = 12 (one row missed).

## Evidence of success
- Independent: a correct total and a matching equal-addends sentence on a fresh array, labels off.
- Correct total with a mismatched sentence (6 + 6 = 18) is partial and should be recorded as such.
- Supported: row strips or labels on.

## Constraints and open questions
- Sizes: the curriculum examples go to 6 rows of 3 and 2 rows of 8; `count_array` caps at 6x8, which fits.
- Observation to recheck: no contract file exists for array-grid; derive one (`/primitive-contract`) before editing, since Grade 3 lessons depend on the x framing.
- Open: whether the sentence is typed, built from tiles, or spoken.

**Handoff.** Inspect current repository guidance (CLAUDE.md, the owning primitive contract in `docs/contracts/` if present, and the relevant `/add-*` or `/primitive` skill) before designing. Schema, architecture, mode naming, generator approach and build order are yours to choose. Deliver the working capability with the verification those skills require, and recheck the observations below against the code first: they describe the code on 2026-10-28 (commit 253eecabde). Most were read in source, not reproduced: Gemini generation was blocked by a spend cap during this review.
