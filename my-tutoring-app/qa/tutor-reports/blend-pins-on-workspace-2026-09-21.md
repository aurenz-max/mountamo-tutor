# Blended pins run on the workspace; number-sequencer's scripted live branch is gone (LA-14 S3, slice 1)

Date: 2026-09-21 · Executor: `/add-live-tutor-tools`, evaluation path checked with `/student-data-loop`

## Why this slice, not deleting the drill

A caller audit found number-sequencer's scripted drill still live, contradicting the census:

- **Ordinary lessons.** They bound only a verbatim single-mode pin with one objective. The mode
  resolver emits `a|b` blends and `mixed` by design, so those sections ran the scripted drill.
- **Pulse, Practice and the Math tester** mount primitives with no runtime at all.
- **The sandbox's planned-lesson path** keeps blends verbatim. A blended item mounted the scripted
  drill *inside* a runtime, which is its legacy live branch: a second teaching controller.
- **The DI drive harness** (`DI_PORTS`, `--di`) scores the script.

## What changed

- **One shared rule** (`components/live-activity/pinnedModes.ts`): a pin binds the teaching
  workspace when every mode it names (`mixed` = every catalog mode) is one the family binds. The
  lesson plan, the content gate and `withTeachingWorkspace` all use it, so a section the plan binds
  is the section the component mounts on the workspace.
  - Six families bind every catalog mode: counting-board, number-sequencer, the three DI packs and
    letter-sound-link.
  - Shape Sorter binds `identify` only, so its blends stay scripted.
- **number-sequencer's scripted live branch is deleted:** `useNumberSequencerRuntime.ts`, the
  runtime wiring, completion cue and auto-start in the drill, the misstep-aid inventory only that
  hook used, and the test that exercised them.
  - The drill stays for its no-runtime callers.
- **Recording is unchanged, as ruled.** A submission carries one eval mode, and the evaluation
  boundary accepts only a single-mode pin.
  - A blended section files exactly as before: `default` for number-sequencer and
    letter-sound-link, the first challenge's mode for counting-board, the session `challengeType`
    for the DI packs.
  - The DI teaching metrics now report the session `challengeType`, as the scripted drill does. They
    had been reporting the resolved runtime mode, which for a blend would have opened a new IRT key.
  - Per-mode recording (your ruling: per item) is queued in the sunset handoff for
    `/student-data-loop`.
- **Harness:** `run_live_runtime.py` wrote the mode into the payload filename, and `|` is illegal
  on Windows. It now writes `+`.

## Checks

- `typecheck:lumina` 0.
- 4845 tests pass across live-activity, all primitives, QA and evaluation suites.
- New tests:
  - `withTeachingWorkspace.test.tsx`: blend, `mixed`, unbound-mode and no-runtime routing.
  - Lesson plan: blends bind, and a blend with an unbound mode does not.
  - `DiMathFacts.teaching.test.tsx`: a blended pin runs on the workspace and submits
    `evalMode: 'answer_fact'`.
- **Connected journeys:** 3/3 PASS, `--lesson-entry --audio`, with pin `count_from|before_after` on
  a payload mixing both challenge types (`number-sequencer-blend-pin-2026-09-21.json`).
  - Both item types were answered.
  - 6/6 demonstrations were visible.
  - Every run completed, with `progression: observer`.
  - Before this change, that pin mounted the scripted drill under the runtime.

## Remaining

- Corrected after this report: the DI packs' and letter-sound-link's scripted drills carry no live
  wiring, so there is nothing of theirs to delete. The next S3 slice is Pulse and Practice hosting
  the runtime ([handoff 12](../live-runtime-handoffs/12-pulse-practice-on-workspace.md)).
- Removal dependencies for the scripted drills themselves:
  - runtime hosting for Pulse, Practice and the testers;
  - multi-objective lesson sections, which need attribution per objective;
  - the DI drive harness.
- The backend was down when the first journey ran. It was restarted with the CLAUDE.md command.
