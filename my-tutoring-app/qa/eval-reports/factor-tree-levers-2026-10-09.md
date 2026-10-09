# factor-tree — support levers, 2026-10-09

## Failure inventory (all six modes share the split; they differ in number size, listed pairs and reset)

| Failure | Miss id | Evidence class |
|---|---|---|
| Uses 1 as a factor | `used_one` | documented (catalog commonStruggles) |
| Two numbers that add to the number | `added` | inferred |
| A factor that divides, wrong partner | `wrong_partner` | observed-synthetic (journey wrong input) |
| Neither number divides | `not_a_factor` | inferred |
| Not recognizing primes | — | documented; unobservable: primes are disabled and the tree finishes itself (W1 finding) |
| Stopping before every leaf is prime | — | documented; unobservable for the same reason |

No real-learner evidence: no demonstrations, misconception reports or remediation module for factor-tree.

## Lever table (every mode)

| Lever | Kind | Answers | Carrier | Leak rule (code) |
|---|---|---|---|---|
| `divisibility_rules` | help | used_one, not_a_factor | shown | rules in words, no digit; names no number on the tree. Easy guided tier draws it already: declared pulled, not recorded |
| `partner_frame` | help | wrong_partner | shown | prints only the selected number and the learner's Factor 1, result left "?" (`frameLeaks`) |
| `product_check` | help | added, wrong_partner, not_a_factor | shown | prints only the learner's typed factors, their product and the number; blank until both typed (`readoutLeaks`) |
| `smaller_tree` | simplify | all four | shown | practice root in [0.6n, n), one prime factor fewer, not n, a factor or a multiple of n (`practiceLeaks`); `~simpler` id, ungraded; full item returns blank. None for one-split numbers |

`nextLever`: used_one → rules; added → product; wrong_partner → partner frame, then product; not_a_factor → rules, then product. Starting positions: the existing tier (`showStrategyHint`) only; no generator change.

## Built
`factorTreeLevers.ts` (declarations, builders, leak rules), lever state keyed by item in `FactorTree.tsx` with `pullLever`/`endPractice`, scene fact `onScreen` (no digit), catalog `levers: true`, journey `replayKeys` for practice trees. The rules panel now writes its primes as words on both paths.

## Gates

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| `factorTreeLevers.test.ts` + `FactorTree.levers.workspace.test.tsx` | 26 + 4 pass |
| W1 suite + shared contract tests | 2662/2662 |
| journeySweep (incl. J9, J12, J13), 6 payloads | 0 findings, 32/32 misses named |
| Replay r3 (`replay/factor-tree-2026-10-09-r3.json`) 6 x 5, lever + stuck | 0 misses on every check; the tutor pulls `partner_frame` / `product_check` itself on "I'm stuck" |
| Replay r4 after fact fix (`-r4.json`) | 0 misses |

Fact fix after r3: tutors said the frame showed "63 ÷ 3" when, after Try again, it reads "the number ÷ your first factor" until the learner taps and types. The fact now says so; r4 replies describe it correctly.

## Failures with no lever
Primality and stopping early: unobservable until the task asks the learner to judge primes (see the W1 report).
