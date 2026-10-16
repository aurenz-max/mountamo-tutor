# Contract: tape-diagram

- **Derived:** 2026-10-14, from the item-space slice (partial: the item-space path and the comparison prompt only; run `/primitive-contract tape-diagram` for the full derivation).
- **Component:** `src/components/lumina/primitives/visual-primitives/math/TapeDiagram.tsx` · **Generator:** `src/components/lumina/service/math/gemini-tape-diagram.ts` · **Item-space adapter:** `service/math/tapeDiagramItemSpace.ts`
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| G1-G3 comparison word problems (solve_comparison) with a lesson tier or Pulse | item space compare-20 / compare-100 | `scripts/difficulty-lab/tier-probe.mjs --component tape-diagram --mode solve_comparison` | 2026-10-14 |
| Four eval modes (represent, solve_part_whole, solve_comparison, multi_step) | catalog + generator own path | same probe, no-tier runs | 2026-10-14 |
| G1-G2 two-step word problems (multi_step) with a tier | item space add-sub-20 (two-step items) | `tier-probe.mjs --component tape-diagram --mode multi_step --grade 1` | 2026-10-16 |

## Requirements

### R1 — solve_comparison with a tier takes its problems from the compare space
- With `config.difficulty` set, no remediation focus, and an objective the resolver fits to compare-20 (grade 1-2) or compare-100 (grade 2-3), code picks every problem (`tierPick`); the tier's forced unknown (`resolveProblemShape`) does not run. One flash-lite call writes the stories and bar labels; `comparisonStoryFits` rejects a story that drops or adds a number, states the answer, lacks the item's relational word ("more"/"fewer"), does not ask, or does not name both bar owners, and the space's plain story replaces it. Bar 1 is always the larger amount, bar 2 the smaller; `unknownPart` difference / quantity1 / quantity2. Each challenge carries `itemSpace` {space, structure, beta}, never rendered or sent to the tutor. Scaffolds (`hideNonAnswerValue`, `showKnownValues`) still follow the tier.
- No tier, a remediation focus, or no fitting strand keeps the own path. Probe: `service/math/tapeDiagramItemSpace.test.ts`, the tier probe above.

### R2 — the comparison prompt asks "fewer" of the smaller bar
- A difference-unknown problem worded with "fewer" asks "How many fewer does the second group have?"; "more" asks of the first group. Bar 2 is always the smaller amount.

### R3 — multi_step draws one part-whole bar per step
- Each step is its own bar: adding puts the start and the change side by side with the result as the bar's `whole` (unknown) under them; taking away puts the start as the `whole` and the part taken beside the part left (unknown). Each later bar starts from the previous result (`carriedFromStep`), shown only after that step is solved. `multiStepData.steps` names each step's bar and unknown (`-1` = the whole). No bar carries a "Total = N" over the chain. Code computes every intermediate and the answer from the start and each step's operation and number; the model never states a result.
- With a tier and an objective the resolver fits to add-sub-20 (grades K-2), the space's two-step items fill the session (code picks, flash-lite writes the story; `multiStepStoryFits` rejects a story that states an intermediate or the answer). Otherwise the own path (2 steps, 3 at hard). Probe: `service/math/tapeDiagramItemSpace.test.ts`, the oracle's multi_step chain check, `tier-probe.mjs --component tape-diagram --mode multi_step`.

## History
- 2026-10-16 — R3 (8.1a). Before: one bar held start, change, intermediate and answer as four parts under "Total = 37" for 8 + 6 - 5, the schema never stored step 2's number, and the oracle passed it because the label matched the bar's sum.
- 2026-10-14 — derived with R1, R2. Before: every tier and run converged ("15 shells vs 9"), "within 100" never went above 20, and the tier forced hard = larger unknown with "more" (the consistent, easier form), so the inconsistent-language problems never appeared.
