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

## Gaps (open)

- **G1 — `build` builds nothing.** The ask says "Build 5 groups of 2", but the groups are pre-drawn; the learner types
  the product, as on connect. A real build (place groups) is a new interaction → `/add-eval-modes` or an open-build mode.
- **G2 — the break-apart split can disagree with the ask.** The display splits factor1 as `min(5, a-1) + rest`; the
  generated distributive ask names its own split ("2 × 7 and 2 × 7" for 4 × 7 while the display shows 3 × 7 + 1 × 7).
  Path: stamp the split in the generator and render it → `/eval-fix`.
