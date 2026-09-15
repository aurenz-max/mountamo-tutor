# One observation callback, catalog eval mode at the boundary, one adaptation step — 2026-09-15

Slices 2, 3 and 4 of `qa/HANDOFF-judged-evidence-and-adaptation-wiring-2026-09-14.md`, built on the uncommitted slice 1
(`judged-evidence-census-2026-09-14.md`). Fictional runs and signed-packet replays; no account, no store writes.

## Slice 2 — one `observation` callback

`diagnosisObservation` and `responseObservation` were the same function in every pack that had both, and only four packs
passed the second, so `learningResponses` (every judged attempt, right or wrong) was empty for the other 54.

| Piece | Where |
|---|---|
| `observation?: (item, { heard, verdict })` on the pack. The runner calls it on every verdict: an attempt that carries evidence (a gesture, or a voice attempt with a transcript) goes to `learningResponses`; a correction is also a diagnosis observation, transcript or not. `responseObservation` deleted. `diagnosisObservation` kept as a deprecated corrections-only alias, ignored when `observation` is set | `hooks/judgedScriptContract.ts`, `hooks/useJudgedScriptRunner.ts` |
| Migrated: counting-board, ten-frame, base-ten-blocks, place-value-chart (place-value keeps the voice helper's contradiction note on corrections and the actual transcript on affirmations) | the four components |
| Not migrated: 71 packs still on the alias. Their `observed` strings were audited: 25 name a verdict when there is no transcript ("The tutor judged the answer wrong from the audio", "Said something that did not match"); those lines must state what was heard or done before each pack moves to `observation`, because the same text is then recorded for right answers | queued |

Verified: `useJudgedScriptRunner.test.tsx` (new: one right and one wrong attempt from one callback, the silent correction
kept as a diagnosis observation but not as a response, the legacy alias ignored); the four capture tests unchanged;
census run3 over the four migrated packs with real generation, the mounted pack's `observation` and the real distiller —
gate 4/4, hypotheses name the signature miss 4/4 (counting-board "states the starting total", ten-frame "reports the
starting quantity instead of subtracting", base-ten "swaps unit count and total value", place-value "value for place").

## Slice 3 — the submitted eval mode is a catalog key

`evaluation/evalModeKey.ts`, called once in `usePrimitiveEvaluation.submitResult` and written back into the result's
`metrics.evalMode` (capture reads `result.metrics.evalMode`; the backend reads `metrics.evalMode`):

1. a single-key manifest pin for this instance that is a catalog mode wins (`a|b` and `mixed` name no skill);
2. a reported catalog mode is kept;
3. a reported challenge type listed under exactly one mode becomes that mode (CNB-3, TF-6 class);
4. anything else is kept, with one development warning per primitive and value.

Verified: `evalModeKey.test.ts` (the four rules, and a table over every catalog `challengeTypes` entry: each resolves to
its mode or is reported ambiguous); `usePrimitiveEvaluation.evalMode.test.tsx` (the real hook mounted with a manifest:
`add` → `operate`, `split` → `decompose`, a pin wins, a blend does not, another instance's pin is ignored, unknown kept
with one warning).

**Ambiguous challenge types** (kept as reported; a type several modes share cannot name one skill): knowledge-check
(`multiple_choice`, `true_false`, `fill_in_blanks`, `matching_activity`, `sequencing_activity`,
`categorization_activity`), fact-file (`recall_easy`, `recall_medium`), how-it-works (`identify`), timeline-explorer
(`identify`), vocabulary-explorer (`match`, `fill_blank`), number-line (`plot_point` under identify and plot),
practice-problem (`derive`), coin-counter (`count`), time-sequencer (`sequence-events`), equation-builder
(`missing-value`), distribution-explorer (`compute`), construction-sequence-planner (`deadline`), planetary-explorer
(`mc`). For these, a single-key manifest pin (rule 1) is the only way a submission carries the mode.

The handoff's 13 candidates were checked statically, not by mounting: of them only decodable-reader reports
`metrics.evalMode` at all (its `mode`), number-bond reports `challengeType: item.kind`, and the rest report neither, so
capture and IRT fall back to `challengeType` or nothing; rule 3 now maps every unique type for all of them. The
counting-board and ten-frame per-component maps stay: they are correct, and their capture tests mock the boundary.

## Slice 4 — one generator adaptation step

`service/generation/adaptationStep.ts` (+ `learningAdaptation.ts`, types only, importable by client components):

| Export | Replaces |
|---|---|
| `plannedMode(resolution)` — the resolved catalog eval mode when exactly one, from either resolution shape | first allowed challenge type (7 consumers), raw `config.targetEvalMode` (number-line) |
| `adaptationTaskFor(ctx, topic, { mode, tier })` | ten copies of the task literal |
| `planAdaptation(ctx, { task, capability, eligible })` — no capability, no observations or an ineligible task means no call; saved observations, else the eval-test focus | ten copies of the gate and the observation fallback (three consumers had no fallback; declared consumers have the tap stripped upstream, so the fallback reaches them only in tests) |
| `stampAdaptation(move, selected)` — `no-focus` → `insufficient-capacity`, always stamped when a move was planned | seven copies of the mapping, ten-frame stamping as is, number-line omitting the stamp on no-focus, place-value deriving its own (it still derives the status from its reason and count, then stamps through the shared function) |
| `LearningAdaptation<M>` | nine inline `learningAdaptation?: {…}` types plus bar-model's |

Mode names checked against the catalog before switching to `plannedMode`: area-model, base-ten, fraction-bar,
fraction-circles, number-tracer, place-value modes equal their challenge types; counting-board's adaptive modes
(`take_away`, `add_more`, `count_on`) equal theirs (its `count`/`group` differ but have no capability); bar-model keeps its
already-resolved mode. number-line's `jump` now comes from the resolution, so a blend or `mixed` pin no longer reaches the
planner as a mode string.

Verified: `adaptationStep.test.ts`; the ten consumers' `*.adaptation.test.ts`, `*.remediation.test.ts` and
`*ObservationServer.test.ts` pass unchanged (31 files, 182 tests with the slice 2 and 3 files); replay with a signed
packet through production `generateComponentContent`, ten-frame: packet opened, 2 of 2 learner draws
`contrast_same_first_number_different_second` targeted with comparison count 2 and `source: saved-observation`,
anonymous / forged / tampered / foreign-key draws unadapted, 0 backend calls, no private text in output
(`artifacts/learning-applicability/ten-frame/slice4-replay.json`; the 09-14 case packet had expired, its dates were
refreshed and the harness signed it). Counting-board replay the same: 2 of 2 `contrast_same_start_different_change`
targeted with comparison count 2, four controls unadapted, 0 backend calls.

## Gates

`typecheck:lumina` 0. Full tsc 771: 0 errors under `components/lumina/`; the one above the 770 mark is a generated
`.next/types` route file. Full vitest 513 files / 6,457 tests passed (the concurrent Pip sweep's surface tests now pass too).

## Residual (queued in item 18)

- `/add-misconception-loop`: migrate the 71 alias packs to `observation` (audit the 25 verdict-worded `observed`
  strings first), then delete `diagnosisObservation`.
- Rule 4 primitives above: a submission from them carries the mode only through a single-key manifest pin; a
  component-level catalog mode report is the fix where one type serves several modes.
- The four capture gaps from slice 1 and the two drive-adapter gaps stand.

## Line ratio

New: `adaptationStep.ts` 79 + `learningAdaptation.ts` 16 + `evalModeKey.ts` 77 production; tests 61 + 77 + 54 plus the
runner test case. Edits: ten generators and the hook net −30 lines (+71 −101); the runner and contract +30 −25; four packs
each lose one duplicated callback; nine data types lose an inline type.
