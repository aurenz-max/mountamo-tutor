# regrouping-workbench --check 2026-10-27

Edit: G2 design review brief 3 (`qa/curriculum-design-review/math-g2-2026-10-27/briefs/3-regrouping-workbench-model-evidence.md`).

| Req | Touched | Probe | Verdict |
|---|---|---|---|
| R1 blocks never print the answer | yes, re-based (strengthened) | workspace test (3 new cases), browser drive | COMPATIBLE |
| R2 wrong check names no number | no | workspace test `$mode` cases | COMPATIBLE |
| R3 W1 shape, typed check | `blocksModelled` recorded beside the verdict | workspace test, submitted metrics | COMPATIBLE |
| R4 levers leave the answer to the learner | `tradeNeeded` counts pending blocks | levers tests (4) pass | COMPATIBLE |
| R5 tiers set starting positions | no | item-space test, 12-session probe | COMPATIBLE |

Verdict: COMPATIBLE. Tests 53/53 (`RegroupingWorkbench*`, `regroupingWorkbench*`, item space, oracle). `regroupingWorkbenchItemSpace.test.ts`
"hint and narration never state the answer" flakes on a one-digit answer that appears inside an operand (pre-existing, 3/3 reruns pass).
