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

- **Property:** Counters appear for `flashDuration`, then hide before the answer surface becomes available. The child can request another flash; hidden counters cannot be manipulated. A correct response restores the counters.
- **Demanded by:** `subitize` task identity and perceptual-fluency pedagogy.
- **Evidence:** component `startFlash`, hidden-phase guard in `handleCellClick`, and the flash lifecycle; generator grade/tier flash windows.
- **Probe:** subitize eval-test PASS; component timing path hides counters before the tutor's ask can be answered.
- **Re-based 2026-08-13 (DI port):** the answer surface is now the child's VOICE, so "hide before the response surface opens" means the tutor's ask is answered against a hidden frame. "A correct response restores the counters" now hangs off the tutor's AFFIRM (`onAffirmed`), not a Check click — the button it used to hang off no longer exists. "Show again" re-shows the stimulus and the paired tap-to-hear re-asks the QUESTION; neither may narrate the count.

### R5 — make-ten is derived from one numeric source of truth · OBSERVED

- **Property:** `targetCount` is the number initially shown, frame capacity is 10, and the complement is `10 - targetCount`. The instruction is synthesized after all config overrides, and `showEmptyCount` is always false so the answer is not printed.
- **Demanded by:** TF-3/SP-17, answer-key consistency, pedagogy rule #1.
- **Evidence:** generator validation + `buildInstruction`; `qa/eval-reports/ten-frame-2026-05-28.md`; ten-frame oracle.
- **Probe:** make-ten instruction, shown counters, and derived complement agree for every generated challenge.

### R6 — answer surface forks by band without changing task identity · REQUIRED

- **Property:**
  - **`make_ten` @ K:** DIRECT MANIPULATION — seed `targetCount` counters; the child taps empty cells to fill the frame; the number of counters the child placed (`filledCount - targetCount`) is the enacted complement and auto-judges when the frame reaches 10. Initial counters are not removable. No make-ten stepper and no Check button.
  - **`make_ten` @ Grades 1–2:** the numeric complement stays the child's own unaided answer. **Re-based 2026-08-13:** it is SPOKEN and judged in-band; the stepper and Check button are gone. The stepper was a costume (a child who cannot find the complement can still operate one); the production demand is unchanged, which is why the eval mode's β is unchanged.
  - **`build` at every band:** DIRECT MANIPULATION, same re-basing as K make-ten — placing counters IS building the quantity, so the surface survives and the tutor judges the committed placement.
  - **`subitize`, `add`, `subtract` at every band:** the answer is the NUMBER, now spoken. Their working surfaces are unchanged.
  - **Challenge transitions:** every challenge owns its starting frame state. `add` starts empty; `make_ten` seeds `targetCount`; `subtract` seeds `startCount`; no completed frame carries into the next challenge.
- **Demanded by:** reader-fit item 12; direct-manipulation-first ruling for K act/build scenes; qa/di/BACKLOG.md item 18.
- **Evidence:** `qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md`; reader-fit BACKLOG item 12; `qa/HANDOFF-di-ten-frame-2026-08-12.md`.
- **Probe:** `__tests__/TenFrame.reader-fit.test.tsx` — taps change the enacted K answer and it commits only when the frame is full; no stepper and no Check control at any band; a completed make-ten → add transition starts with zero counters; a Grade 1–2 make-ten item classifies as `answerKind: 'voice'` and its taps commit nothing.
- **Judged-loop addition (does not weaken the above):** a hands-only turn also closes on STILLNESS (`PLACEMENT_SETTLE_MS`), the gesture analogue of the mic's silence bracket. This is what makes a hand item JUDGEABLE — stopping before the frame is full is now a wrong answer the tutor corrects, where previously the only reachable state was correct. R6's frame-full auto-judge is untouched.

### R7 — support tiers alter scaffolding, not magnitude or task identity · OBSERVED

- **Property:** `easy`/`medium`/`hard` withdraw count/equation aids or shorten/rearrange subitize flashes while pedagogical scope continues to own numeric bounds. `showEmptyCount` never exposes a make-ten complement.
- **Demanded by:** support-tier and structural-difficulty axes.
- **Evidence:** generator `normalizeSupportTier` / `resolveSupportStructure`; difficulty-sweep reports.
- **Probe:** pinned-mode tier draws stay in the same number band while visible aids change.

### R8 — evaluation reflects completed challenge behavior and submits once · OBSERVED · **RE-BASED 2026-08-13**

- **Property:** **THE TUTOR'S VERDICT IS WHAT ADVANCES A CHALLENGE** — "records one correct result before advancement" now means the Live tutor affirmed the child's answer, not that a Check click scored it. The run submits once, at the end, with per-mode metrics including make-ten totals and whether a full frame was reached. Subitize timing stays isolated to subitize.
- **Demanded by:** mastery, IRT, K-stage lifecycle, qa/di/BACKLOG.md item 18.
- **Evidence:** `useJudgedScriptRunner` owns progression (affirm advances, corrections cap at 2 then move on); the component's `onFinished` builds `TenFrameMetrics` from the run summary and calls `submitResult` once. Per-item scoring is the family's corrections ladder (100 / 67 / 33 / 0), not a first-try boolean.
- **Probe:** `hooks/useJudgedScriptRunner.test.tsx` covers the progression policy; `__tests__/TenFrame.reader-fit.test.tsx` covers the stage's side — no on-screen control commits or advances anything, and a gesture commit fires exactly once per placement.
- **What this cost:** the old reflash-penalty scoring is gone (it weighted credit by `reflashes`). Reflash count is no longer a scoring input — "Show again" is stimulus support that is never withdrawn, and the runner's `hearTaps` is the honest successor signal.

