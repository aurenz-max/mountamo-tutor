# Contract: regrouping-workbench

- **Derived:** 2026-10-09 (W1 binding + levers, batch C12) · evidence: git log to `ae5f83bc`, oracle
  `service/qa/oracles/regrouping-workbench.ts`, W1 payloads 2026-10-09
- **Component:** `primitives/visual-primitives/math/RegroupingWorkbench.tsx` · **Domain:** `regroupingWorkbenchWorkspace.ts`,
  `regroupingWorkbenchLevers.ts` · **Boss:** `regroupingWorkbench.card.ts` + `regroupingWorkbench.boss.ts` · **Generator:**
  `service/math/gemini-regrouping-workbench.ts` · **Catalog:** `catalog/math.ts`
- **Modes:** `add_no_regroup` (β1.5), `subtract_no_regroup` (β2.5), `add_regroup` (β3.5), `subtract_regroup` (β4.5). The
  component grades on the session `operation` with operands parsed from each `problem` string.

## Requirements

### R1 — the blocks never print the answer · OBSERVED (restored 2026-10-09, re-based 2026-10-27)
- **Property:** each column starts with the top number's blocks and the bottom number's blocks beside it (`pending`).
  The blocks change only by the learner's work: Put together (addition) / Take away (subtraction, refused while the
  column holds too few) and Carry/Borrow trades. A settled column (nothing pending, no trade needed) prints no count;
  the learner counts its blocks (easy's column badge is the tier's aid).
- **Re-based 2026-10-27:** the 10-09 start (both numbers together per column) printed the answer on every no-regroup
  item (24 + 12 opened as 3 tens, 6 ones, each with its numeral): all of OPS002-01-a and OPS002-02-a (G2 design review).
- **Evidence:** `dbfd66c8` (2026-03-15) set the blocks to the result's digits ("so students see the result in blocks"),
  so every problem displayed its own answer and Carry never had ten ones to trade. Restored to the original design.
- **Probe:** `RegroupingWorkbench.workspace.test.tsx` (24 + 12 opens with 4 ones and 2 tens drawn; 52 − 27 refuses Take
  away before the borrow; borrow across a zero); browser drive `qa/curriculum-design-review/math-g2-2026-10-27/verify/rw-*.png`.

### R2 — a wrong check never states the right number · OBSERVED
- **Property:** wrong feedback is "Your answer is N. Not quite. Check each column again." (it printed the correct answer
  before 2026-10-09). The generated `hint` (can carry a column sum) is never shown (the scripted path is gone).

### R3 — shared teaching workspace, W1 plain shape · OBSERVED
- **Property:** `withWorkspaceOnly`; the typed digits are checked by `regroupingMatches` (empty box = 0, the rule
  since birth); the blocks never gate the check, but each correct result records `blocksModelled` (blocks ended at the
  answer) and the session metric `modelledCorrect`, and the learner's work names unused blocks; no key in the packet; misses from `regroupMiss`: left_blank, wrong_operation, no_carry,
  smaller_from_larger, forgot_to_reduce, misplaced_digits, column_slip, other_answer (per mode in the catalog). Try again
  clears the typed digits and keeps the trades (never checked).
- **Probe:** workspace test, journey sweep on `w1-payloads/regrouping-workbench.*.json`.

### R4 — levers leave the answer to the learner · OBSERVED
- **Property:** one lever set (`REGROUP_LEVERS`); an item's mode is its structure (`modeOf`). Help levers carry no digit
  (`leverTextLeaks`); `regroup_marks` is the tier's own mark, offered only where the session hides it and while a column
  still needs a trade; `trade_model` and `operation_model` are pictures outside the
  item; `column_colors` adds colour and place names. `smaller_problem` shares no operand or result with the item, keeps the
  mode (a trade where the item has one, none otherwise), is strictly smaller, and is ungraded.
- **Probe:** `regroupingWorkbenchLevers.test.ts`, `RegroupingWorkbench.levers.workspace.test.tsx`, sweep J12/J13.

### R5 — support tiers set starting positions · OBSERVED
- **Property:** the generator's tiers (`showRegroupHints`, `showPlaceColumns`, `showColumnBadges`, operand re-selection) are
  unchanged; easy's regroup marks are the `regroup_marks` lever already pulled (not recorded as a pull).

### R6 — the problems are the objective's shape · OBSERVED (NEW 2026-10-27)
- **Property:** a single pinned mode keeps only problems of its structure on every path (the no-tier LLM path drops a
  borrow in subtract_no_regroup, falling back to the item space); both numbers are two-digit at every tier unless the
  lesson names a one-digit number (`lessonAllowsOneDigit`).
- **Demanded by:** OPS002-01-a, OPS002-02-a ("two two-digit numbers"); G1 lessons that name one-digit keep it.
- **Probe:** `qa/curriculum-design-review/math-g2-2026-10-27/verify/regrouping-workbench.json` (12 sessions, 3 objectives ×
  easy/medium/hard/none: every problem two-digit ± two-digit and in its mode).

## Gaps

- **G1 — payload numbers repeat the prompt's examples** (27 + 45, 38 + 24, 23 + 14, 31 + 42, 52 − 17 in the 2026-10-09
  payloads). Path: `/add-number-pool-service`.
- **G2 — after the trades, the block counts read as the answer's digits.** By design (the learner made the trades, then
  connects blocks to the written digits), but at the hard tier the count under each column could be withdrawn. Ruling owed.

## Changelog

- 2026-10-27 — G2 design review repair (brief 3): R1 re-based (separate addend blocks, Put together / Take away, settled
  columns print no count), R3 records `blocksModelled`, R6 added. Levers: addition's "needs a trade" counts pending
  blocks so the marks lever is offered before the ones are joined. R2, R4, R5 unchanged.

- 2026-10-20 — moved onto a boss (wave 3): card + bespoke `defineBoss`, levers as a lever set (column_colors marks,
  operation_model meaning, regroup_marks marks, trade_model model with per-item tier support, smaller_problem easier),
  workspace-only export; the scripted path (useLuminaAI cues, Next, hint panel), hand-wired Pip, the adapter and the
  catalog guidance/tutoring prose deleted. The regroup-marks pull refusal is now an offer condition. R1-R5 unchanged.
- 2026-10-13 — `/add-item-space`, all four modes wired (`qa/difficulty-demo/2026-10-13/rw/`). Before: add_regroup gave
  27 + 45, 38 + 24, 19 + 36 in 12 of 12 runs at every tier; the code lever capped a 2-digit problem at one regroup
  (hard = easy), and a Grade-3 "within 1000" lesson drew 2-digit problems because the LLM set maxPlace. Now, with a
  tier and a lesson the resolver fits to add-sub-100 or add-sub-1000, code picks each problem at the tier's band
  (`regroupingWorkbenchItemSpace.ts`): the mode fixes the operation and whether a column regroups; the tier moves
  regroup count, chains, borrows across a zero, a one-digit or two-digit second number. maxPlace follows the strand.
  Hints, narration and the word-problem story are code-written or dropped on this path (they named the LLM's numbers).
  The structural operand lever does not run on this path; with no tier, output is unchanged. Weak: within 100 the
  only two-carry sums land on 100, so add_regroup hard is all make-100. Pins `regroupingWorkbenchItemSpace.test.ts`.
- 2026-10-09 — derived; W1 binding, R1 restored, R2 fixed on both paths, levers (R4).
