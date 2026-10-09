# Contract: double-number-line

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C15) for the workspace, leak and lever requirements only. A full `/primitive-contract double-number-line` derivation (consumers per ratio skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/DoubleNumberLine.tsx` · **Workspace:** `doubleNumberLineWorkspace.ts` · **Levers:** `doubleNumberLineLevers.ts` · **Generator:** `service/math/gemini-double-number-line.ts` · **Oracle:** `service/qa/oracles/double-number-line.ts` · **Adapter:** `components/live-activity/adapters/doubleNumberLineLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`double-number-line`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all three modes are gesture items: the learner types the bottom value at the marked top value and presses Check; the activity's own check (`valuesCorrect`, ±0.1) is the judge. Each wrong check names a `DoubleNumberLineMiss` from the catalog list (`ratioLineMiss`). Scene facts name the lines and their ends, the context, the question, the given pair, the asked top value, which labels and guides are drawn, and what was typed; never the bottom value asked for. Try again empties the box. The generated hint (it names the operation and the numbers) and Next are not shown on the workspace path.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C15.
- **Evidence:** `DoubleNumberLine.workspace.test.tsx` 8; sweep J1-J13 on 3 payloads, 0 findings, 12/12 misses named; replay 3 x 5 (`qa/tutor-reports/double-number-line-w1-2026-10-09.md`).
- **Probe:** `DoubleNumberLine.workspace.test.tsx`; `journeySweep -t double-number-line`.

### R2 — nothing on screen or in the setup states an item's answer, and every item can be answered · OBSERVED (2026-10-09)
- **Property:** the bottom line prints tick labels only at its ends and at the given values, at every tier; a bottom tick at an asked value shows `?` (with the bottom interval equal to the rate, a fully labelled bottom line printed every answer and the rate). Every prompt states what the item needs: equivalent_ratios states the unit rate, find_missing and unit_rate state the given pair (the harder tiers withdraw the unit-rate dot and the given badges, so without it an item could not be answered). On find_missing and unit_rate the context and description never state the unit rate (the generator replaces a sentence that does; 10-09 payload: "7 finished components for every 1 unit").
- **Probe:** `DoubleNumberLine.workspace.test.tsx` (no bottom tick shows the answer); oracle `double-number-line.test.ts`.

### R3 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `doubleNumberLineLevers.ts` declares levers on every mode and every miss the check can name on an item is answered by a lever on that item. Help: split_given (an item with a non-unit given pair), unit_jumps (an ask at top 2 or more), grow_model (every item; a picture outside the item). Leak rules in code: no lever text, caption or fact carries a digit; the drawn jumps and marks carry no text. Simplify (`smaller_ask`) opens a same-mode item on the same lines with its own `~simpler` id and prompt, a different top value and a bottom value outside the tolerance of the item's (`practiceLeaks`), ungraded; the full item comes back blank. unit_rate's find-the-rate item has no simplify (any easier find-the-rate on the same lines has the same answer). Starting positions are the existing tier's aids; they are not pulls.
- **Evidence:** `doubleNumberLineLevers.test.ts`, `DoubleNumberLine.levers.workspace.test.tsx`; sweep J9/J12/J13 0 findings (`qa/eval-reports/double-number-line-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding and levers, C15).
