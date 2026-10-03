# di-word-problem-setup levers: DI family 10 (2026-10-03)

`/add-support-tiers`, plan `qa/support-levers/di-lever-plan-2026-10-03.md` step 8, the last DI family. Table and failure inventory: `qa/support-levers/di-word-problem-setup-lever-table-2026-10-03.md`. No real-learner evidence: the misses are the placement check, the spoken-miss ids and the 09-10 signature bench.

## What was built

| Step | Help | Simplify |
|---|---|---|
| big_number (all modes) | `model_story`, `story_links` | none (an easier story hands over or contradicts the big status) |
| family | `model_story`, `read_along` | none |
| operation, classify | `model_story` | none |
| solve | `model_story`, `count_dots` | `within_ten` |

- **Pack-local plumbing:** this pack runs its own `useWorkspaceRunner`, so lever state (per step) and the practice item live in the component and are published as `levers`, `pullLever` and `endPractice` beside the scene. A practice story's earlier steps are drawn as given and never credited.
- **Model (R1):** an add story and a subtract story (classify_and_build: one of each kind, both operations), code-owned themes, none of the item's frame or amounts. The first version required each kind to keep a fixed operation, which left a part-whole "whole" item with no model; it now takes the first combination of kinds that has both operations.

**Size:** 190 lines of lever module and about 120 lines of component change, against 230 lines of new tests.

## Measured

| Gate | Result |
|---|---|
| Unit (`diWordProblemLevers.test.ts`, 15) | every frame on a grid within 20 has an add/subtract pair, leak-free; classify has three kinds and both operations; the model is stable across steps; sentence links; per-step lever sets; dots; `within_ten` rules; miss → lever; every catalog miss answered, every named miss listed |
| Mounted (`DiWordProblemSetup.levers.workspace.test.tsx`, 3) | easy model card (add and subtract) with none of the story's numbers, not a pull; a tapped card underlines one sentence; the read-along highlight steps; 20 dots, no text; `within_ten` practice ungraded with its family drawn as given, then the full step credited |
| Dry journey J1-J9 | 3/3 payloads |
| typecheck / suites | lumina 0; live-activity + DI + generators + lesson bench 3852 pass |
| Text replay (Flash, 3 payloads × 5) | 0 flags. The model is voiced as both stories (three on classify), each with its big amount and why |

## Not covered

- Not browser-checked (HUMAN-CHECKS #183, word-problem row). No Live run: this completes the DI levers, so the class Live gate (plan step 9) is next.
