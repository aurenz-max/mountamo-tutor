# Contract: equation-builder

- **Derived:** 2026-09-29 (static, as the contract-first step of handoff 28 row 5, RP-4) · evidence window: catalog, generator,
  workspace, oracle, w1 payloads, tests to 2026-09-29. No census run.
- **Component:** `primitives/visual-primitives/math/EquationBuilder.tsx` + `equationBuilderWorkspace.ts` · **Generator:**
  `service/math/gemini-equation-builder.ts` · **Oracle:** `service/qa/oracles/equation-builder.ts` · **Catalog:**
  `service/manifest/catalog/math.ts` (`equation-builder`) · **Boss:** `equationBuilder.card.ts` + `equationBuilder.boss.ts`
  (levers: `EQUATION_BUILDER_LEVERS` in `equationBuilderLevers.ts`)
- **Status:** ACTIVE (no open conflicts)

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-2 equation understanding: build-simple, missing-result, true-false, missing-operand, balance-both-sides, rewrite | catalog evalModes | `math.ts` entry | live |
| Shared teaching workspace (one checked gesture per challenge) | code + sweep | `equationBuilderWorkspace.ts`, `EquationBuilder.workspace.test.tsx`, w1 payloads | 2026-09-29 |
| K-2 composing a total (K.OA.3, 1.OA.6): make-n open build | catalog evalModes | `math.ts` entry, `equationBuilderLevers.ts` | 2026-10-07 |

## Requirements

### R1 — every key is computed by code, never taken from the model · OBSERVED
- **Property:** true-false `isTrue` is computed from `displayEquation`; build and rewrite targets are rejected unless true; every
  rewrite accepted form is true; missing-value and balance answers are solved in code. Equation strings are normalized to an
  ASCII `-` at ingest, so a Unicode minus or en dash cannot mis-key a statement or reject a true target.
- **Demanded by:** all modes (rule #1).
- **Evidence:** `validateTrueFalse` ("never trust Gemini"), `validateBuild`, `validateRewrite`; `gemini-equation-builder.minus.test.ts`.
- **Probe:** `npm test -- gemini-equation-builder.minus`; eval-test each mode, recompute every key.

### R2 — the palette holds every needed tile · OBSERVED
- **Property:** build/rewrite tiles are derived from the target/accepted forms (EB-2), then distractors are added by tier.
- **Demanded by:** build-simple, rewrite.
- **Evidence:** `validateBuild` / `validateRewrite` tile derivation; oracle.
- **Probe:** every target token is in `availableTiles`.

### R3 — the builder's check accepts every correct form and only those · OBSERVED
- **Property:** build accepts the target or the same tiles in another true order ("5 = 2 + 3"); rewrite accepts only its
  accepted forms; a row with `−` is judged by value like `-`.
- **Demanded by:** build-simple, rewrite.
- **Evidence:** `buildMatches`, `matchesAcceptedForm`; `equationBuilderWorkspace.test.ts`.
- **Probe:** `npm test -- equationBuilderWorkspace`.

### R4 — no key reaches the tutor · OBSERVED
- **Property:** every challenge is a gesture checked by the builder; the assignment publishes no expected answer.
- **Demanded by:** workspace consumer.
- **Evidence:** `equationBuilderBoss.assignment` (`bossAssignment`, no key); `EquationBuilder.workspace.test.tsx`.
- **Probe:** `npm test -- EquationBuilder.workspace`.

### R5 — make-n accepts every sentence that makes the total, and nothing that only names it · OBSERVED
- **Property:** a fork, not an edit: a new `make-n` challenge type with its own check (`makeNMiss`). The row is read as
  number (sign number)+ by integer arithmetic; any such row equal to `target` passes; the total alone (`bare_number`)
  and a malformed row (`unfinished_sentence`) do not; on a two-way item the second must differ (`same_way`: the same
  numbers added in any order). Code owns the total, the bank and the instruction. Try again keeps the row. The scene
  publishes the row and `tilesPlaced` / `numbersPlaced`, never the row's value. R2 and R3 do not apply to it (no
  target equation; the bank is unlimited). The other modes are unchanged.
- **Demanded by:** make-n.
- **Evidence:** `EquationBuilder.workspace.test.tsx` (make-n block), `equationBuilderLevers.test.ts`, oracle make-n branch,
  qa/open-build/equation-builder-2026-10-07.
- **Probe:** `npm test -- EquationBuilder.workspace equationBuilderLevers`; `node scripts/equation-builder-make-n-probe.mjs --run`.

