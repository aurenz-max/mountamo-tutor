# push-pull-arena: in-item levers (2026-10-08 class sweep)

`/add-support-tiers` on observe, predict, compare, design. Phase 2 confirmation was waived for the sweep. No contract doc exists for this primitive (`docs/contracts/push-pull-arena.md` absent); the binding test and DI script tests were the guard.

## Failure inventory

| Mode | Failure (miss id) | Evidence class |
|---|---|---|
| observe | gives the other force word (`opposite_force`) | observed-synthetic (DI drives 08-16 plain wrong; journey plainWrong) |
| observe | describes the motion, no force word (`described_motion`) | observed-synthetic (DI signature wrong "it went that way") + documented (catalog struggles) |
| predict | gives the other outcome (`opposite_outcome`) | observed-synthetic (journey plainWrong) |
| compare | names the heavier object (`other_object`) | observed-synthetic (DI signature wrong) + documented ("heavier slides farther" misconception in the script) |
| design | gives the other push size (`opposite_size`) | observed-synthetic (journey plainWrong) |

No real-learner evidence: no demonstrations log entry, no misconception or remediation module. All misses are spoken and already in the catalog `misses` map.

Content defect fixed first (it corrupted design evidence): the generator's design branch replaces the LLM's object and surface but kept the LLM's `goalDescription`, so the goal named another object and carried answer adjectives ("Move the Backpack" on a Barrel item, "Push the heavy Refrigerator" on a Rock item; fresh payload 10-09). `gemini-push-pull-arena.ts` now writes it in code. Re-generated payload: every goal names its own object and surface, no adjectives.

## Lever table

| Mode | Failure | Lever | Kind | Carrier | Leak rule |
|---|---|---|---|---|---|
| observe | opposite_force, described_motion | `mark_the_hand`: a hand at the arena's left edge, where the force comes from | help | shown | identical picture on push and pull items; fact names neither word |
| observe | same | `push_pull_model`: hand + cart going away (push), hand + sled coming closer (pull) | help | both | both words always together; never the item's object; `does` forbids saying which way the learner's object went |
| predict | opposite_outcome | `show_the_setup`: weight blocks, grip bumps, the coming push as marks | help | shown | never says moves/stays; nothing runs |
| compare | other_object | `show_the_setup`: weight blocks under both objects | help | shown | names both objects or neither; no comparative beside an item object |
| compare | other_object | `same_push_model`: balloon (1 block, long track) and piano (10 blocks, short track) | help | both | off-session objects; `does` forbids saying which of the learner's objects goes farther |
| design | opposite_size | `show_the_setup`: weight blocks and grip bumps | help | shown | no big/little, no weight or grip adjective |
| predict, design | same | `easier_item`: an extreme setup on another surface (1 kg on ice, or 10 kg on carpet) | simplify | shown | off-session objects, not the item's surface, decisive by the item gate |
| compare | other_object | `easier_item`: 1 kg against 10 kg on the item's surface | simplify | shown | off-session objects; not offered when the item's gap is already 7 kg or more |

Per item: every item of every mode has at least one help lever for its miss, so no miss is left unanswered (J12 holds without baseline). Gaps by item:
- observe has no simplify lever on any item: one object and one force is already the plainest shape.
- compare items with a weight gap of 7 kg or more (payload c2: 2 vs 9) have no simplify lever, since the far-apart pair would be no simpler. Both help levers still apply.
- predict and design practice outcomes follow the surface rule (off ice gives a "moves"/"little" practice item, on ice gives "stays"/"big"), so on design wood items the practice answer matches the item's answer. It is a different object on a different surface. Recorded here; not a leak by the code rule.

## Built

- `physics/pushPullArenaLevers.ts`: lever declarations, `arenaPracticeItem` builder, `practiceLeak`, `leverTextLeaks`, the scene fact `arenaLeversOnScreen`.
- `PushPullArena.tsx`: lever and practice state keyed by item, synchronous `pullLever`/`endPractice`, `onPracticeClosed` puts the full item back in the arena, lever pictures as DOM (`data-lever=hand|force-model|setup|weight-blocks|grip|push-marks|same-push-model`).
- Catalog `teachingWorkspace.levers: true`; journey row rebuilds `~simpler` items from the parent with the same builder.
- New saved payloads `push-pull-arena.compare.json`, `push-pull-arena.design.json` (one generation each); baseline J11 entries for them match observe/predict (handoff 19 slice 9a ruling).
- `journeySweep.test.tsx`: ResizeObserver stub (the design force slider threw J1 in jsdom).
- Not done: Phase 6 starting positions from `config.difficulty` (the existing tier still only toggles force arrows and motion readout).

## Tests

- `pushPullArenaLevers.test.ts`: leak rule over every lever text and fact on all four saved payloads; leak rule positive and negative cases; builder over 300 random items per mode (same mode, decisive, off-session, other surface, 9 kg gap, answer recomputed from physics, never the parent); easier item offered on all predict and design payload items and on 3 of 4 compare items; miss → `nextLever` table.
- `PushPullArena.levers.workspace.test.tsx`: the hand appears in the same commit as its fact, identical on a pull and a push item; refused pulls change nothing (screen, levers, attempts, demand); the next attempt records the lever; compare blocks and model; predict practice item `p1~simpler` is ungraded, on other things, and the full item comes back and is credited with `[show_the_setup, easier_item]`.
- physics folder: 68/68. Catalog misses, activityContract and lessonWorkspacePlan: 197/197. Journey sweep filtered to push-pull-arena (4 payloads): 4/4 against baseline. `typecheck:lumina`: 0.
- Not run: the full sweep, tutor replay, any Live run (batch verify).
