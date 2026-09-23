# Workspace rollout batch B1: balance-scale, base-ten-blocks, bar-model, fraction-circles at W1 (2026-09-23)

Queue: [ROLLOUT.md](../workspace-rollout/ROLLOUT.md) · Executor: `/add-live-tutor-tools`, "W1 minimal binding".
Commits: `5cfc5c52` bar-model, `21c70759` fraction-circles, `8c212c7a` balance-scale, `7a0ae9ce` base-ten-blocks.

## Scope was wider than the row

The row named the runner-era sub-surfaces (equality/workshop, the base-ten DI modes, the bar-model explanation,
`touch_fraction`). `workspaceAdapter` binds every catalog mode of a family (user ruling 09-20), so each family's
plain component moved too: 9 surfaces in all. Each family was built by a parallel agent in the same tree (no
commits, no drives), then gated, driven and committed serially.

| Primitive | Surfaces | Modes bound | Prod / test lines | Clean typecheck |
|---|---|---|---|---|
| bar-model | plain `BarModel` (the runner `BarModelExplanation` no longer mounts on the workspace) | all 12; `say_what_it_shows` and `compare_two_graphs` spoken with `expectedAnswer` | 341 / 212 | ~10 min |
| fraction-circles | plain + `FractionTouch` (R) + the mixed block chain | identify, build, compare, equivalent, `touch_fraction`; all gesture | 418 / 211 | ~11 min |
| balance-scale | `BalanceScaleEquality` (R), `BalanceScaleWorkshop` (R), plain solver | all 6 | 424 / 198 | ~10 min |
| base-ten-blocks | `BaseTenBlocksDi` (R) + plain mat | build_number, operate, read_blocks, regroup | 433 / 223 | ~11 min |

A family with more than one surface keeps its data router; each surface is its own `withWorkspaceController`
surface. fraction-circles' mixed chain runs one workspace session per block: block 0 takes the section's instance
id (`LessonWorkspaceBridge` introduces only that id), later blocks `-block-i` (a shared id makes the next block
read the previous block's completed runtime and settle at once).

## Smoke drives (`--lesson-entry --progression-only`, raw files beside this report)

| Drive | Result |
|---|---|
| bar-model `read_one_to_one` | PASS (`bar-model-w1-read_one_to_one-2026-09-23.json`) |
| bar-model `say_what_it_shows --audio` | FAIL ×2, then PASS (`…-audio-2026-09-23.json`, `-r2`, `-r3`) |
| fraction-circles `build` | PASS |
| balance-scale `equality --audio` | FAIL (harness), then PASS (`-r2`) |
| balance-scale `one_step` | PASS |
| base-ten-blocks `build_number` | PASS |
| base-ten-blocks `read_blocks --audio` | FAIL, then PASS (`-r2`) |

## Fixes

1. **bar-model's ask asked for more than its check.** "Tell me what this graph shows. Compare the groups" read
   to the observer as a whole-graph description, so a credited single comparison scored `correct` 0.39–0.65
   and abstained. The answer check always accepted one comparison. The generator's ask is now "Tell me one thing
   this graph shows: compare two groups, in your own words." Replayed against the real observer: 0.92–0.97
   `correct` on three crediting replies, twice; the wrong reply stays `incorrect` 0.94–0.98. The expected answer
   also says one comparison is the whole answer (that sentence alone reached only 0.72–0.81).
2. **base-ten's worth ask was plural over one block.** "What are those ten-sticks worth altogether?" over one
   ten-stick: "That's right, one ten-stick is worth ten" scored 0.43–0.58. A single block is now asked in the
   singular ("What is that ten-stick worth?"); 0.96–0.97, the correcting reply gets no credit (≤0.02). The
   rerun's mats had no single ten-stick, so the singular is covered by the probe and tests, not the drive.
   The leak scan's exempt span follows the noun's number.
3. **Harness: a hands step that cannot be wrong.** balance-scale commits a load only once it balances, so the
   row's "wrong" (an incomplete load) gave the tutor no turn and the drive timed out. The wrong learner now
   says "I think I am done." after the incomplete move; the tutor answered it with guidance, no verdict.
4. **Shared, additive:** `useWorkspaceProgress` gains optional `onSolved(index)`, so a plain primitive records
   a spoken item it has no check for (bar-model).

Gates after all fixes: `typecheck:lumina` 0, full `tsc` 770 (baseline), 2156/2156 tests across live-activity,
math primitives, pip and math services.

## Needs a user ruling

- **balance-scale `two_step` explanation is now scored.** On the runner it was unscored coaching; on the workspace
  its meaning sentence is the `expectedAnswer` and `teachingEvaluation` scores it like every item. Student-record
  semantics, so yours: keep it scored, or make an explain item ungraded. It also has no JEV case set yet.

## Queued findings

- **balance-scale plain solver, easy tier: side totals include x's value** (answer on screen). Pre-existing;
  reachable only from a hand-built mixed payload. `/eval-fix`.
- **fraction-circles `build`: after one wrong shade the tutor said the fix** ("shade just one of the two
  slices"). W2 on sight of a second instance; W1 guidance forbids saying the answer, not the correction.
- **`WorkspaceRun` has no `solvedIds`.** Runner-era surfaces that render `DiActionPanel` track committed items
  themselves (base-ten did it with local state from `onAffirmed`). di-shapes and the C6 DI packs will hit the
  same gap: add it once to the shared run. `/add-live-tutor-tools`.
- **Mixed fraction chain:** between blocks the tutor briefly receives a `completed` packet and the bridge text
  "If completed, let the learner use Next". Watch in a mixed drive; W2 if it wraps up early.

## Not covered

- A wrong `touch_fraction` answer (the two wrong pictures are random per mount); balance-scale's plain solver
  (mixed payloads only); base-ten wrong trade on a mat with one tradeable block, and decimal mats; bar-model
  `compare_two_graphs` and the other 10 bar-model modes, base-ten `regroup`/`operate`, balance-scale workshop
  modes other than `one_step`: component tests only.
- Browser and microphone acceptance: HUMAN-CHECKS #167.
- The generic W1 contract test is still owed. Four more per-primitive `*.workspace.test.tsx` files repeat the
  same harness (~200 lines each); build it before the next batch adds four more.