### R6 — levers on the six other modes never state the answer, and practice is ungraded · OBSERVED
- **Property:** `equationBuilderLevers.ts`. Help levers draw what is printed or placed, never a side's value: `printed_dots`
  (none under the ?), `number_dots` (the learner's row only), `equation_frame` (no number or sign, `frameLeaks`),
  `rewrite_model` (numbers the item does not use, not an accepted form, `rewriteModelLeaks`), `match_marks` (numbers only).
  `smaller_numbers` opens a `~smaller` practice item of the same type and sign (`practiceItem`): never the item's numbers
  (`repeatsItem`), never the item's missing number, ungraded; the full item comes back blank and only it is credited, with
  the levers on the attempt. Easy starts the dots shown, not recorded as a pull. R1-R5 unchanged.
- **Demanded by:** build-simple, missing-result, true-false, missing-operand, balance-both-sides, rewrite.
- **Evidence:** `equationBuilderLevers.test.ts` (six-mode block), `EquationBuilder.levers.workspace.test.tsx`.
- **Probe:** `npm test -- equationBuilderLevers EquationBuilder.levers.workspace`.

## Conflicts

None.

## Changelog

- 2026-10-13 (later) — `/add-item-space`, balance-both-sides wired to the new `equivalence-20` space
  (`service/itemSpace/equivalence20.ts`). Before: every tier gave the same kind of item (a two-number sum on each side,
  15 − 5 recurring); the tier changed only the instruction. Now, with a tier and a lesson the resolver fits to
  equivalence-20, code picks each equation: the reversed form (12 = 5 + ?) and an operation on both sides
  (8 + 4 = ? + 5, 13 − 5 = 6 + ?, 6 + 4 = ? − 8); never the standard a ± b = ? (missing-result's task). Every printed
  number, the known side's total and the box stay within the lesson's maxNumber; no minus unless the lesson subtracts.
  The key is still solved by `validateBalance` and must equal the space's answer (R1). The instruction names no number;
  the tier's hint tone still applies. `itemSpace` is stamped, never rendered or sent to the tutor (R4). The balance
  practice lever (R6) handles every form the space draws with `+` on the box side, and returns no practice item for a
  `? − k` box, as before. Pins `equationBuilderItemSpace.test.ts` (balance block); probe
  `qa/difficulty-demo/2026-10-13/eb/after-balance-both-sides.txt`.

- 2026-10-13 — `/add-item-space`, all seven modes measured (`qa/difficulty-demo/2026-10-13/eb/`). Before: every tier
  and most runs gave the same equations (5 + 3, 12 − 5, 6 + ? = 10, 14 − ? = 8); the tier moved only the option
  count and spread. Now:
  - missing-result, missing-operand, true-false: with a tier and a lesson the resolver fits to add-sub-20, code
    picks each fact at the tier's band (`equationBuilderItemSpace.ts`): one step, every number within the lesson's
    window (explicit maxNumber, else the objective's window, else K 5 / Grade 1 10 / Grade 2 20), addition only at
    K or when the lesson names it. missing-operand takes the change or start unknown as the space chose it. Options
    are the space's mistakes at the tier's count and spread (R1 holds: the key is computed). true-false alternates
    true and false from a random start; a false claim is a far wrong answer at easy, a near one (a known mistake)
    otherwise. The LLM's instruction is kept only when it names no number. A failed wording call ships code
    instructions. Each challenge carries `itemSpace`, never rendered or sent to the tutor (R4 holds).
  - When a scope holds too few items for three tiers (addition within 5), no tier uses the space (`tierPick`).
  - Own-path fix: a missing-value equation or answer outside 0..maxNumber is rejected ("8 + ? = 23" shipped in a
    within-20 lesson).
  - Not a fit: build-simple (copying an equation; its tier lever, the distractor tile count, already changes the
    task; its numbers still converge across runs, a variety defect for `/add-number-pool-service`), rewrite (the
    demand is the transformation, not the fact), balance-both-sides (a + b = c + ? is not in add-sub-20; it
    converges too, 15 − 5 in most runs: a candidate equivalence space, built later the same day), make-n (totals are code-owned; the tier
    sets the second way).
  Pins `equationBuilderItemSpace.test.ts`.

- 2026-09-29 — derived (static, initial) for handoff 28 row 5. 4 requirements, 0 conflicts. Same day, RP-4: ingest normalizes
  the minus sign (R1) and the checker judges a `−` row by value (R3). `--check` **COMPATIBLE**: equation-builder vitest 36/36,
  eval-test all six modes at G1 (30 challenges, every key recomputes, no Unicode minus left), journey sweep green.
- 2026-10-07 — make-n (open build) added as a fork (R5); R1-R4 untouched. Existing equation-builder tests and the
  live-activity suite green; the other modes' Try again still clears the row.
- 2026-10-09 — R6: levers on the six other modes (`/add-support-tiers`). Edit is additive; R1-R5 tests green (80/80).
- 2026-10-20 — moved onto a boss (wave 3): `equationBuilder.card.ts` + `equationBuilder.boss.ts` replace
  `adapters/equationBuilderLive.ts` and the catalog guidance/tutoring blocks; levers are one lever set (`rewrite_model` is now a
  `model` lever, so the item's `supportTier` says when it comes); Pip from the runner. R1-R6 unchanged; equation-builder
  tests green. Catalog affordances: missing-result/missing-operand `tap`, balance-both-sides `type` (what the screen takes).
