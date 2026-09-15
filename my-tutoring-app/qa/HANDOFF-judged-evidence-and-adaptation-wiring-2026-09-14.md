# Judged-loop evidence in the runner, catalog eval modes at submit, one generator adaptation step

Status: **slice 1 DONE 2026-09-14** ([report](misconception/judged-evidence-census-2026-09-14.md): runner-owned
evidence, 6 more callers submitting it, census 20/20 gate fires, 14 hypotheses name the signature miss, 4 capture gaps
queued); **slices 2–4 DONE 2026-09-15** ([report](misconception/judged-evidence-slices-2-4-2026-09-15.md)). Left open
from them: the packs still on the `diagnosisObservation` alias (45 implementations; phased plan in
`HANDOFF-observation-alias-migration-2026-09-15.md`), and the two per-component mode maps
(counting-board, ten-frame), kept because their capture tests mock the boundary and the maps are correct. The four
capture gaps from the slice-1 census are closed
([report](misconception/judged-capture-repairs-2026-09-15.md)). Written 2026-09-14 after `/add-misconception-loop ten-frame`
(`qa/misconception/ten-frame-2026-09-14.md`); reviewed against the code the same day (claims re-checked, corrections
folded in below). Four slices, in order; slice 1 carries most of the value.

**Before slice 2:** the slice-1 working tree is uncommitted and shares the tree with a Pip surface sweep (untracked
`pip/*.surface.test.tsx` + `*PipPose.ts`, five literacy components modified); `/ship` slices them apart.
`scripts/misconception-harness/judged-evidence-census.mjs` is the rerun after any runner, capture or observation-text
change (`RUN=<name> STAGES=G,E,D`; `STAGES=E,D` reuses a run's generated data).
Executors: slices 1, 2 and 4 `/add-misconception-loop` (its Phase 2 and Phase 4 contracts change); slice 3 `/eval-fix`.
Queue: `qa/di/BACKLOG.md` item 18.

## Why this exists

The shared delivery path works: the ten-frame consumer needed no service or backend edit, and a Python-signed packet
replayed with no login. The cost and the defects sit on either side of it.

1. **The judged runner's evidence cannot fire the capture gate.** `useJudgedScriptRunner` scores an item 100 / 67 / 33 / 0
   by corrections. A child wrong first on every item but right after one correction submits 67, and
   `isDiagnosableFailure` (`evaluation/diagnosis/types.ts`) needs `success === false`, score < 60 or
   `firstResponseScore` < 60. The runner's `summary.diagnosisEvidence` (`hooks/useJudgedScriptRunner.ts` around line 548)
   has no `firstResponseScore`, keeps `observations.slice(-12)` (the latest 12, dropping the first errors), and uses one
   observation's challenge as the session summary. So the gate fires only when the average drops under 60 (most items
   corrected twice) or the component reports `success: false` (ten-frame and counting-board: any item unsolved after
   the cap). It never fires for the pattern that carries the signal: wrong first, right after one correction.
   - 58 components under `primitives/` use the runner. 42 submit `summary.diagnosisEvidence`, and 21 of those declare
     `misconceptionScope`, so capture runs for them but rarely fires (list in the appendix).
   - Three components work around it: counting-board and ten-frame each carry a ~40-line evidence builder, nearly
     identical, and base-ten-blocks adds `firstResponseScore` to the runner evidence for `read_blocks` only.
2. **`diagnosisObservation` and `responseObservation` are the same function** in counting-board and ten-frame. Only 4
   components pass `responseObservation`, so `learningResponses` (every judged attempt, right or wrong) is empty for the rest.
3. **`metrics.evalMode` is a string each component writes.** Counting-board (CNB-3) and ten-frame (TF-6) both sent a
   challenge type (`count_all`, `add`, `split`) where the catalog and `backend/app/services/calibration/problem_type_registry.py`
   key the mode (`count`, `operate`, `decompose`). Capture labels evidence with it, and `submission_service.py` routes
   difficulty by it.
