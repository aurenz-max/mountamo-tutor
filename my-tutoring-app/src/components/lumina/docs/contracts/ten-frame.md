# Contract: ten-frame

- **Derived:** 2026-07-16 · evidence window: eval reports 2026-03-16 and 2026-05-28, difficulty sweeps 2026-06-11, topic traces through 2026-07-14, reader-fit direct-manipulation census 2026-07-16, catalog/generator/component/oracle source
- **Component:** `src/components/lumina/primitives/visual-primitives/math/TenFrame.tsx` · **Generator:** `src/components/lumina/service/math/gemini-ten-frame.ts` · **Catalog:** `src/components/lumina/service/manifest/catalog/math.ts` (`id: 'ten-frame'`)
- **Status:** ACTIVE (static derivation; runtime census was not repeated because the 2026-07-16 handoff declares the sibling census complete)

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| K PRE — `build` / count-all with a single frame | catalog + topic traces + difficulty sweep | catalog eval mode; `qa/topic-traces/counting-to-10-2026-05-31.md`; `qa/eval-reports/difficulty-sweep-keystone-2026-06-11.md` | 2026-07-14 |
| K PRE — `subitize` quantities 1–5 | catalog + generator + component | generator grade rules; component flash/hide lifecycle; eval report PASS | 2026-07-16 |
| K PRE — `make_ten`, complement to 10 | catalog + reader-fit census + eval report | catalog eval mode; `qa/eval-reports/ten-frame-2026-05-28.md`; reader-fit BACKLOG item 12 | 2026-07-16 |
| Grades 1–2 — build, subitize, make-ten, add/subtract; single/double frame as allowed | catalog + component non-K branches | catalog constraints/eval modes; component `gradeBand: '1-2'`; generator grade rules | ongoing |
| Support-tier axis (`easy`/`medium`/`hard`) within a pinned mode | structural-difficulty campaign | generator `resolveSupportStructure`; difficulty sweep reports | 2026-06-11 |
| IRT/mastery evaluation for all four eval modes | eval-test + oracle + evaluation hooks | `qa/EVAL_TRACKER.md`; ten-frame oracle; `useChallengeProgress` / `usePrimitiveEvaluation` | ongoing |

## Requirements

### R1 — generated challenge type follows the selected eval mode · OBSERVED

- **Property:** `build` emits `build`; `subitize` emits `subitize`; `make_ten` emits `make_ten`; `operate` emits `add`/`subtract`. A pinned eval mode constrains the schema, and every session contains code-owned challenge IDs and deterministic instructions.
- **Demanded by:** manifest routing, IRT task identity, eval-test.
- **Evidence:** catalog `evalModes`; generator `resolveEvalModes` + `constrainChallengeTypeEnum` + `buildInstruction`.
- **Probe:** all four modes PASS in `qa/eval-reports/ten-frame-2026-05-28.md`.

### R2 — frame capacity and grade band remain coherent · OBSERVED

- **Property:** K uses a single 10-cell frame; Grades 1–2 may use a double frame for values through 20. `make_ten` is specifically complement-to-10 and remains pinned to a single frame at every grade; a future make-20 task requires a separate eval mode.
- **Demanded by:** catalog constraints, grade fidelity, TF-3 product decision.
- **Evidence:** generator grade/mode validation and post-config make-ten pin; EVAL_TRACKER TF-3.
- **Probe:** make-ten eval output uses `mode: 'single'` and a target below 10.

### R3 — build/count-all is a concrete construction task · OBSERVED

- **Property:** The child taps frame cells to place or remove counters, then checks the constructed count against `targetCount`. The running count is a support-tier-controlled aid, not the answer key.
- **Demanded by:** K number sense, `build` eval mode, support tiers.
- **Evidence:** component `handleCellClick` + `checkBuildChallenge`; generator `build` docs and support structure.
- **Probe:** build eval-test PASS; difficulty sweep preserves the number band while withdrawing the count readout.

### R4 — subitize is flash-then-hide recognition, not tap-counting · OBSERVED

- **Property:** Counters appear for `flashDuration`, then hide before the numeric answer surface becomes available. The child can request another flash; hidden counters cannot be manipulated. A correct response restores the counters.
- **Demanded by:** `subitize` task identity and perceptual-fluency pedagogy.
- **Evidence:** component `startSubitizeFlash`, hidden-phase guard in `handleCellClick`, and subitize response branch; generator grade/tier flash windows.
- **Probe:** subitize eval-test PASS; component timing path hides counters before enabling the response.

