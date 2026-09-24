# Put every answerable primitive on the teaching workspace (rollout kickoff)

Date: 2026-09-22 · Owner: roadmap LA-14 · Executor: `/add-live-tutor-tools` · Queue this creates:
`qa/workspace-rollout/ROLLOUT.md` (modelled on [`qa/pip-surface/ROLLOUT.md`](../pip-surface/ROLLOUT.md))

**Status 2026-09-22:** step 1 done (`3a78cb44`). Step 2 half done: **ten-frame at W1**, all seven modes,
smoke `build` and `subitize --audio` PASS ([report](../tutor-reports/ten-frame-w1-2026-09-22.md)).
Shape found: controller swapped at the component boundary (Counting Board's precedent), no Teaching copy.
**Simplified the same day:** shared `useWorkspaceRunner`, catalog `teachingWorkspace` + `workspaceAdapter`
(questions 1-3 answered for runner-era families), registry-driven renderers; all nine adopters moved.
**Number-bond at W1 2026-09-23** on the new recipe: ~75-line domain, +84/−30 component, ~5 minutes to clean
typecheck; smokes `ten_and_ones` + `missing_part --audio` PASS after one fix shared with ten-frame (no count
fact beside a spoken answer unless the board is what is asked) ([report](../tutor-reports/number-bond-w1-2026-09-23.md)).
**Steps 3-5 done 2026-09-23.** Recipe written into `/add-live-tutor-tools` ("W1 minimal binding") and
dry-run twice (a read-only plan, then a fresh session that built ordinal-line from it in ~6 minutes); queue
[`ROLLOUT.md`](../workspace-rollout/ROLLOUT.md) covers all 212 ids; batch A1 (place-value-chart, ordinal-line,
sorting-station) closed ([report](../tutor-reports/workspace-rollout-A1-2026-09-23.md)). The generic
one-file contract test is still owed (each adopter has its own workspace test). **DEAD row done; A2 done 09-23**
([report](../tutor-reports/workspace-rollout-A2-2026-09-23.md)): plain-shape recipe (`useWorkspaceProgress`), every live
adapter now on the workspace. **B1 done 09-23** ([report](../tutor-reports/workspace-rollout-B1-2026-09-23.md)): balance-scale, base-ten-blocks, bar-model,
fraction-circles, every mode (9 surfaces, the plain ones too); one ruling owed (balance-scale `two_step` explanation
is now scored). **Generic W1 contract test DONE 09-24** (`runtime/workspaceContract.test.tsx`, 21 families, 53 saved payloads). **B2 done 09-24** ([report](../tutor-reports/workspace-rollout-B2-2026-09-24.md)): cvc-speller, phonics-blender, sound-swap, word-flip, workspace only. **B3 done 09-24** ([report](../tutor-reports/workspace-rollout-B3-2026-09-24.md)): you-and-me, ramp-lab, di-shapes, spatial-scene. **C1 done 09-24** ([report](../tutor-reports/workspace-rollout-C1-2026-09-24.md)): syllable-clapper, rhyme-studio, phoneme-explorer, word-workout, workspace only. **Next: the cold-reconnect and silent-opening findings, then batch C2.**
**Parallel, 2026-09-22: compare-objects at W1** (Tier A), recipe unchanged, about 1 hour; smokes
`compare_two` text + `--audio` and `order_three` ×3 PASS ([report](../tutor-reports/compare-objects-w1-2026-09-22.md)).

## Why this slice

8 of about 212 catalog primitives are on the teaching workspace (counting-board, shape-sorter,
number-sequencer, letter-sound-link, the four DI packs). 9 more have a live adapter that still
runs the scripted runner (`teachingOwner: 'di-runner'`). The other ~195 have no tutor path.

Each adoption so far took about a day: domain extraction, a `*Teaching` component (74–232 lines),
an adapter (~55 lines), real-model probe cases in several domains, and connected `--audio`
journeys. The code per primitive is small; most of the time went into verification and
into repairing the shared framework while it was still changing. The framework is now stable:
one `WORKSPACE_DOCTRINE`, one observer criterion (LA-13 closed, [report](../tutor-reports/la13-crediting-criterion-2026-09-22.md)),
learner signals that come free with the binding, `withTeachingWorkspace` as the one mount switch.
At a day per primitive, the catalog takes most of a year.

**User direction (2026-09-22):** minimal wiring that just works on every answerable primitive,
tracked in a rollout queue like Pip's. Custom scaffolding comes afterwards, per primitive, and
only where dedicated testing shows it is needed.

## Two rungs

| Rung | What the primitive gets | What proves it |
|---|---|---|
| **W1: minimal binding** | The tutor is present and knows the task and the answer. The child answers through the primitive's own UI (checked gesture) or by speech against `expectedAnswer`. The observer commits outcomes. The runtime owns progression. **No tutor scene actions** (no demonstrate, mark or highlight); guidance is the doctrine plus a one-line task description. | One generic contract test that every W1 primitive runs, plus one runtime smoke drive per primitive (below) |
| **W2: custom scaffolding** | Domain scene facts, demonstration targets, per-domain guidance sentences, domain JEV and learner-intent cases, `--audio` journeys | Its own probe cases and connected journeys, as in the existing adoptions |

A primitive reaches W1 without W2. W2 is pulled per primitive by evidence from its W1 smoke
drive or a human sitting, not by default. The eight existing adopters are already W2.

## What the pilot must settle (step 2)

The minimal binding does not exist yet. Pilot it on **ten-frame**: it is a K math staple, it
already has a live adapter (`tenFrameLive.ts`, runner-owned), and it has both gesture modes
(`build`, `make_ten`) and spoken ones (`subitize`). The pilot answers these questions in code:

1. **The shape of a W1 binding.** The target is one hook call inside the primitive's existing
   component that publishes its items (`id`, `task`, `expectedAnswer`, `response`,
   `checkResponse`) and readiness, **with no separate `*Teaching` component and no domain
   extraction**. Where the existing component cannot express something (it advances on its
   own, or checks inside a click handler), change the component; do not fork a Teaching copy.
2. **One progression owner.** A primitive that advances itself (auto-advance timer, its own
   Next button, a completion screen) competes with the runtime. W1 must turn those off under a
   live runtime and use the shell's Try again / Next challenge (`LiveRuntimeSurface`, brief 10).
   Find the smallest general way to do that: a prop, a context flag, or a hook return value.
   It is the part most likely to differ across primitives, so it gets the most care.
3. **A generic adapter.** Build the adapter from the catalog entry and the generator's
   challenge shape (`validate`, `modes`, `copy`, `grades`) instead of hand-writing one per
   primitive. Keep a per-primitive adapter only where validation truly differs. The same
   applies to the smoke drive's `LIVE_JOURNEYS` row (`liveJourneySpec.ts`): derive its right
   and wrong inputs from the published items, not from a hand-written answer list.
4. **Time.** Record how long the ten-frame W1 binding took, and then a second primitive's.
   The rollout's pace depends on the second number.

Not in the pilot: demonstrations, scene facts beyond what the challenge already states, new
observation kinds, and changes to `WORKSPACE_DOCTRINE` or the observer criterion. If W1 exposes
a shared-layer defect, fix it once for every adopter (skill: Standing authority).

## W1 verification (what "just works" means, and all it needs)

- **Contract test (generic, one file).** For every W1 primitive, with generated or saved
  data: the item list builds, every item has a task and either `expectedAnswer` or
  `checkResponse`, the live packet carries the item and `learner` signals, and under a live
  runtime the primitive does not advance on its own.
- **Smoke drive (one per primitive).** One connected text run via `run_live_runtime.py
  --lesson-entry` on a saved payload: a wrong answer reopens the item, a right answer
  advances it, and the lesson completes. Add `--audio` only for a spoken mode.
- **Not required at W1:** per-domain JEV probe cases, learner-intent cases, three-run
  journeys, human sittings. Those belong to W2. Human sittings are sampled per batch
  (HUMAN-CHECKS #167), not per primitive.
- A W1 row fails when the smoke drive fails. Record the failure in the queue row, and fix it
  or move the row to W2 or BLOCKED. Do not widen W1 to make one primitive pass.

## Steps

1. **Ship first.** Commit the LA-13 slice (`/ship`) so the rollout starts from a clean tree.
2. **Pilot W1 on ten-frame**, all modes whose evidence the shared contract supports. Replace
   its runner-owned adapter. Pass: contract test, smoke drive on a gesture mode and on
   `subitize` (`--audio`), existing ten-frame tests, `typecheck:lumina` 0, full `tsc` not above
   baseline. Then do **one second primitive** (number-bond, also runner-owned) with the
   same recipe, unchanged, and record its time.
3. **Write the W1 recipe into the skill.** Add a short "W1 minimal binding" section to
   `/add-live-tutor-tools` (the hook call, the progression switch, the generic adapter, the
   two checks), and state in §5 that W1 needs only the contract test and the smoke drive.
   Dry-run the recipe in a fresh session (memory: verify skill docs by dry run).
4. **Build the queue**, `qa/workspace-rollout/ROLLOUT.md`, with Pip's layout: a Status block
   with a recount method (catalog ids in `service/manifest/catalog/*.ts` against components that
   bind the workspace), Done, Queue, and a batch recipe. Rows:
   - **Tier A:** the other 7 runner-owned live adapters: comparison-builder, compare-objects,
     number-line, number-tracer, ordinal-line, place-value, sorting-station.
   - **Tier B:** the remaining scripted-runner surfaces in [07-census.md](07-census.md):
     balance-scale (equality, workshop), base-ten-blocks DI modes, bar-model explanation,
     fraction-circles `touch_fraction`, spatial-scene, cvc-speller, phonics-blender, sound-swap,
     word-flip, you-and-me, di-shapes, ramp-lab investigation. Scripted-tutoring retirement
     needs these anyway.
   - **Tier C:** every other answerable primitive, in batches of 3–5 by theme, K–2 first.
     Pip's batch themes are a usable starting grouping.
   - **Held back, with the reason in the row:** display-only primitives with no answer check
     (Pip's PERCH list), open-ended or drawing modes that need an evidence contract,
     simulations with no evaluation hook (Pip's DECIDE list).
5. **Run batch A1** (3 primitives from Tier A) with the recipe, and close it in the queue.

## Exit

- Ten-frame and a second primitive at W1: contract test and smoke drives pass, times recorded.
- The W1 recipe in `/add-live-tutor-tools`, dry-run verified.
- `ROLLOUT.md` exists with every catalog primitive in a tier or a held-back row, and batch A1
  closed in it.
- `WORKSTREAMS.md` row and this README's "Next session" point at the queue's top open batch.

## Parked while the rollout runs (queued, not pulled)

From LA-13 ([report](../tutor-reports/la13-crediting-criterion-2026-09-22.md)): shape-sorter `sort`
mat wording, sentence reading's `incorrect` weight, crediting replies phrased as statements of fact.
These are W2 work on existing adopters. Pull one only if a W1 batch or a human sitting hits it.