4. **Each generator consumer re-types the adaptation step**, and the planned mode comes from three different places across
   the ten consumers (appendix). ten-frame showed why that matters: its `pinnedType` for `operate` is `add`.

## Slice 1 — the runner owns first-response scoring and phase selection (DONE 2026-09-14)

**Build.** A pure module `hooks/judgedRunEvidence.ts`, called from the runner's finish path in place of the inline
assembly:

```ts
judgedRunEvidence({ outcomes, observations, items, pack }): DiagnosisEvidence | undefined
```

- `undefined` when there are no wrong attempts.
- `firstResponseScore` = round(100 × items solved with 0 corrections / items).
- `phases`: every item's first wrong attempt, then later wrong attempts, capped at 12, emitted in the order they happened.
  The logic already exists twice: move `countingBoardDiagnosisEvidence`'s selection, don't write a third copy.
- `challengeSummary`: the item count, the correction policy (`maxCorrections`) and "x of n items were answered right the
  first time", plus a per-kind task line from an optional pack field (below). No pack field → `pack.activityLine`.
- `expected`: optional pack field, else the source observation's `expected`.
- `observed`: joined phases, ≤ 2000 chars. `judgeFeedback`: the latest judge-backed observation, as today.
- `priorAttempts`: keep for now (the distiller reads it); drop only if a distiller test shows phases make it redundant.

Optional pack field (in `hooks/judgedScriptContract.ts`). It takes the run's items, not a list of kinds:
`JudgedScriptItem` has `action` and `responseClass` but no `kind`, so the runner cannot group items for the pack. The
pack groups them itself, per kind, so mixed sessions stay honest:

```ts
evidenceSummary?: (items: readonly Item[]) => { task: string; expected: string }
```

Write `judgedRunEvidence` against one list of corrected observations. Slice 2 then feeds it
`learningResponses.filter(r => r.verdict === 'corrected')` without a rewrite.

**Migrate.** CountingBoard and TenFrame delete their phase selection and `firstResponseScore` and keep only their
per-mode statement text (`countingTask` / `tenFrameTask`, the SESSION and EXPECTED tables become `evidenceSummary`).
BaseTenBlocksDi deletes its `firstResponseScore` patch. The other 14 judged components that do not submit
`summary.diagnosisEvidence` are inventoried: submit the runner evidence, keep their own with a reason, or note that they
attach none. Nine call the runner (ReadAloudStudio, BarModelExplanation, BalanceScaleEquality, BalanceScaleWorkshop,
SpatialScene, CalendarExplorer, DiSpokenPractice, RampInvestigation, PushPullArena). Five do not (CvcSpeller,
PhonicsBlender, SoundSwap, WordFlip on `useJudgedSpeechLoop`; BarModel on neither): for them "submit the runner
evidence" is not an option. cvc-speller, phonics-blender and sound-swap are declared sources that gate their own
evidence on `accuracy < 60` in component code, the same defect on a different path; note them for a later slice, do not
fix them here.

**Consequence to expect.** The gate starts firing for the 21 declared judged sources. That means more distiller calls
(still one per skill per session, latched) and more saved observations reaching the ten consumers. It is the intended
effect, but evidence text quality varies by primitive, and counting-board's was misleading ("count 7, expected four" for a
take-away board). Measure it before calling the slice done:

- For each declared judged source, build a fictional run from the pack's own `<id>HarnessAnswers.signatureWrong`
  (39 packs export one): three of five items wrong first, corrected once, then right. Run the real distiller through
  Next on :3000 with the shipped evidence (the `judgedRun` helper in `scripts/probe-ten-frame-applicability.mjs` is the
  template; put it in `scripts/misconception-harness/`, not a per-primitive copy).
- Record per source: gate fires (expected: yes), distiller hypothesis or abstain, and whether the hypothesis names the
  signature error. A source whose evidence produces a wrong or empty hypothesis gets an `/add-misconception-loop`
  capture-repair entry in item 18. It is not fixed inside this slice.