## Conflicts

_None open._ Item 12 is **COMPATIBLE / fork-by-band+mode**. It changes only R6's K `make_ten` answer surface. R4 requires subitize to keep its hidden numeric response; R3 requires build/count-all to keep its construction-plus-check behavior; the non-K branch of R6 preserves the established Grade 1–2 response. R5's numeric source of truth already contains everything needed, so no generator schema change is justified.

## Catalog projection

- **description/constraints:** faithful at the skill level; the catalog promises an interactive ten-frame manipulative and make-ten strategy. No catalog change is required for the K answer-surface fork.
- **evalModes:** faithful. `make_ten` remains “find the complement to 10”; K enacts the complement while Grades 1–2 report it numerically.

## Changelog

- 2026-07-16 — derived (initial). 8 requirements, 0 open conflicts.
- 2026-07-16 — item 12 implemented as a compatible K `make_ten` band+mode fork: seed → tap empty cells → auto-judge the enacted complement; all other modes/bands preserved.
- 2026-07-16 — browser follow-on: mixed-mode make-ten → add incorrectly retained the full frame because `advanceToNextChallenge` treated an add challenge without `startCount` as “build on previous.” Fixed challenge initialization so every transition clears first, then make-ten/subtract effects seed their own state; add remains empty by contract. Verified jsdom 5/5, full suite 810/810, live eval-test 4/4 modes, and Lumina typecheck clean. Real-browser recheck remains in HUMAN-CHECKS.
- 2026-08-13 — **DI judged loop (first math port; qa/di/BACKLOG.md item 18).** R6 held as written and was the reason `build` kept its hands too: in math the manipulative is often the skill, so only the STEPPERS were costumes. **Re-based:** R4 (restore-on-affirm, ask against a hidden frame), R6 (Grades 1–2 make-ten now spoken; a stillness commit makes hand items judgeable), R8 (the tutor's verdict advances; reflash-penalty scoring retired). **Unchanged:** R1, R2, R3, R5, R7 — and every eval mode keeps its identity and β, because the modality changed while the production demand did not. **New leak gates this port found:** the running-count readout is withdrawn on add/subtract (it equals the sum/difference about to be spoken), the empty-space readout is no longer rendered at all (R5 no longer rests on a flag being false), and items whose spoken answer computes to 0 or exceeds 20 are DROPPED on both sides of the wire (`itemFromChallenge` + the generator gate) because zero is an unbenched spoken answer. Verified: `typecheck:lumina` 0, census greps 0, 42/42 own tests, full suite 3019 passed / 0 failed, live 6-run pipeline probe kept 38/38 items. Mic drive owed — see HUMAN-CHECKS #98.
- 2026-08-13 — **drive-3 fix (R4 ordering).** The flash fired on a beat measured from item-open, but the tutor's line runs ~4s, so the counters came and went while she was still saying "watch the frame" and the ask landed on a frame the child had never been told to look at. **R4's flash-then-hide lifecycle is now keyed to the TUTOR'S VOICE** — a falling edge on the runner's new `tutorSpeaking` passthrough (`ctx.isAudioPlaying`), requiring that she has spoken for this item and then stopped, with a 12s fallback so a silent tutor cannot suppress the stimulus entirely. Same gate on the first ask, on every subsequent challenge, and on a correction's re-flash; the hand-tuned 3s correction window is deleted. **`tutor-owns-the-clock` therefore governs PRESENTATION, not only progression** — carry it to any primitive whose ask refers to something the stage shows.
- 2026-08-13 — **drive-2 fix (blocking, R4).** `subitize` never presented its stimulus: the flash callback depended on the `runner` object, which is new on every render, and `micLevel` updates once per audio frame — so the effect holding the prep timer tore it down and re-armed it faster than it could fire. **R4 was unsatisfiable whenever the mic was open, i.e. always.** Now keyed to `currentItem`; the regression test re-renders continuously through the prep window, because every prior test in this family renders and then sits still. Separately, the tutor was caught VOICING `[WAIT silently]` — the contract's imperative opener re-read as a line to perform; the wait is now stated as a fact about the turn and every contract-carrying cue names the failure.
- 2026-08-13 — **drive-1 fix (blocking).** The stage was dead on every challenge after the first: interaction was gated on `runner.stage === 'asking'`, but the runner sets `affirmed` and opens the next item in one dispatch and never returns the stage to `asking` on the happy path. **R6 and R3 were both silently unsatisfiable from item 2 onward.** Interaction and reveal now key on `runner.solvedIds` — "is THIS item still open?" — with only `judging` still blocking. The failure healed itself on a wrong answer (a correction resets the stage), which is why 40 machine tests missed it; the regression test drives the affirm-then-advance sequence directly.
