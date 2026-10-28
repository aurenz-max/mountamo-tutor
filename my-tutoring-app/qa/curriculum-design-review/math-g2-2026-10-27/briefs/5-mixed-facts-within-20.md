# Mixed addition and subtraction facts within 20

*Kind: repair · Curriculum design review math-g2-2026-10-27 · written 2026-10-27*

## Curriculum (published, verbatim)
- **OPS002-04-c** (OPS002-04 Fluency Within 20): Complete a mixed set of timed addition and subtraction problems within 20 to test overall fluency. Focus: Fluency maintenance across mixed operations. Examples: 8+7, 15-6, 9+9, 12-4, 7+6, 18-9, 5+8, 14-7. Constraints: Timed mode, randomized operation sequence, use math-fact-fluency.

## Learning goal and gap
Grade 2 students answer a shuffled set of addition and subtraction facts within 20 without counting. Lumina has the facts (the add-sub-20 item space) but no session promises a mix:
- `math-fact-fluency` `equation_solve` drew 2 subtraction and 4 addition facts within 20. The mix is incidental to difficulty, and the primitive is labelled K-1 ("Grade 1" badge, catalog text "within 3, 5, or 10").
- `di-math-facts` `subtraction_fact` served 8−3, 9−5, 9−8 for an objective that lists 18−9 and 15−7.
- `di-math-facts` blends round-robin + and − in a fixed alternating order, and blends get no difficulty tier.

Recommendation: repair existing primitives (an operation balance for a mixed set, grade labelling, the subtraction ceiling) rather than add a primitive.

## Essential behavior
- A lesson can ask for a mixed set; the session then has a real share of both operations in an unpredictable order.
- Subtraction facts reach 20 when the lesson says within 20 (18−9, 17−9).
- Grade 2 sees Grade 2 labelling.
- No timer (project ruling). If response time is recorded, it should exclude input mechanics such as stepper taps.

## Worked example
Set: 8+7, 15−6, 9+9, 12−4, 7+6, 18−9. Good: 15, 9, 18, 8, 13, 9.
Misconception: adding in a subtraction item after several addition items (15−6 → 21), the error a random order is meant to catch.

## Evidence of success
- Independent: first-try accuracy across both operations in a mixed set.
- Report accuracy per operation; a child at 100% on + and 50% on − has not met the objective.
- Observation to recheck: `visual_fact` draws the total as dots and `match` distractors are always "+", so a subtraction answer is the only "−" option. Those modes cannot carry this evidence until fixed.

## Constraints and open questions
- Within 20, no negative results.
- Open: which primitive owns mixed sets; math-fact-fluency (tap) and di-math-facts (spoken) could both.

**Handoff.** Inspect current repository guidance (CLAUDE.md, the owning primitive's contract in `docs/contracts/` if present, and the relevant `/add-*` or `/primitive` skill) before designing. Schema, architecture, mode naming, generator approach and build order are yours to choose. Deliver the working capability with the verification those skills require, and recheck the observations below against the code first: they describe the code on 2026-10-27 (commit bebc891f56).
