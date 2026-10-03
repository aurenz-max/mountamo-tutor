# Contract: addition-fact-strategies

- **Derived:** 2026-10-03, from the build slices that day (eval modes, curriculum fit, workspace W1, levers).
- **Component:** `src/components/lumina/primitives/visual-primitives/math/AdditionFactStrategies.tsx` · **Generator:** `src/components/lumina/service/math/gemini-addition-fact-strategies.ts` · **Domain:** `additionFactStrategiesWorkspace.ts`, `additionFactStrategiesLevers.ts`, `additionFactPools.ts`
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| G2 OPS002-04-a, fact fluency within 20 (direct); G1 OPS001-09-a, PTRN001-05-a/-c (partial) | curriculum fit | `qa/curriculum-fit/addition-fact-strategies-2026-10-03.md` | 2026-10-03 |
| G1 OPS001-01-c, sums up to 10 (partial; the sum window) | objective number window | same report, fixed draws 20/20 | 2026-10-03 |
| Six eval modes (plus_zero ... big_facts), IRT priors | catalog + backend registry | `scripts/addition-fact-strategies-modes-probe.mjs` 11/11; eval-test route 6/6 | 2026-10-03 |
| Live tutor / JEV teaching workspace, every mode | W1 binding + levers | `qa/tutor-reports/addition-fact-strategies-workspace-2026-10-03.md` | 2026-10-03 |

## Requirements

### R1 — one strategy family per session; a fact's `type` is that family
- The root `strategy` is the session's family; every challenge's `type` equals it, so it matches the mode's catalog `challengeTypes`. Probe: eval-test route, typesFound per mode.

### R2 — the answer never reaches the screen or the tutor before the child taps it
- The slot shows "?" until solved; the pad is always 0-18. The scene and the assignment never carry the sum; the worked example (first fact only) is a different fact and is named to the tutor by its addends only. Probe: `AdditionFactStrategies.workspace.test.tsx`.

### R3 — the sum window is the objective's
- A lesson that names a sum ceiling ("sums up to 10") gets only facts under it and only families that can fill a session under it; a pinned family with nothing under the window keeps its full sums. Probe: generator tests; fit probe draws.

### R4 — levers (`additionFactStrategiesLevers.ts`)
- **Leak rules (`leverNumbers`, unit-tested over every fact of every family):** `count_groups` prints no number but the child's own taps; `hop_strip` prints the start and each hop only once tapped, in order; `near_double` prints the double's addend, never its total or the fact's; `known_fact` prints the flipped fact with its total (the turn-around itself) and the attempt is recorded assisted.
- **Assistance record:** a runtime pull lands on the next attempt (`levers`, `assisted`); easy's starting `count_groups` is not a pull.
- **Simplify mode floor:** `smaller_fact` stays in the session's family, has a smaller total, is never a session fact in either order, is ungraded, and returns to the full item.
- **No make-ten lever** (user-approved table, 2026-10-03).

## History
- 2026-10-03 — derived. Workspace-only from this date (comebacks and scripted cues removed; see the W1 report).
