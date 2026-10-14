# Contract: multiplication-explorer

- **Derived:** 2026-10-09 (workspace binding, batch C15) · evidence: W1 payloads, `MultiplicationExplorer.workspace.test.tsx`,
  `__tests__/MultiplicationExplorer.per-challenge-fact.test.tsx`, oracle `service/qa/oracles/multiplication-explorer.ts`
- **Component:** `primitives/visual-primitives/math/MultiplicationExplorer.tsx` · **Domain:** `multiplicationExplorerWorkspace.ts` ·
  **Generator:** `service/math/gemini-multiplication-explorer.ts` · **Catalog:** `service/manifest/catalog/math.ts`
- **Modes:** `build` β1.5 · `connect` β2.5 · `commutative` β3.5 · `distributive` β4.5 · `missing_factor` β5.5 · `fluency` β6.5.
  Every mode is one typed number checked by `multiplicationAnswerCorrect`.

## Requirements

### R1 — one fact per challenge, drawn, asked and judged from the same source · OBSERVED
- `resolveChallengeFact` (challenge `fact` → parsed `targetFact` → session fact) feeds the equation, every panel and the
  check. Probe: `MultiplicationExplorer.per-challenge-fact.test.tsx`.

### R2 — the asked value is the type's · OBSERVED (2026-10-09)
- The generator stamps `hiddenValue`: `missing_factor` hides `factor1` or `factor2`, every other type `product`. Before,
  connect and commutative shipped `null` while the check graded the product, so the `showProduct` leak guard read
  "nothing hidden" and the product readout could be on. The live adapter rejects a missing factor that hides no factor.

### R3 — the open item never shows its answer · OBSERVED (2026-10-09)
- The equation prints the asked value as `?`. The panels are not drawn on `missing_factor` (a factor's groups, rows or
  jumps are the answer) or on `fluency` (recall; a countable array turns it into counting) (`modelShown`). The product
  readouts, the number line's landing label, the break-apart sum and the fact family wait until the item is solved.
  The flip button is off on a missing factor (its label prints the factor). An instruction or hint that names the answer,
  in digits or words, is replaced by code wording (`askFor`, `hintFor`). Missing-factor sessions draw no square fact
  (`? × 6 = 36` prints its own answer), while enough other facts remain. Probe: workspace test, journey sweep J3.

### R4 — shared teaching workspace, W1 plain shape · OBSERVED (2026-10-09)
- `withWorkspaceController`; the typed answer commits through `progress.commitCheck` with `multiplicationMiss`; Next,
  Submit Results and the score line are scripted-path only; scripted cues are muted on the workspace path. Misses:
  product modes `added_factors`, `one_group_short`, `one_group_over`, `off_by_one`, `other_product` (+ `one_part_only`
  on distributive); missing_factor `gave_product`, `gave_known_factor`, `subtracted`, `one_jump_off`, `other_factor`.
  Probe: `MultiplicationExplorer.workspace.test.tsx`, journey sweep on six payloads, tutor replay.

### R5 — every mode's levers leave the answer to the learner · OBSERVED (2026-10-09)
- `multiplicationExplorerLevers.ts`. Product modes: `skip_strip` (one box per group, running totals stop one group short,
  the last shows `?`), `show_model` on fluency (the array, no total), `break_apart` on distributive (both partial products,
  sum `?`; not offered while the learner's own break-apart is open). missing_factor: `skip_line` (jumps of the shown factor
  from 0, two past the product; only 0 and the product labelled). `smaller_fact` (simplify) in every mode: one factor about
  halved (the hidden one on a missing factor), never the item, its turnaround, product or answer, no square; ungraded, the
  full item returns blank. None on 2 × 2 or a hidden factor of 2. No lever starts pulled from the tier. Leak rules are
  code (`leverNumbers`, `practiceLeaks`), tested over every fact in the 3-4 band. Probe: `multiplicationExplorerLevers.test.ts`,
  `MultiplicationExplorer.levers.workspace.test.tsx`, sweep J12/J13.

### R6 — a tier on a fitting strand picks the facts; grade 3 reaches 10 × 10 · OBSERVED (2026-10-13)
- With `config.difficulty`, one pinned mode, and a lesson the resolver fits to `mult-div-facts`, each challenge's fact
  comes from the item space at the tier's beta band (`multiplicationExplorerItemSpace.ts`): easy = a factor of 2, 5 or
  10 or a small tie, hard = both factors 6-9. Product modes take product-unknown items; `missing_factor` takes the
  item's hidden slot, never a square (R3). A pinned factor stays in its slot; two pins keep `selectFacts`. Each
  challenge carries `itemSpace` {space, structure, beta}, never rendered or sent to the tutor. The tier still sets the
  scaffolding. No tier, a mixed session, or no fitting strand → `selectFacts`, uniform over the band.
- Grade 3 draws factors 2-10 with products to 100 (`GRADE_3_FACTS`); the `2-3` band's cap of 50 is grade 2's and had
  kept 7 × 8 out of every grade-3 session. `config.gradeBand` still overrides.
- Probe: `scripts/difficulty-lab/mx-tier-wiring-probe.mjs --mode fluency|missing_factor|build`
  (`qa/difficulty-demo/2026-10-13/mx-*-probe.txt`); pins `multiplicationExplorerItemSpace.test.ts`.

## Gaps (open)

- **G1 — `build` builds nothing.** The ask says "Build 5 groups of 2", but the groups are pre-drawn; the learner types
  the product, as on connect. A real build (place groups) is a new interaction → `/add-eval-modes` or an open-build mode.
- **G2 — the break-apart split can disagree with the ask.** The display splits factor1 as `min(5, a-1) + rest`; the
  generated distributive ask names its own split ("2 × 7 and 2 × 7" for 4 × 7 while the display shows 3 × 7 + 1 × 7).
  Path: stamp the split in the generator and render it → `/eval-fix`.

## Changelog

- 2026-10-13 — `/add-item-space`: R6 added. The tier never changed the fact (uniform `selectFacts`), so easy and hard
  drew from one pool; with a tier the facts now come from `mult-div-facts`. Grade-3 fact band lifted to 10 × 10 (a cap
  below the objective). R1-R5 hold: facts are still stamped per challenge by code, `hiddenValue` is the item's slot,
  missing-factor squares excluded, leak guards unchanged. Compatible.
- 2026-10-13 — all six modes probed per tier (`mx-<mode>-probe.txt`): build, connect, commutative, distributive and
  fluency share the product path, missing_factor the hidden-factor path; every mode separates (easy 3×2, 5×5, 10×4;
  hard 7×9, 8×7, 9×8). Commutative asks written as "if 7 × 8 is 56, what is 8 × 7?" state the product; `askFor`
  replaces them with code wording (R3). A grade band that cannot fill every tier (the 2-3 band, products to 50)
  now uses thirds of its facts (`tierPick`).
