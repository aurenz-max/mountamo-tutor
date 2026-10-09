# factor-tree — W1 workspace binding (plain shape), 2026-10-09 (ROLLOUT C15)

**Modes bound (6/6):** guided_small, guided_medium, unguided, unguided_large, assessment_intro, assessment. All gesture items; no spoken mode.

**What code checks:** each split (`splitCorrect`: both factors above 1, product equal to the number). A right split that leaves a composite on the tree is a step, not a commit; a wrong split and the split that makes every leaf prime are the checked gestures. Try again keeps the right splits and clears the wrong one (selection, inputs, error). Next / Finish hidden on the workspace path; the scripted path keeps them.

**Misses (`factorMiss`, all modes):** `used_one`, `added`, `wrong_partner`, `not_a_factor`.

**Scene facts:** number, splits so far, leaves, whether primes are colored, whether pairs are listed, selected number, learner work. Never a pair still to find or the factorization.

**Fixed on the way:** `onItemOpened` reset the tree to the previous challenge's root (closure), which made every advance J7 "superseded"; it now reads the opening index. The prime tooltip no longer says "Prime number" when the tier hides prime coloring. `useWorkspacePipSurface` moved above the empty-state return (was a conditional hook).

## Gates

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| `FactorTree.workspace.test.tsx` + pip surface + oracle | 47/47 |
| workspaceContract, misses, lessonWorkspacePlan, activityContract | 2596/2596 |
| journeySweep J1-J13, 6 payloads | 0 findings, 32/32 misses named |
| Replay r1 (`replay/factor-tree-2026-10-09.json`) 6 x 5 | stuck `no_fix_before_try` 2/30: worked 63 ÷ 3 in parts (60 ÷ 3 is 20, 3 ÷ 3 is 1) |
| Replay r2 after guidance fix (`-r2.json`) | 0 misses on every check |

Guidance fix: "never say ... the result of a division, whole or worked out in parts ... The learner does the division or the multiplying; you ask the question that starts it."

## Undriven modes
None. The row drives every mode through the real controls (`Split <n>`, `Factor 1`, `Factor 2`, `Split`) from the leaves in the scene.

## Open findings
- **Primality is given away by the UI.** Prime leaves are disabled buttons and the tree finishes by itself when all leaves are prime, so the learner never judges primality, even at the hard tier with coloring off. The documented struggles "not recognizing primes" and "stopping before all leaves are prime" are therefore unobservable. Fixing it needs a "Done" commit and splittable-looking primes: a task-identity change for `/add-eval-modes`, not W1.
- In r2, 2/30 stuck replies still state one partial quotient ("60 ÷ 3 is 20") while asking for the rest. The check passes; read-off item for the weekly sample.
- Contract is PARTIAL (workspace and levers only); a full `/primitive-contract factor-tree` is owed.
