# Contract: regrouping-workbench

- **Derived:** 2026-10-09 (W1 binding + levers, batch C12) · evidence: git log to `ae5f83bc`, oracle
  `service/qa/oracles/regrouping-workbench.ts`, W1 payloads 2026-10-09
- **Component:** `primitives/visual-primitives/math/RegroupingWorkbench.tsx` · **Domain:** `regroupingWorkbenchWorkspace.ts`,
  `regroupingWorkbenchLevers.ts` · **Generator:** `service/math/gemini-regrouping-workbench.ts` · **Catalog:** `catalog/math.ts`
- **Modes:** `add_no_regroup` (β1.5), `subtract_no_regroup` (β2.5), `add_regroup` (β3.5), `subtract_regroup` (β4.5). The
  component grades on the session `operation` with operands parsed from each `problem` string.

## Requirements

### R1 — the blocks never print the answer · OBSERVED (restored 2026-10-09)
- **Property:** the blocks start as the problem's own blocks: both numbers together per column for addition (27 + 45 is
  12 ones, 6 tens), the top number for subtraction. They change only by the learner's Carry/Borrow trades.
- **Evidence:** `dbfd66c8` (2026-03-15) set the blocks to the result's digits ("so students see the result in blocks"),
  so every problem displayed its own answer and Carry never had ten ones to trade. Restored to the original design.
- **Probe:** `RegroupingWorkbench.workspace.test.tsx` (blocks fact `tens 6, ones 12`; borrow across a zero).

### R2 — a wrong check never states the right number · OBSERVED
- **Property:** wrong feedback is "Your answer is N. Not quite. Check each column again." (it printed the correct answer
  before 2026-10-09). The generated `hint` (can carry a column sum) shows only on the scripted path.

### R3 — shared teaching workspace, W1 plain shape · OBSERVED
- **Property:** `withWorkspaceController`; the typed digits are checked by `regroupingMatches` (empty box = 0, the rule
  since birth); no key in the packet; misses from `regroupMiss`: left_blank, wrong_operation, no_carry,
  smaller_from_larger, forgot_to_reduce, misplaced_digits, column_slip, other_answer (per mode in the catalog). Try again
  clears the typed digits and keeps the trades (never checked).
- **Probe:** workspace test, journey sweep on `w1-payloads/regrouping-workbench.*.json`.

### R4 — levers leave the answer to the learner · OBSERVED
- **Property:** help levers carry no digit (`leverTextLeaks`); `regroup_marks` is the tier's own mark, offered only where the
  session hides it and refused once no column needs a trade; `trade_model` and `operation_model` are pictures outside the
  item; `column_colors` adds colour and place names. `smaller_problem` shares no operand or result with the item, keeps the
  mode (a trade where the item has one, none otherwise), is strictly smaller, and is ungraded.
- **Probe:** `regroupingWorkbenchLevers.test.ts`, `RegroupingWorkbench.levers.workspace.test.tsx`, sweep J12/J13.

### R5 — support tiers set starting positions · OBSERVED
- **Property:** the generator's tiers (`showRegroupHints`, `showPlaceColumns`, `showColumnBadges`, operand re-selection) are
  unchanged; easy's regroup marks are the `regroup_marks` lever already pulled (not recorded as a pull).

## Gaps

- **G1 — payload numbers repeat the prompt's examples** (27 + 45, 38 + 24, 23 + 14, 31 + 42, 52 − 17 in the 2026-10-09
  payloads). Path: `/add-number-pool-service`.
- **G2 — after the trades, the block counts read as the answer's digits.** By design (the learner made the trades, then
  connects blocks to the written digits), but at the hard tier the count under each column could be withdrawn. Ruling owed.

## Changelog
- 2026-10-09 — derived; W1 binding, R1 restored, R2 fixed on both paths, levers (R4).
