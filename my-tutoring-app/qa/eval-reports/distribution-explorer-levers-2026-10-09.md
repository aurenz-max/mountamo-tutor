# distribution-explorer — support levers, 2026-10-09

Batch C19, after the W1 binding (`../tutor-reports/distribution-explorer-w1-2026-10-09.md`).

## Failure inventory
No real-learner evidence (no demonstrations, misconception or eval reports for this id). Documented: catalog
commonStruggles (rate vs mean, discrete vs continuous, memorylessness, PMF vs density). Observed-synthetic: the sweep's
wrong programs and the miss function (`distributionMiss`).

| Mode | Miss (class) |
|---|---|
| explore | `not_explored` (synthetic) |
| identify | `discrete_continuous` (documented), `binomial_poisson` (inferred) |
| compute | `complement`, `near_value` (documented: generator distractor rules), `reciprocal` (documented: rate vs mean), `wrong_value` |
| predict shape | `reversed_skew`, `said_symmetric`, `wrong_shape` (inferred) |

## Lever table (`distributionExplorerLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| explore | `slider_glow` ring on the slider(s) the prompt names | help | not_explored | says nothing about what the chart does |
| identify | `family_facts` one line under every choice: what it models, its values | help | both | `familyFactsLeak`: no family name, same parts for each |
| identify | `two_families` plainer scenario, two choices | simplify | both | `twoFamiliesLeaks`: asked family is never the item's |
| compute | `event_strip` "Asked: 3, 4, 5, … \| Left out: 0, 1, 2" | help | complement, near_value | `stripLeaks`: whole counts, no choice |
| compute | `worked_model` same question on other parameter values, steps to its number | help | all four | `workedModelLeaks`: other params, no choice number unless the item prints it, result not within 1% of the key |
| compute | `simpler_compute` one step less on a model: P(X = k), or E[T] for a waiting time | simplify | all four | `simplerLeaks`: no item choice among its values |
| shape | `shape_guide` the three shape words by where the values sit and which way the tail runs | help | all three | names every word, marks none |
| shape | `two_shapes` a stated model's shape, two choices | simplify | all three | `twoShapesLeaks`: its answer is not the item's shape |

`event_strip` is offered on whole-count events other than `=`; `worked_model` and `simpler_compute` only when the
item's words name a family, its parameters and the asked quantity (`askedOf`); `simpler_compute` is not offered on a
mean, variance or single-point item (already one step). No starting positions from `config.difficulty`: the generator
has no tier harness.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline).
- `distributionExplorerLevers.test.ts` 167/167 (leak rules over 74 generated compute shapes, three families, three shapes,
  and the saved items' miss coverage); `DistributionExplorer.levers.workspace.test.tsx` 4/4; workspace test 9/9.
- Sweep J1-J13 on 4 payloads: 0 findings; J12 every miss answered on every saved item; J13 no key after any help pull.
- Tutor replay r3 (`../tutor-reports/replay/distribution-explorer-2026-10-09-r3.json`, 4 x 5): 2/20 hits, both
  `no_fix_before_try` on explore ("drag the p slider") — the prompt's own instruction on an ungraded observation, not an
  answer; `no_change_before_receipt` 0/20. Lever replies point at the on-screen change and ask the learner to apply it.

## Failures with no lever / open
- On a one-formula compute item (E[X] for Poisson) the worked model's "E[X] = λ = 6" makes the item a transfer of the
  rule; that is the parallel-item model the 10-02 ruling allows, recorded for review.
- An item whose words do not name the family and parameters (none in the saved payloads) gets only the strip, or no
  compute lever: J12 would flag it on such a payload.
- Replay check false positive class: explore's "fix" is the prompt's own action (`replay_checks.py`, not changed here).
