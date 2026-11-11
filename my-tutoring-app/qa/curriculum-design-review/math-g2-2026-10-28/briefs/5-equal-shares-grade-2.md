# Equal shares: cut, name, and judge halves, thirds and fourths

*Kind: new-primitive · Curriculum design review math-g2-2026-10-28 · written 2026-10-28*

## Curriculum (published, verbatim)
- **GEOM002-03-a** (GEOM002-03 Equal Shares): Partition circles into equal-sized portions representing halves, thirds, and fourths by dragging radial lines. Focus: Visualizing equal division of circular areas. Examples: divide circle into 2, divide circle into 3, divide circle into 4, name half of circle, name third of circle, name fourth of circle, create 2 equal shares, create 3 equal shares. Constraints: Provide auto-snap functionality for equal spacing; require identifying the fractional name of each part.
- **GEOM002-03-c** (GEOM002-03 Equal Shares): Recognize that identical wholes can be partitioned into equal shares using different shapes and configurations. Focus: Understanding that equal shares do not always look identical in shape but must be equal in area. Examples: half of circle (2 triangles vs 2 sectors), half of rectangle (diagonal cut vs vertical cut), thirds of rectangle (3 columns vs 3 rows), identifying equal portions in irregular partitions. Constraints: Provide multiple ways to partition the same whole and require the user to verify equality.

## Learning goal and gap
Grade 2 students partition circles and rectangles into two, three or four equal shares, describe a share with words (halves, thirds, half of, a third of, fourths, a quarter of), and recognise that equal shares of the same whole need not have the same shape (2.G.A.3). No fraction notation at this grade.

What Lumina has today:
- `fraction-circles` pre-cuts the circle in every mode but `build_equal`. `identify` needs a typed "1/4" and cannot accept "one fourth". `build_equal` lets the child cut with buttons but asks for an equivalent fraction (Grade 3) and at Grade 2 credits sixths to twelfths. Its contract fixes it as a notation tool.
- `touch_fraction` uses words (half, third, fourth), but the child only touches a picture.
- No primitive shows an unequal partition, cuts a rectangle, or cuts one whole two different ways.

Recommendation: a new Grade 2 primitive. Its main actions (cut a whole, judge equal or not, compare two cuts of the same whole) are not in any current tool, and adding them to fraction-circles would conflict with its Grade 3 contract. The sibling GEOM002-03-b (rectangles, horizontal vs vertical) was not sampled but belongs here.

## Essential behavior
- Cut: the child cuts a circle or rectangle into 2, 3 or 4 equal shares. Equal spacing can be helped (snap), but the child chooses how many cuts and where.
- Name: the child names one share in words ("a third"), and the whole as "three thirds".
- Judge: the child sees a whole cut into parts and decides whether they are equal shares. Unequal cuts must appear, or the judgement means nothing.
- Same whole, different cuts: a square cut in half straight down and corner to corner; the child decides both halves are equal shares, and says why (each is half of the same square).

## Worked example
Two squares of the same size: one cut down the middle (two rectangles), one cut corner to corner (two triangles). "Is the triangle the same amount as the rectangle?" Good: "Yes, both are half of the same square."
Misconceptions: "No, they are different shapes"; calling any two pieces "halves" even when one is bigger; cutting a circle into thirds with three parallel lines.

## Evidence of success
- Independent: correct equal / not-equal judgements on fresh wholes, including the same-whole-different-cut case.
- Independent: correct word name for a share.
- A cut with snapping on is supported practice; without snapping or after a fresh ask it is stronger evidence.
- Do not credit a share name typed as a fraction at Grade 2 as the target behaviour.

## Constraints and open questions
- Shares limited to halves, thirds and fourths.
- Accessibility: the judge step should not depend on colour alone.
- Open: whether verifying equality means a reason chosen from options, a spoken reason judged by the tutor, or moving one share onto another.

**Handoff.** Inspect current repository guidance (CLAUDE.md, the owning primitive contract in `docs/contracts/` if present, and the relevant `/add-*` or `/primitive` skill) before designing. Schema, architecture, mode naming, generator approach and build order are yours to choose. Deliver the working capability with the verification those skills require, and recheck the observations below against the code first: they describe the code on 2026-10-28 (commit 253eecabde). Most were read in source, not reproduced: Gemini generation was blocked by a spend cap during this review.
