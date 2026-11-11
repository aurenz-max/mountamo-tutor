# Coin counter: dollar notation and coin-count targets

*Kind: new-mode · Curriculum design review math-g2-2026-10-28 · written 2026-10-28*

## Curriculum (published, verbatim)
- **MEAS002-05-b** (MEAS002-05 Money): Students write money amounts using the dollar sign and decimal point to record coin totals accurately. Focus: Representing money values with proper notation. Examples: $0.25, $1.05, $0.78, $2.50, $0.12, $0.45. Constraints: Transition from counting coins to inputting the correct numeric format.
- **MEAS002-05-c** (MEAS002-05 Money): Students solve word problems and create target amounts using combinations of coins to reach a specific goal. Focus: Making change and building target amounts with coins. Examples: make 50 cents, make $1.00, make 35 cents using 5 coins, make 75 cents. Constraints: Provide multiple valid combinations; focus on solving constraints under specific coin counts.

## Learning goal and gap
Grade 2 students solve money problems with dollars and coins, using $ and the cent sign correctly (2.MD.C.8). The curriculum asks for two things `coin-counter` does not do:
1. **Writing amounts as dollars** ($0.78, $1.05, $2.50). Every coin-counter answer field is a whole number of cents with a cent placeholder; "0.78" parses to 0 and $ cannot be typed. Amounts over 99c never occur at Grade 2, and there are no bills.
2. **Making an amount with a set number of coins** ("make 35 cents using 5 coins"). No mode sets or checks a coin count; even `fewest-coins` only checks the total.

`show-amount` already handles "many valid combinations" well (probe: 30c, 47c, 53c, 99c, empty tray, no running total).

Recommendation: two new modes on `coin-counter`, or two options on existing modes; the implementing session decides.

## Essential behavior
- Dollar notation: the child counts coins (and later bills) and writes the total with $ and a decimal point. Totals cross $1 so $1.05 vs $1.50 appears.
- Coin-count target: the child makes an amount with exactly N coins. Code checks both the total and the count. Some targets have one answer (35c with 5 coins: only 2 dimes + 3 nickels), others several (50c with 5 coins: 5 dimes, or 1 quarter + 1 dime + 3 nickels); the item design should know which.
- No running total at the independent level.

## Worked example
Dollar notation: 3 quarters and 3 pennies. Good: "$0.78". Misconceptions: "$78", "$0.078", "78" with no sign, "$.78" (decide whether to accept).
Coin count: "Make 35 cents with 5 coins." Good: 2 dimes + 3 nickels. Misconception: 1 quarter + 1 dime (right amount, 2 coins).

## Evidence of success
- Independent: correct notation for fresh totals on both sides of $1; correct amount and count for a fresh target.
- Right amount with the wrong coin count is partial, recorded separately from a wrong amount.
- Cents written as "78c" is correct money but not the target notation; record it as such.

## Constraints and open questions
- Observation to recheck: the Grade 2 tier ceiling is 99c (gemini-coin-counter.ts:795-796); "make $1.00" and dollar notation need it raised for these modes.
- Observation: the coin-counter contract (docs/contracts/coin-counter.md) lists gap G8 (fewest-coins count) open and still marks the G2 grade-band gap OPEN although code fixed it.
- Queue separately: make-change prints the subtraction and takes a typed number; the child should make the change with coins.
- Open: bills at Grade 2 (the standard says dollar bills).

**Handoff.** Inspect current repository guidance (CLAUDE.md, the owning primitive contract in `docs/contracts/` if present, and the relevant `/add-*` or `/primitive` skill) before designing. Schema, architecture, mode naming, generator approach and build order are yours to choose. Deliver the working capability with the verification those skills require, and recheck the observations below against the code first: they describe the code on 2026-10-28 (commit 253eecabde). Most were read in source, not reproduced: Gemini generation was blocked by a spend cap during this review.
