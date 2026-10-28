# Near-doubles family for addition facts

*Kind: new-mode · Curriculum design review math-g2-2026-10-27 · written 2026-10-27*

## Curriculum (published, verbatim)
- **OPS002-04-a** (OPS002-04 Fluency Within 20): Develop automaticity with addition facts for sums up to 20. Focus: Rapid retrieval of basic addition math facts. Examples: 9+9, 8+7, 6+6, 5+9, 7+8, 9+6, 4+9, 8+8. Constraints: Timed mode enabled in math-fact-fluency, focus on doubles and near-doubles.

## Learning goal and gap
Grade 2 students recall addition facts to 20, with doubles (6+6) and near doubles (6+7, 8+7) as the named focus. `addition-fact-strategies` already teaches doubles from a code-owned pool and has a near double only as a help lever. Its `big_facts` probe drew 7+4, 9+5, 4+6: correct but not near doubles. `di-math-facts` will ask named near doubles aloud, but only when the objective lists them, and nothing teaches the step from the double to its neighbour.

Recommendation: a near-doubles family in `addition-fact-strategies`, which already has the families-of-facts structure, the 0-18 pad and the try-weighted score.

## Essential behavior
- The child meets a double and then its neighbour (6+6, then 6+7), and later the near double alone.
- Teaching shows the near double as the double plus or minus one. Suggestion: a picture of two equal rows with one extra counter.
- Both orders appear (7+6 and 6+7).
- Later items show the near double with no double beside it.

## Worked example
"7 + 8 = ?" A good response: "15, because 7 + 7 is 14 and one more is 15."
Misconception: answering 14 (the double, forgetting the extra one) or 16 (doubling the larger number without subtracting one).

## Evidence of success
- Independent: correct first try on near doubles shown without their double.
- Supported: correct after the double is shown.
- 14 for 7+8 and 16 for 7+8 are diagnostic wrong answers worth recording as such.
- No timer. Project ruling: no timer on fact fluency. Response time may be recorded but should not set credit.

## Constraints and open questions
- Sums to 18 with one-digit addends; the curriculum examples include 9+9 and 4+9.
- Open: does a near double include ±2 (6+8)? The curriculum examples are ±1 only.

**Handoff.** Inspect current repository guidance (CLAUDE.md, the owning primitive's contract in `docs/contracts/` if present, and the relevant `/add-*` or `/primitive` skill) before designing. Schema, architecture, mode naming, generator approach and build order are yours to choose. Deliver the working capability with the verification those skills require, and recheck the observations below against the code first: they describe the code on 2026-10-27 (commit bebc891f56).
