# Regrouping workbench: the blocks do the work

*Kind: repair · Curriculum design review math-g2-2026-10-27 · written 2026-10-27*

## Curriculum (published, verbatim)
- **OPS002-01-a** (OPS002-01 Add Within 100): Add two two-digit numbers using place value blocks to build understanding without regrouping. Focus: Adding tens to tens and ones to ones without exceeding ten in any column. Examples: 24+12, 33+45, 51+26, 70+19, 42+35, 61+28, 15+54, 82+17. Constraints: Numbers within 100, no carries required, use regrouping-workbench.
- **OPS002-02-a** (OPS002-02 Subtract Within 100): Subtract two-digit numbers using place value blocks without needing to decompose a ten. Focus: Subtracting tens and ones independently. Examples: 45-22, 68-34, 99-57, 76-45, 59-18, 88-66, 37-21, 95-43. Constraints: Values within 100, no borrowing required, use regrouping-workbench.
- **OPS002-02-b** (OPS002-02 Subtract Within 100): Subtract two-digit numbers by decomposing a ten into ten ones to complete the subtraction. Focus: Master the borrowing process using place value models. Examples: 52-27, 41-15, 63-38, 70-24, 85-39, 92-46, 34-19, 56-27. Constraints: Values within 100, use regrouping-workbench to visualize the trade.

## Learning goal and gap
Grade 2 students add and subtract two-digit numbers with place-value blocks: without regrouping, and subtraction by breaking a ten into ten ones. `regrouping-workbench` is the curriculum's target and its numbers fit (probe: 22+27, 69−27, 71−12, 60−42). Three things stop it from teaching or measuring the place-value action:
1. **Answer on screen at the start (confirmed in source).** For addition the starting blocks are each column's sum and each column shows its count as a large numeral, so 24+12 reads 3 tens / 6 ones before the child acts.
2. **Off-structure problems at easy (recorded run).** The easy tier draws two-digit ± one-digit problems (51+3, 78−3) through the bottom-third fallback, which breaks "two two-digit numbers".
3. **The blocks never count.** Credit is the typed digits. The Carry/Borrow trade is optional and recorded as a metric; in subtraction, blocks show the first number and nothing is taken away.

Recommendation: repair the existing modes. A new mode would hide a scoring defect behind a new name.

## Essential behavior
- Addition: the child sees two numbers as blocks and puts them together; the total is not shown before the child makes it.
- Subtraction: the child starts with the first number and removes the second; when there are not enough ones, the child breaks a ten into ten ones first.
- The written column stays linked to the blocks, so the written algorithm and the model describe the same action.
- At every tier, both operands are two-digit for these objectives.

## Worked example
52 − 27: the child has 5 tens and 2 ones, cannot take 7 ones, breaks a ten (4 tens, 12 ones), removes 2 tens and 7 ones, and has 2 tens and 5 ones = 25.
Misconception: 52 − 27 = 35 (subtracting the smaller digit from the larger in each column, 7 − 2 = 5).

## Evidence of success
- Independent: correct difference or sum with the matching block action (trade when needed, no trade when not).
- The answer typed without the matching block action should be recorded as such, not as full evidence. Whether it still scores is a design decision; it should not be indistinguishable from a modelled answer.
- An unneeded trade in a no-regroup problem is information, not an error to punish.

## Constraints and open questions
- The primitive contract (`docs/contracts/regrouping-workbench.md`) lists what other skills depend on; check it before changing the starting state.
- Observation: without a tier, Gemini writes the problems and only the range is checked, so a borrow can appear in subtract_no_regroup.
- Open: whether the trade is required (blocked until done) or observed (recorded). Pick whichever keeps support tiers working.

**Handoff.** Inspect current repository guidance (CLAUDE.md, the owning primitive's contract in `docs/contracts/` if present, and the relevant `/add-*` or `/primitive` skill) before designing. Schema, architecture, mode naming, generator approach and build order are yours to choose. Deliver the working capability with the verification those skills require, and recheck the observations below against the code first: they describe the code on 2026-10-27 (commit bebc891f56).
