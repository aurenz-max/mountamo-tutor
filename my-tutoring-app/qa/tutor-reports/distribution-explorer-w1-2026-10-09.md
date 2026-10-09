# distribution-explorer — W1 workspace binding (plain shape), 2026-10-09

Batch C19. All four catalog modes bound through `withWorkspaceController` (`useScriptedProgress` /
`useWorkspaceProgressFor`). The component had its own index and no `useChallengeProgress`; it now runs on the
controller, and the choice state moved out of `ChallengeStrip` into the surface so the scene can describe it.

## Modes and what code checks

| Mode | Item | Check (`distributionExplorerWorkspace.ts`) | Misses |
|---|---|---|---|
| explore | guided exploration, Got it | a slider moved or the family changed since the prompt opened | `not_explored` |
| identify | tap a family, Check | `correctFamily` | `discrete_continuous`, `binomial_poisson` |
| compute_basic | tap one of four values, Check | `correctValue` | `complement`, `reciprocal`, `near_value`, `wrong_value` |
| compute_advanced | compute + predict_shape | as above; shape against `acceptableAnswers` | + `reversed_skew`, `said_symmetric`, `wrong_shape` |

Gesture items only; no `expectedAnswer`. Choice order is a pure seeded shuffle (`distributionChoices`), shared by the
component and the journey row. The adapter refuses an item with no single credited choice or two choices that format
alike.

## Fixed on both paths (answers on screen)
- **identify printed its answer:** the 10-09 payload mounts Binomial ("Binomial PMF", its formula, `n (trials)`)
  beside "which family models the count of defaults?" (binomial). While identify is unchecked the workbench now names
  no family.
- **compute_basic printed its answer:** Poisson λ = 4 mounted with "Mean μ 4" beside "find E[X]"; the chart tooltip gave
  P(X = 0). While a compute item is unchecked the moments panel and the hover readout are hidden.
- A wrong check no longer shows the rationale or marks the key (workspace path; the scripted path is unchanged).

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- `DistributionExplorer.workspace.test.tsx` 9/9.
- `workspaceContract`, `journeySweep`, `misses`, `lessonWorkspacePlan`, `activityContract`, `ExhibitWorkspaces.surface`,
  `sourceControlBytes`, `oracles`: 8 files, 3672 passed. Sweep on 4 payloads, 9 items: 0 findings (J1-J13), 9/9 misses
  named; J10 clean 100, J11 recover 67.

## Tutor replay (4 payloads x 5 samples)
- r1 (`replay/distribution-explorer-2026-10-09.json`): 1/20 `stuck no_fix_before_try` (explore). Read by hand: explore
  stuck replies said "what happens when p is right in the middle at 0.5?" (the observation's answer), and compute_basic
  stuck replies said "the expected value is simply λ; what λ does the problem give?" (a one-formula item answered).
- Guidance fixed once: on explore say which slider, never what the chart will do; when one formula is the whole item,
  stating it is the answer.
- r2 (`-r2.json`): 0 misses. Explore now names the slider only; compute_basic asks which formula fits. One explore
  reply said Got it "will unlock" (it is never locked).

## Undriven
None: every mode runs through its real controls (choice button by aria-label + Check; explore writes the first slider
read from the scene's `workbench` fact, then Got it).

## Open findings
- Explore is credited for movement, not for the observation (contract G1): `/add-eval-modes` for a checked explore task.
- The scripted path submits no evaluation (never did; contract G3): `/student-data-loop` ruling.
- Catalog `constraints` describes compute and predict_shape as typed/free text; both are MCQ (G2).
- compute_advanced c-2 (payload) is labelled conditional but is a plain P(X ≥ 2): generator, `/eval-fix`.
- Needs a browser check on the hidden-family identify view and the hidden-moments compute view.