**Tests.**

| File | Must show |
|---|---|
| `hooks/judgedRunEvidence.test.ts` | 16 wrong attempts over 8 items → 12 phases, every first try kept, in order; `firstResponseScore` counts only zero-correction solves; no wrong attempts → undefined; mixed kinds use every kind's summary |
| `hooks/useJudgedScriptRunner.test.tsx` | the two existing evidence tests updated; a run with three items wrong first and corrected once finishes with `firstResponseScore` 40 and `isDiagnosableFailure` true while `accuracy` is 80 |
| `CountingBoard.capture.test.tsx`, `TenFrame.capture.test.tsx` | unchanged assertions pass after the builders are deleted (they are the regression fence) |
| one mounted capture test for a declared source that had no builder (pick letter-spotter or ordinal-line) | wrong-first run → evidence with `firstResponseScore`, capture calls the distiller |

**Done when:** `typecheck:lumina` 0, full tsc unchanged (last recorded 771; never trust 0), full vitest green, the distiller census recorded in a dated report
under `qa/misconception/`, and item 18 plus `WORKSTREAMS.md` updated.

## Slice 2 — one observation callback (DONE 2026-09-15)

Replace the pair with `observation?: (item, { heard, verdict }) => { challenge, expected, observed } | null`. The runner
calls it at every verdict (for `learningResponses`) and keeps the `corrected` ones as diagnosis observations. It reads it
before `applyVerdict`, as today, so board state is still the committed board.

- Keep `diagnosisObservation` as a fallback alias for one slice, so existing packs need no edit to compile (75 non-test
  files under `primitives/` reference it).
  Then migrate them and delete the alias.
