# Contract: function-machine

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C17) for the workspace and open-build requirements only. A full `/primitive-contract function-machine` derivation (consumers per patterns/functions skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/FunctionMachine.tsx` · **Domain:** `functionMachineDomain.ts` (rule arithmetic, make_rule judge) · **Workspace:** `functionMachineWorkspace.ts` · **Generator:** `service/math/gemini-function-machine.ts` · **Oracle:** `service/qa/oracles/function-machine.ts` · **Adapter:** `components/live-activity/adapters/functionMachineLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`function-machine`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all five modes are gesture items checked by the activity's own code. observe: Continue after the required pairs is the item's one commit, always right. predict: each wrong prediction is a checked miss (`predictMiss`) and on the workspace path its output stays hidden and the input stays in the queue; right predictions before the last are progress, the last one commits. discover_rule / create_rule: Check commits (`rulesEquivalent`, miss from `guessMiss`). make_rule: a miss commits (`judgeMakeRule`); the first accepted machine is progress; the second commits. Scene facts name the rule only where it is drawn (observe, predict), the pairs on screen, the inputs left, the machines accepted; never a hidden rule, an output not yet fed, or a machine that would make the pair. Try again clears the typed prediction or rule and keeps fed pairs; make_rule keeps the row. Next Function and the predict tally are not shown on the workspace path.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C17.
- **Evidence:** `FunctionMachine.workspace.test.tsx`; sweep J1-J13 on 5 payloads (`qa/tutor-reports/function-machine-w1-2026-10-09.md`).
- **Probe:** `FunctionMachine.workspace.test.tsx`; `journeySweep -t function-machine`.

### R2 — make_rule is an open build judged by code · OBSERVED (2026-10-08)
- **Property:** one pair per item, code-owned; any machine that runs, uses x, makes the pair and differs from the first machine passes. Miss words name what the machine gave, never a tile or rule that would work. The stored machine is never on screen and never reaches a tutor.
- **Evidence:** `qa/open-build/function-machine-overnight/REPORT.md`; `functionMachineDomain.test.ts`, `FunctionMachine.build.test.tsx`.

### R3 — a typed rule may write multiplication by position · OBSERVED (2026-10-09)
- **Property:** `evaluateRule` reads "2x", "3(x + 1)" and the keypad signs × ÷ −, so "1 + 2x" is equivalent to 2*x + 1. Before 2026-10-09 any reordered rule with implicit multiplication was marked wrong.
- **Probe:** `FunctionMachine.workspace.test.tsx` ("multiplication by position").

### R4 — no example rule in the rule box · OBSERVED (2026-10-09)
- **Property:** the discover/create rule box placeholder is "use x"; it was "e.g., x + 3", which is the answer on an x + 3 item.

### R5 — every checked mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** help levers draw a model machine outside the item (predict: none of its numbers is an item output; discover/create: never the rule or a text containing it), the rule's own two steps in place of the rule, the learner's own last rule marked on each pair, output changes between pairs already on screen, the learner's own last machine worked through, or empty machine shapes with no number. Simplify opens a one-step, small-number practice item of the same mode (make: a smaller pair), with its own id, never equivalent to the item's rule and, on predict, with none of its outputs; it is ungraded and the full item returns blank. A pull with nothing to draw (no checked rule or machine yet) is refused. Observe has no lever (nothing can miss). See `functionMachineLevers.ts`, `qa/eval-reports/function-machine-levers-2026-10-09.md`.
- **Evidence:** `functionMachineLevers.test.ts`, `FunctionMachine.levers.workspace.test.tsx`; sweep J9/J12/J13.

## Changelog

- 2026-10-09 — created with R1-R5 (W1 plain-shape binding and levers, C17). R2 recorded from the 10-08 open-build report.
