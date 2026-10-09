# Contract: factor-tree

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C15) for the workspace and lever requirements only. A full `/primitive-contract factor-tree` derivation (consumers per number-theory skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/FactorTree.tsx` · **Workspace:** `factorTreeWorkspace.ts` · **Levers:** `factorTreeLevers.ts` · **Generator:** `service/math/gemini-factor-tree.ts` · **Oracle:** `service/qa/oracles/factor-tree.ts` · **Adapter:** `components/live-activity/adapters/factorTreeLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`factor-tree`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all six modes are gesture items checked by the activity's own split check (`splitCorrect`: both factors above 1, product equal to the number). A right split that leaves a composite on the tree is a step and not a commit; a wrong split and the split that makes every leaf prime are. Each wrong split names a `FactorTreeMiss` (`used_one`, `added`, `wrong_partner`, `not_a_factor`). Scene facts name the number, the splits made, the leaves, whether primes are colored, whether factor pairs are listed, and the selected number; never a pair still to find or the factorization. Try again keeps the right splits and clears the wrong one. Next / Finish are not shown on the workspace path.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C15.
- **Evidence:** `FactorTree.workspace.test.tsx`; sweep J1-J13 on 6 payloads; replay 6 x 5 (`qa/tutor-reports/factor-tree-w1-2026-10-09.md`).
- **Probe:** `FactorTree.workspace.test.tsx`; `journeySweep -t factor-tree`.

### R2 — every root is a composite the learner can split · OBSERVED (2026-10-09)
- **Property:** the live adapter refuses a root below 4 or prime. The generator draws roots from per-mode composite pools.
- **Probe:** `FactorTree.workspace.test.tsx` (adapter case); oracle `factor-tree.test.ts`.

### R3 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** see `factorTreeLevers.ts` and `qa/eval-reports/factor-tree-levers-2026-10-09.md`.
- **Evidence:** `factorTreeLevers.test.ts`, `FactorTree.levers.workspace.test.tsx`; sweep J9/J12/J13.

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding and levers, C15).