- **Audit before aliasing:** an implementation that says the answer was wrong in its text ("The tutor judged the answer
  wrong from the audio") would now also be recorded for right answers. Grep for verdict words in `observed` strings and fix
  those to state what was heard or done.
- Test: a mounted run with one right and one wrong attempt records both in `learningResponses` from one callback.

## Slice 3 — the submitted eval mode is a catalog key (DONE 2026-09-15)

Normalize at the evaluation boundary (`evaluation/hooks/usePrimitiveEvaluation.ts`, `submitResult`), not in 58 components.
Write the normalized key back into the result's `metrics.evalMode`, not only into a payload field: capture reads
`result.metrics.evalMode` (`captureMisconception.ts` lines 99 and 132), the backend reads `metrics.evalMode`
(`submission_service.py` line 396), and `resolveRemediationIdentity` receives it. The catalog lookup is
`getComponentById` from `service/manifest/catalog`, already imported by the capture layer:

1. If the manifest item for this `instanceId` (`exhibitContext.manifestItems`, already read there) has a single-key
   `config.targetEvalMode`, submit that.
2. Else, if `metrics.evalMode` is a catalog eval mode for `primitiveType`, keep it.
3. Else, if it is a challenge type listed under exactly one catalog mode, submit that mode.
4. Else keep it and warn once in development. Ambiguous types exist: knowledge-check lists `multiple_choice` under four modes.

Attempts already stored under type names keep them (as CNB-3 recorded). Candidates whose catalog challenge types differ
from their mode names, to confirm by mounting one session each: addition-subtraction-scene (`act-out` vs `act_out`),
number-bond, shape-sorter, word-workout, word-builder, letter-sound-link, letter-spotter, ordinal-line, sorting-station,
3d-shape-explorer, decodable-reader, text-structure-analyzer, knowledge-check. Then delete the per-component maps added
for CNB-3 and TF-6.

Test: `usePrimitiveEvaluation.test.ts` covers the four rules, plus a table test that every catalog `challengeTypes` entry
resolves to its mode or is reported ambiguous.

## Slice 4 — one generator adaptation step (DONE 2026-09-15)

`service/generation/adaptationStep.ts`:

```ts
plannedMode(resolution): string | undefined          // resolution.modes[0].evalMode when exactly one mode, else undefined
planAdaptation(ctx, { mode, tier, capabilityFor, eligible }): Promise<M | null>   // no observations or ineligible → null, no call
stampAdaptation(move, selected): LearningAdaptation<M> | undefined               // one status mapping
```

- Add a shared `LearningAdaptation<M>` type and use it in each `*Data` type.
- Port the ten consumers. Where a generator's `eligible()` compares the mode to challenge-type names, check that every
  compared name equals its catalog mode before switching to `plannedMode`.
- Status stamping differs: seven consumers map `no-focus` to `insufficient-capacity` (area-model, bar-model,
  base-ten-blocks, counting-board, fraction-bar, fraction-circles, number-tracer), number-line omits the stamp on
  `no-focus`, ten-frame stamps the selector status as is, and place-value derives its own from `count` and `reason`.
  Rule: always stamp, and `no-focus` becomes `insufficient-capacity`. It is the majority, and an absent stamp cannot be
  told apart from a consumer that never planned.
- Regression fence: each consumer's existing `*.adaptation.test.ts` and `*ObservationServer.test.ts` pass unchanged.

## Checked and not a defect

The delivery gates read `config.targetEvalMode`, and I suspected an unpinned manifest would never receive observations.
`service/manifest/resolveLessonEvalModes.ts` always writes it: one key, `a|b`, or `mixed`. Blends and `mixed` do not
deliver, which matches the generators, whose moves are defined for one mode.

## Skill doc edits that ride with slice 1

In `.claude/skills/add-misconception-loop/SKILL.md`:

- **Phase 1:** a real-baseline census per candidate mode decides scope; simulation only brackets the risk. On ten-frame,
  3 to 11 real draws per mode ruled out make_ten, subitize and a second operate move before any code, and one simulated
  distribution overstated the Grade 1 chance rate at 50% against 0 of 10 real sessions.
- **Phase 2:** judged-runner primitives supply `observation` and `evidenceSummary` only. Check that the submitted
  `evalMode` is a catalog key (until slice 3 lands).
- **Phase 4:** the planner's `task.mode` is the catalog eval mode, never the first challenge type.
- **Phase 5:** for judged primitives, read the item cue for rewritten and baseline items. The ten-frame contract on
  8 take away 4 refused the right answer (TF-5).
- **"No move" reasons** use a fixed list, with the measured rate where it applies: contrast already present (x of n),
  no content lever, answer judged in code, blocked by a named defect.

## Related

The per-primitive probe script is still copied per consumer (332 lines for ten-frame, about the size of its production
change). The shared runner and fixtures are planned in `qa/HANDOFF-misconception-probe-harness-2026-09-13.md`. Slice 1's
distiller census is a natural first user of that runner's stage D.

## Appendix — inventory on 2026-09-14

**Declared judged sources that submit the runner evidence** (`misconceptionScope` set; capture runs, gate rarely fires):
3d-shape-explorer, base-ten-blocks (patched for `read_blocks`), compare-objects, decodable-reader, di-deduction,
di-dice-roll, di-word-problem-setup, di-worked-procedure, fraction-circles (FractionTouch), letter-sound-link,
letter-spotter, oral-sentence-studio, ordinal-line, phoneme-explorer, picture-vocabulary, place-value-chart,
rhyme-studio, sentence-analyzer, sorting-station, syllable-clapper, word-builder (21; the review found
oral-sentence-studio missing from the first count of 20). Declared sources on `useJudgedSpeechLoop` with their own
`accuracy < 60` gate, not in this count: cvc-speller, phonics-blender, sound-swap.

**Generator consumers and where their planned mode comes from:**

| Source of `task.mode` | Consumers |
|---|---|
| first allowed challenge type (`pinnedType`) | area-model, base-ten-blocks, counting-board, fraction-bar, fraction-circles, number-tracer, place-value-chart |
| resolved eval mode when exactly one | bar-model, ten-frame |
| raw `config.targetEvalMode` | number-line |
