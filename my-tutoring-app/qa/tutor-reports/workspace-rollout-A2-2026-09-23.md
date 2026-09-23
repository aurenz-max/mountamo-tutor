# Workspace rollout batch A2: number-line, comparison-builder, number-tracer at W1 — the plain shape (2026-09-23)

Queue: [ROLLOUT.md](../workspace-rollout/ROLLOUT.md) · Executor: `/add-live-tutor-tools`, "W1 minimal binding",
"Plain shape (P)". These were the last three live adapters not on the workspace: every live adapter is now
catalog-declared, and the tool-lab path (`canAdvance: true`, tutor advance commands) has no family left.

## The plain shape

A primitive with its own Check and Next and no judged runner. 74 primitives track progress with
`useChallengeProgress`; `runtime/useWorkspaceProgress.ts` returns the same shape backed by the shared
workspace, chosen at the component boundary by `withWorkspaceController` as in the runner-era recipe.
The primitive's own check reports every verdict through `commitCheck` (a checked gesture), the runtime moves
the index, its Next button hides, its scripted cues and legacy AI context are off, its tool-lab runtime mount
is not registered (`usePrimitiveRuntime(null)`), and it submits an evaluation only under a provider.

| Primitive | Check | Code | Smoke (`--lesson-entry --progression-only`) |
|---|---|---|---|
| number-line (pilot) | one Check | domain 45 lines, component +~70 | `jump` FAIL (evaluation submitted in the live host) → PASS |
| comparison-builder | four check functions, K taps without a Check | domain 76, component +113/−55 | `compare_groups` PASS; `order` FAIL (scene state set in an effect superseded the advance receipt) → PASS |
| number-tracer | async (geometry, then the vision judge) | domain 36, component +~80 | `trace` PASS after four harness fixes (below) |

comparison-builder was built by a fresh session from the plain recipe alone (its dry run): about 6 minutes to a
clean typecheck; its nine doc findings are folded into the skill.

## Shared fixes

1. **Plain families submit only under an evaluation provider** (`recordsEvaluation`), as runner families do.
2. **Harness `draw` input** for canvas primitives: strokes in canvas pixels. `mousemove` is a continuous
   React event, so the driver yields a task per move (as a real pointer does); its action loop now awaits.
3. **Driver stderr flood.** jsdom reported every canvas `getContext()` as "Not implemented"; a canvas that
   repaints per move filled the stderr pipe the harness does not drain, hanging the drive for ten minutes.
   The driver's virtual console drops that notice.
4. `choose` failures now list the buttons on screen. Tracer's guide paths moved to `numberTracerPaths.ts`,
   so the journey spec derives a traced answer without importing the component.

## Not covered

- comparison-builder Kindergarten (SVG group taps) and number-tracer `copy`/`write`/`sequence` (need a numeral
  the vision judge reads) have no driver input: covered by component tests only. The guidance sentences
  written for them (read the instruction aloud at K; never say a sequence's missing number) are undriven.
- Tool-lab residue: `canAdvance: true` handling in the sandbox and the sandbox control `advance` path.

## Gates

typecheck:lumina 0 · full tsc 770 · live-activity + visual-primitives + pip: 309 files, 4316 tests.
Regression smoke after the driver changes: place-value-chart `build` PASS. Browser/microphone: HUMAN-CHECKS #167.
