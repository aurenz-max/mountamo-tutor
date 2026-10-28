# Two-step tape-diagram stories with a chosen operation pattern

*Kind: new-mode · Curriculum design review math-g2-2026-10-27 · written 2026-10-27*

## Curriculum (published, verbatim)
- **OPS002-03-a** (OPS002-03 Two-Step Problems): Model and solve two-step word problems involving only addition by using tape diagrams. Focus: Visualizing the total as a combination of two distinct parts plus a second increase. Examples: 10+5+8, 20+10+5, 12+12+4, 15+5+10, 25+10+5, 30+10+10, 22+8+5, 14+6+10. Constraints: Values up to 100, use tape-diagram, step-by-step logic input.
- **OPS002-03-c** (OPS002-03 Two-Step Problems): Solve two-step compare problems with an unknown quantity by using tape diagrams to relate quantities. Focus: Finding the missing part in a two-step comparison context. Examples: (10+10)-x=5, (20+5)-x=10, (40+10)-x=25, (30+20)-x=15, (50+5)-x=30, (25+25)-x=20, (60+10)-x=40, (15+15)-x=5. Constraints: Use tape-diagram, allow the unknown to be in different parts of the diagram.

## Learning goal and gap
Grade 2 students solve two-step word problems within 100 by drawing the story as a tape and solving one step at a time. The curriculum asks for two patterns that Lumina cannot produce today:
- both steps add (12 birds, 12 more land, then 4 more);
- combine two amounts, then compare with a third, with the unknown in different places.

`tape-diagram` `multi_step` is the closest tool. In this review its probe drew three stories, each with one addition and one subtraction step, and the source forces that mix for every chain. With a tier, the two-step item space lists only +− and −+ and stops at 20. `solve_comparison` compares well (the unknown can be the difference, the larger or the smaller amount) but only for one step. Recommendation: extend tape-diagram rather than build a new primitive; the representation and the step-by-step solve already exist.

## Essential behavior
- The student works through one story with two steps, using the result of step one in step two.
- A lesson can ask for a pattern: add-add, add-subtract (either order), or combine-then-compare. Within the compare pattern the unknown can be the combined amount, the compared amount, or the difference.
- Code owns the numbers and answers, within 100 at Grade 2.
- The tape for step two is built from step one, so the child sees why the first answer matters.
- Suggestion: let the student choose or build the step-two bar rather than seeing it finished; the curriculum names "step-by-step logic input".

## Worked example
"Tia has 20 red beads and 5 blue beads. She has 10 more beads than Sam. How many beads does Sam have?"
Step 1: 20 + 5 = 25 (Tia's total). Step 2: 25 − 10 = 15 (Sam).
Misconception: the child sees "more" and adds, 25 + 10 = 35. A second one: the child skips step 1 and compares 20 with 10.

## Evidence of success
- Independent: the right value at each step on a fresh story of the requested pattern, first try.
- Supported: hints that name the operation (the current easy/medium behaviour) mark the item as supported.
- No credit for a final answer typed without step one, if the design records steps.
- Uncertain: "more" with subtraction is the hard case; treat it as a structural difficulty level, not an error in the item.

## Constraints and open questions
- Grade 2, within 100; regrouping allowed.
- Observation to recheck: segment widths are proportional even for the unknown, which hints when the difference is unknown.
- Observation to recheck: the attempt count may be recorded one low (TapeDiagram.tsx:513-518), which would make first-try evidence wrong for this mode too.
- Open: whether add-add is a new mode or a pattern option on multi_step.

**Handoff.** Inspect current repository guidance (CLAUDE.md, the owning primitive's contract in `docs/contracts/` if present, and the relevant `/add-*` or `/primitive` skill) before designing. Schema, architecture, mode naming, generator approach and build order are yours to choose. Deliver the working capability with the verification those skills require, and recheck the observations below against the code first: they describe the code on 2026-10-27 (commit bebc891f56).
