# Workspace rollout B3: you-and-me, ramp-lab, di-shapes, spatial-scene (2026-09-24)

Queue: [`qa/workspace-rollout/ROLLOUT.md`](../workspace-rollout/ROLLOUT.md) row B3. Executor: `/add-live-tutor-tools`.

## What shipped

All four families run only on the teaching workspace, every catalog mode bound (one-path ruling
09-23). Each had a different shape:

| Primitive | Commit | Shape moved | Production (+/−) |
| --- | --- | --- | --- |
| you-and-me | `98b2838a` | runner-era (R) → `useWorkspaceRunner`; one spoken sentence per turn, judged on the subject pronoun from the speaking role | +174 / −48 |
| ramp-lab | `ad1c5a26` | plain lab (own index + Check/Next) with a nested judged runner → `useWorkspaceRunner`; free exploration stays an ungraded sandbox | +320 / −111 |
| di-shapes | `1c319412` | speech loop → `DiTeachingStage` like the other spoken DI packs | +153 / −849 |
| spatial-scene | `a35c66f7` | plain (`useChallengeProgress`) + nested runner → `useWorkspaceProgress` | +259 / −246 |

Total production: +906 / −1,254. Each family's key properties carried over and are now tested on
the workspace: you-and-me never names the pronoun before a real attempt (tightened after the first
smoke opened with "starting your sentence with I"); ramp-lab keeps a rejected plan in the record,
locks a fair plan and does not await the spoken explanation until both trials are recorded (contract);
di-shapes never names a shape on a counting item; spatial-scene judges the spoken scene on relation
and reference (R16) and checks each direction step.

## Found and fixed in the batch

- **An extra revision after an advance stalls credit** (ramp-lab first smoke): a scene fact read from
  controls that the lab resets in an effect after an item opens superseded the advance's visible receipt.
  Fixed by deriving every fact during render and scoping it to its item. spatial-scene's step fact got the
  same treatment before its smoke. This is the comparison-builder lesson from A2, now hit twice.
- **Test runs that missed folders**: the B2 cvc-speller change broke `DiLessonIsolation.test.tsx`
  (direct-instruction) and the B3 you-and-me change broke `youAndMeScaffold.test.ts` (service/qa); both
  re-based, and B3 closed on two full-suite runs (7,469 and 7,482 passed).
- `withWorkspaceOnly` does not suit a family with an ungraded mode: ramp-lab picks the controller per
  mount (`useSandboxRun` for free exploration).

## Smoke drives (`--lesson-entry --progression-only`)

| Row | Result | Raw file |
| --- | --- | --- |
| you-and-me describe_action text | PASS (after the guidance fix) | `you-and-me-w1-describe_action-text-2026-09-24-r2.json` |
| you-and-me describe_action `--audio` | PASS | `you-and-me-w1-describe_action-audio-2026-09-24-r2.json` |
| ramp-lab compare_conditions text | PASS (third run) | `ramp-lab-w1-compare_conditions-text-2026-09-24-r3.json` |
| ramp-lab explain_from_trials `--audio` | PASS (one credit resolved by the plain-verdict request) | `ramp-lab-w1-explain_from_trials-audio-2026-09-24-r2.json` |
| di-shapes name_shape text | PASS | `di-shapes-w1-name_shape-text-2026-09-24.json` |
| di-shapes count_sides `--audio` | PASS | `di-shapes-w1-count_sides-audio-2026-09-24.json` |
| spatial-scene identify text | PASS | `spatial-scene-w1-identify-text-2026-09-24.json` |
| spatial-scene describe_scene `--audio` | PASS | `spatial-scene-w1-describe_scene-audio-2026-09-24.json` |

Undriven at W1: ramp-lab `find_threshold`, `design_with_budget` and `plan_fair_test` use a slider or
select the driver cannot set (their journey row throws with the mode name). Their checks are covered in
`RampLab.workspace.test.tsx`.

Failed runs, kept: you-and-me audio r1 and ramp-lab compare r2 hit a real Gemini `1011` whose resume also
failed; the backend reconnected cold and the tutor went silent until timeout. With B2's occurrence that is
**three times today**. ramp-lab compare r1 was the superseded-advance defect above.

## Gates

`typecheck:lumina` 0; full `tsc` 770 outside the concurrent adaptation-investigator session's files; full
frontend suite 7,482 passed. The generic W1 contract test now covers 25 + 4 families.

## Owed

- **Cold reconnect after a failed resume goes silent** (backend `lumina_tutor.py`): no `session_resumed`,
  no steering, a fresh model session with no lesson context. Three occurrences today. A child sees a
  stalled lesson. Executor `/add-live-tutor-tools` (backend transport), reproducible with
  `LUMINA_FAULT_DROP_S` on a separate backend.
- di-shapes: Pip, response timing and the misconception packet, owed on `DiTeachingStage` with the other
  packs (`/add-pip-surface`, `/add-misconception-loop`).
- Human sitting (mic, K voice) remains HUMAN-CHECKS #167.