### R5 — make-ten is derived from one numeric source of truth · OBSERVED

- **Property:** `targetCount` is the number initially shown, frame capacity is 10, and the complement is `10 - targetCount`. The instruction is synthesized after all config overrides, and `showEmptyCount` is always false so the answer is not printed.
- **Demanded by:** TF-3/SP-17, answer-key consistency, pedagogy rule #1.
- **Evidence:** generator validation + `buildInstruction`; `qa/eval-reports/ten-frame-2026-05-28.md`; ten-frame oracle.
- **Probe:** make-ten instruction, shown counters, and derived complement agree for every generated challenge.

### R6 — answer surface forks by band without changing task identity · REQUIRED

- **Property:**
  - **`make_ten` @ K:** DIRECT MANIPULATION — seed `targetCount` counters; the child taps empty cells to fill the frame; the number of counters the child placed (`filledCount - targetCount`) is the enacted complement and auto-judges when the frame reaches 10. Initial counters are not removable. No make-ten stepper and no Check button.
  - **`make_ten` @ Grades 1–2:** preserve the numeric complement response and Check button.
  - **`subitize`, `build`, `add`, `subtract` at every band:** preserve their existing answer surfaces and checking behavior.
  - **Challenge transitions:** every challenge owns its starting frame state. `add` starts empty; `make_ten` seeds `targetCount`; `subtract` seeds `startCount`; no completed frame carries into the next challenge.
- **Demanded by:** reader-fit item 12; direct-manipulation-first ruling for K act/build scenes.
- **Evidence:** `qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md`; reader-fit BACKLOG item 12.
- **Probe:** jsdom must show taps changing the enacted K answer and completing only when full; K stepper/Check absent; K subitize, K build, and Grade 1–2 make-ten controls unchanged; a completed make-ten → add transition starts with zero counters.

### R7 — support tiers alter scaffolding, not magnitude or task identity · OBSERVED

- **Property:** `easy`/`medium`/`hard` withdraw count/equation aids or shorten/rearrange subitize flashes while pedagogical scope continues to own numeric bounds. `showEmptyCount` never exposes a make-ten complement.
- **Demanded by:** support-tier and structural-difficulty axes.
- **Evidence:** generator `normalizeSupportTier` / `resolveSupportStructure`; difficulty-sweep reports.
- **Probe:** pinned-mode tier draws stay in the same number band while visible aids change.

### R8 — evaluation reflects completed challenge behavior and submits once · OBSERVED

- **Property:** A challenge records one correct result before advancement; all-complete submits once with per-mode metrics, including make-ten totals and whether a full frame was reached. Subitize timing/reflash metrics remain isolated to subitize.
- **Demanded by:** mastery, IRT, K-stage lifecycle.
- **Evidence:** component `recordResult`, `advanceToNextChallenge`, auto-submit guard, and `TenFrameMetrics` construction.
- **Probe:** behavioral completion reaches Next and final evaluation without duplicate result submission.

## Conflicts

_None open._ Item 12 is **COMPATIBLE / fork-by-band+mode**. It changes only R6's K `make_ten` answer surface. R4 requires subitize to keep its hidden numeric response; R3 requires build/count-all to keep its construction-plus-check behavior; the non-K branch of R6 preserves the established Grade 1–2 response. R5's numeric source of truth already contains everything needed, so no generator schema change is justified.

## Catalog projection

- **description/constraints:** faithful at the skill level; the catalog promises an interactive ten-frame manipulative and make-ten strategy. No catalog change is required for the K answer-surface fork.
- **evalModes:** faithful. `make_ten` remains “find the complement to 10”; K enacts the complement while Grades 1–2 report it numerically.

## Changelog

- 2026-07-16 — derived (initial). 8 requirements, 0 open conflicts.
- 2026-07-16 — item 12 implemented as a compatible K `make_ten` band+mode fork: seed → tap empty cells → auto-judge the enacted complement; all other modes/bands preserved.
- 2026-07-16 — browser follow-on: mixed-mode make-ten → add incorrectly retained the full frame because `advanceToNextChallenge` treated an add challenge without `startCount` as “build on previous.” Fixed challenge initialization so every transition clears first, then make-ten/subtract effects seed their own state; add remains empty by contract. Verified jsdom 5/5, full suite 810/810, live eval-test 4/4 modes, and Lumina typecheck clean. Real-browser recheck remains in HUMAN-CHECKS.
