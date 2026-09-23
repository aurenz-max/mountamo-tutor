# compare-objects at W1 (workspace rollout, Tier A)

Date: 2026-09-22 · Executor: `/add-live-tutor-tools` · Handoff: [15](../live-runtime-handoffs/15-workspace-rollout.md)
Run in parallel with number-bond (another session); no shared-layer code changed.

## What changed

All four modes bind the shared tutor/JEV workspace in the live host and in ordinary lessons, on the
ten-frame recipe unchanged: controller swapped at the component boundary (`withWorkspaceController`),
catalog `teachingWorkspace`, `workspaceAdapter` + `compareObjectsLiveDomain`. The scripted runner is
never mounted on the workspace path and is unchanged elsewhere.

| Mode | Response | Checked by |
|---|---|---|
| `identify_attribute` | speech, key = attribute | observer, from tutor feedback |
| `compare_two` | speech, key = object name | observer |
| `non_standard` | speech, key = unit count | observer |
| `order_three` | touch order, key not published | the board (`orderMatches`), on stillness |

Withheld at W1: demonstrations, marks, `present`. Answer-leak holds kept: the unit numbers and the reward
paint only after a committed success (`revealHeld`).

Production code: `compareObjectsWorkspace.ts` (51 lines, new), `CompareObjects.tsx` (+~70), adapter (−9),
catalog (+9), journey row (+9). Test: `CompareObjects.workspace.test.tsx` (13 cases). Time: about 1 hour.

## Verification

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| full `tsc` | 770 (baseline 770) |
| compare-objects + ten-frame + counting-board + shape-sorter + live-activity suites | 392/392 |
| smoke `compare_two`, `--lesson-entry --progression-only`, text | PASS |
| smoke `compare_two`, same, `--audio` | PASS |
| smoke `order_three` (Grade 1), text | PASS ×3 |

The observer committed every transition; no learner press was needed. Raw evidence:
`compare-objects-w1-compare_two-2026-09-22.json`, `…-compare_two-audio-2026-09-22.json`,
`…-order_three-2026-09-22.json`, `…-order_three-2026-09-22-b.json`.
`identify_attribute` and `non_standard` are covered by the component test only (W1 needs one smoke per primitive).

## Findings

1. **Stage direction spoken as the opener, 1 of 3 order_three runs**: the tutor's first turn was
   "Silently waiting for the student to start." instead of the task. Not seen on compare_two or on
   ten-frame's gesture openers. Likely the retained catalog `tutoring.aiDirectives` ("ORDERING ITEMS ARE
   SILENT") reaching the lesson-entry session; not confirmed. Watch in batch A1; if it recurs, check
   whether workspace families still receive their scripted catalog directives (a shared question for every
   runner-era adopter, not a compare-objects fix).
2. **Catalog/code disagree on K order_three.** `constraints` says order-three came down to K on the
   2026-09-08 reader-fit re-audit; `K_KINDS` in `compareObjectsScript.ts` still drops it at K. Owner:
   `/eval-fix` (decide which is true). Not changed here.

Browser/microphone acceptance: HUMAN-CHECKS #167.
