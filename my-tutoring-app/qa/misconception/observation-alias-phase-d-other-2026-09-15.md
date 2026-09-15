# Observation alias migration, Phase D (science, history, other) — 2026-09-15

Phase D of `qa/HANDOFF-observation-alias-migration-2026-09-15.md`. The last 11 packs (knowledge-check, periodic-table,
solar-system-explorer, habitat-diorama, matter-explorer, states-of-matter, cause-effect-chain, era-explorer,
push-pull-arena, ramp-lab explanation, calendar-explorer) now use the one `observation(item, { heard, verdict })`
callback, and every host submits `summary.learningResponses`. No pack under `primitives/` uses the alias any more.
No cues, sentinels or items changed. Uncommitted, on top of uncommitted Phases A–C.

## What changed

- **15 verdict-worded fallbacks reworded** ("The tutor judged the answer wrong", "Said something that did not match",
  "Tapped a different box", "The committed ecosystem model did not match the relationship key", "No supported
  comparison heard").
- **Gesture observations that recorded no move now record one.** Under the alias these ran only on corrections and
  could print a verdict; under `observation` they run on every gesture.
  - knowledge-check: the tap was render state the pack could not read. A `tappedIdRef` now mirrors it, and the
    observation names the option or number-sentence token touched.
  - habitat-diorama: nothing held the committed move. A `committedRef` is set just before each gesture is submitted:
    "Connected Snowshoe Hare to Oak Tree." / "Placed Shelf Fungus in the Ground layer zone."
  - cause-effect-chain: the built chain was recorded as card ids ("c2 → c1"). It is now card text, and so is the
    expected order.
- **Challenges state the stimulus** where they named only the task:
  - knowledge-check: what the screen shows (its script's `stimulusDescription`, now exported), plus the options or
    word bank.
  - periodic-table: the ask as spoken (`askFor`, now exported).
  - habitat-diorama: the spoken choices.
  - matter-explorer: the mystery clues, and the everyday change for undo items.
  - states-of-matter: the starting state and temperature for phase-change items.
  - cause-effect-chain: the card asked about, the cards to order, or the choices.
  - era-explorer: the spoken menu.
  - push-pull-arena: the ask as spoken (`askFor`, now exported; compare items used to omit the second object).
  - ramp-lab: both recorded trials.
- **Student work.** push-pull-arena and calendar-explorer submitted none (`undefined`); they now submit the responses.
  knowledge-check submits per problem, so each problem's bridge gets its own items' responses. ramp-lab's explanation
  beat carries them on the investigation result, and `RampLab` submits the combined list.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck:lumina` | 0 |
| Phase D script, stage, reader-fit and Pip suites | 54 files / 748 tests pass |
| `HabitatDiorama.di-stage.test.tsx`, new and extended cases | a wrong connect records "Connected Snowshoe Hare to Oak Tree.", a restore records "Placed Shelf Fungus in the Ground layer zone.", no verdict words; the run's `learningResponses` reach the submitted student work |
| Verdict-word grep over the 11 files | nothing |
| Census | not applicable: none of the 11 is a declared observation source |
| Full vitest | 519 files passed, 3 skipped (6,580 tests) |

## Residual

- knowledge-check, periodic-table and cause-effect-chain gesture text is covered by typecheck, the existing suites and
  read-through only (habitat-diorama has the new stage test).
- **Phase E is now unblocked.** `diagnosisObservation` remains only in the contract field
  (`hooks/judgedScriptContract.ts`), the runner's legacy branch (`hooks/useJudgedScriptRunner.ts`), a docblock in
  `hooks/judgedRunEvidence.ts`, the census test fallback, and four runner-test packs. cvc-speller's
  `diagnosisObservationsRef` is its own `useJudgedSpeechLoop` ledger and stays.
