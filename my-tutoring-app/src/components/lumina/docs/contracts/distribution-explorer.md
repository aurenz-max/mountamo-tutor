# distribution-explorer — primitive contract

Component `primitives/DistributionExplorer.tsx` (with `primitives/distribution-explorer/*`), generator
`service/distribution-explorer/orchestrator.ts`. Modes: `explore`, `identify`, `compute_basic`, `compute_advanced`
(compute + predict_shape). First written 2026-10-09 at the workspace binding (W1, batch C19).

## Requirements

### R1 — no answer on the workbench while an item is open
- **identify:** while an identify item is unchecked, the workbench names no family: the plot is titled "Mystery
  distribution", the family picker and sliders are replaced by a note, the formula and description are hidden (both
  paths). Before 2026-10-09 the 10-09 payload mounted Binomial with "Binomial PMF", its formula and `n (trials)` on
  screen beside "which family models the count of defaults?" (answer: binomial).
- **compute:** while a compute item is unchecked, the moment readout (mean, variance, sd, skewness) and the chart's hover
  value readout are hidden (both paths). The 10-09 compute_basic payload mounted Poisson λ = 4 with "Mean μ 4" printed
  beside "find E[X]".
- **Probe:** `DistributionExplorer.workspace.test.tsx` "identify hides the family…".

### R2 — the activity checks every answer (workspace path)
- The check is `distributionCorrect` (`distributionExplorerWorkspace.ts`); the tutor gets no `correctFamily`,
  `correctValue`, `acceptableAnswers` or rationale. A wrong check shows neither the rationale nor the key and reopens on
  Try again with the pick cleared. Explore's Got it is credited only after a slider moved or the family changed on that
  prompt (the scripted path still credits Got it as before).
- Misses: `distributionMiss` → `DISTRIBUTION_MISSES_BY_MODE` (catalog `teachingWorkspace.misses`).
- **Probe:** `DistributionExplorer.workspace.test.tsx`, journey sweep J1-J13 on `w1-payloads/distribution-explorer.*`.

### R3 — levers never print the key
- `distributionExplorerLevers.ts`: `slider_glow`, `family_facts` (the same kind of fact under every choice, no family
  name), `event_strip` (whole counts only), `worked_model` (other parameter values; no number that is one of the
  item's choices unless the item's own words print it), simplify `two_families` / `simpler_compute` / `two_shapes`
  (practice items `~simpler`, never the item, never its answer or its choices, the asked family or shape differs).
- **Probe:** `distributionExplorerLevers.test.ts`, `DistributionExplorer.levers.workspace.test.tsx`, sweep J12/J13.

## Open
- **G1 — explore is credited for movement, not the observation.** The prompt's question has no checked answer; the
  learner's spoken observation is not judged. A checked explore task (set the sliders to a stated property) is
  `/add-eval-modes` work.
- **G2 — catalog `constraints` says compute is "numeric input with tolerance" and predict_shape "free-text or MCQ";
  both are MCQ.** Left as is (not made false by the binding).
- **G3 — the scripted path submits no evaluation** (it never did); only the workspace path submits, under a lesson's
  evaluation provider. Needs a `/student-data-loop` ruling before the scripted path records.

## History
- 2026-10-09 — created at W1 + levers (batch C19). R1 added (both paths).
