# Number Sequencer ? DI modernization, 2026-09-11

Implemented in the working tree. Human microphone acceptance remains open (#150;
21?120 also rides the standing #63 acceptance). No new response class was added.

## Learning interaction

The number train is a good DI fit: naming a missing or out-of-sequence number is
spoken mathematical production. Arranging a set of cards remains actual page work.

| Existing mode | Current interaction | Judge material |
|---|---|---|
| count_from | One next number aloud per step, forward or backward | Code-derived next number |
| before_after | Say the adjacent missing number | One adjacent integer |
| fill_missing | Say each highlighted blank, in order | Independently checked arithmetic sequence |
| decade_fill | Say missing values across a decade | Independently checked consecutive sequence crossing a boundary |
| spot_error | Name the printed wrong number, without a positional highlight | Wrong printed value; correction contrasts its code-owned repair |
| order_cards | Arrange cards, remove/rearrange as needed; stillness submits | Exact ordered set, including wrong/incomplete attempts |

`numberSequencerModes.ts` projects existing mode IDs/calibration into catalog and
generator documentation. `numberSequencerScript.ts` owns content gates, item IDs,
questions, judgments, answer material and the drive adapter. The component uses
`useJudgedScriptRunner` and `DiActionPanel`; the tutor verdict advances it.

Generated titles/instructions never become an answer-leaking stage or spoken cue.
There are no typed numeric answers, local correctness feedback, Check or Next.
Numbers and dot counts in missing positions appear after affirmation. The affirmed
train stays visible until the next cue. No sorted reference solves ordering or
error detection. Whole problems are selected within an 18-item cap, with duplicate
windows/IDs dropped. Per-item evaluation preserves source challenge and modality.

## Verification

- Focused script, component, generator, and number-sequencer oracle suites: **57/57**.
- DI mode contract and action panel coverage was also run: **15/15** including the
  component suite at that point in development.
- Broad relevant math/DI components, hooks, generators and adapter suites:
  **1557 passed / 1 failed**. The failure is the concurrently edited
  `NumberBond.di-script.test.ts:423` assertion about catalog wording; no Number Bond
  files were changed by this slice.
- `typecheck:lumina`: **0 errors**. Full local TypeScript: baseline **770**, final
  **771**, with **no new source errors**. The additional error is generated
  `.next/types/app/api/lumina/eval-test/route.ts`, exposed after exercising that
  existing route; its unsupported exported helper predates this slice.
- Backend DI calibration suite: **2/2**.
- Nine **real** `/api/lumina/eval-test` draws: **27 source challenges / 60 judged
  items**, no item-builder drops or pack gate failures. Saved JSONs here cover all
  six modes, both grades, easy/medium/hard, a curated blend and mixed. Backward
  Grade-1 production includes 115 ? 114 ? 113 ? 112 ? 111 ? 110. The temporary
  probe was removed. Its first run misread the endpoint envelope (`data` instead
  of `fullData`); the corrected validation reused those exact fresh draws.
- Independent key validation found a pre-existing fixture mislabeled decade-fill:
  101?104 never crosses a decade. That fixture is now dropped; 108?111 and 117?120
  remain in the scope regression test.

## Actual Live tutor transcripts

Each drive used the real backend and Gemini Live, with intentional wrong answers
followed by correct answers. Input was text, so this proves semantics, not acoustics.
These are single sessions per scenario, not a three-run reliability estimate.

- [Spot-error signature drive](../tutor-reports/number-sequencer-live-di-signature-2026-09-11.md):
  **PASS**, 5/5 repairs refused as answers, 5/5 printed wrong numbers affirmed,
  zero findings. This verifies the error/repair distinction, not just number matching.
- [Ordering drive](../tutor-reports/number-sequencer-live-di-plain-2026-09-11.md):
  **PASS**, 5/5 wrong placements refused, 5/5 correct placements affirmed; the tutor
  stayed silent during all five hands holds. Zero findings.
- [Counting correction-cap drive](../tutor-reports/number-sequencer-live-di-plain-cap-2026-09-11.md):
  **PASS with warnings**, 14 spoken items. The first item refused three wrong
  answers and carried forward; all 13 subsequent wrong/right pairs were judged
  correctly. Zero HIGH findings. Repeated correction wording and the final
  re-ask being withdrawn at the cap are the family's existing item-30 warnings;
  they remain open and are not hidden as a clean pass.
- [Initial before/after drive](../tutor-reports/number-sequencer-live-di-before-after-preformat-2026-09-11.md):
  5/5 wrong refusals and 5/5 right affirmations. The harness initially mistook
  the ask for the correction because the verdict anchors lacked a colon. The
  cue format was fixed, a three-spoken-span regression was added, and all later
  drives used the corrected format. The archived warnings describe that old
  harness parsing issue, not an observed judgment failure.

## Remaining acceptance

[HUMAN-CHECKS #150](../HUMAN-CHECKS.md) owns the actual child microphone, fast and
hesitant answers, one-number-at-a-time pacing, stop/resume, and tablet stillness
checks. Numbers over twenty remain accepted-build-ahead under #63. Cap wording
remains with DI backlog item 30. No claim of live acoustic or full-browser
acceptance is made. The change is uncommitted; existing Balance Scale and Number
Bond work remains separate.
