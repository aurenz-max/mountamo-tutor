# equation-balancer: support levers, 2026-10-15

Built on the W1 binding (`qa/tutor-reports/equation-balancer-w1-2026-10-15.md`). Not committed.

## Failure inventory
No real-learner evidence: there are no demonstrations, misconception, remediation or eval-report files for
equation-balancer. Documented means the old catalog's commonStruggles: subscripts and coefficients confused, one element
balanced while another breaks, large balanced numbers. Synthetic means the journey's scripted wrong inputs. The rest is
inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| simple | number in front left out (`ignored_coefficient`), small number left out (`ignored_subscript`) | documented, synthetic |
| simple | added the two numbers (`added_not_multiplied`), group number left out (`ignored_parentheses`), one formula of two counted (`one_compound_only`), near miss (`miscounted`) | inferred |
| guided, complex | balanced but not the smallest numbers (`not_lowest`) | documented |
| guided, complex | one element off (`one_element_off`), several off (`several_off`) | documented, synthetic |
| complex | the one element off is the shared one (`shared_element_off`) | documented (struggle 2), inferred |

## Lever table (built, `equationBalancerLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| all | molecule_view | help | every miss except `not_lowest` | one lettered-ball cluster per copy, for the printed numbers (simple) or the learner's numbers (balance); no total, no match mark |
| guided, complex | atom_tally | help | every miss | each element's count on each side for the numbers now set; `tallyLeak` refuses a match mark or a verdict word; no target |
| all | simpler_equation | simplify | every miss | a bank equation of the same mode with a smaller structure (balance: `balanceRank`; count: `countRank`, then a smaller total), never the learner's equation or one in the session, own id `<id>~simpler`, ungraded; the full item comes back |

Starting position: no tier code. Every item starts with every lever released, and the generator reads no
`config.difficulty`.

## Gates
- `EquationBalancer.workspace.test.tsx`: every catalog miss of every mode is answered by a help lever first
  (`nextLever`). Each lever changes the screen and the scene fact in one commit and rides the next attempt. The tally
  passes `tallyLeak`. The simpler item is the same mode, smaller, not in the session, and never shrinks twice.
- Sweep lever inventory: every catalog miss answered on all three modes, 0 gaps.
- Replay r2: every count miss and stuck reply pulls `molecule_view` and asks the learner to count. On balance items the
  tutor pulls `atom_tally` or `molecule_view` and asks the learner to compare.

## Failures with no lever
- `not_lowest` has only the tally and the simpler equation. A lever that says "these numbers share a factor" would
  state the fix.
- A smallest count item (one formula, total 2: water, table salt) has no simpler equation. Nothing smaller exists in
  the mode.
