# buoyancy-harbor levers (2026-10-29, `/add-support-tiers`, SB-3)

There is no real-learner evidence yet. Every miss below is either what `dropTestMiss` or `boatMiss` observes on screen,
or the documented misconception that big things sink and small things float.

## Lever table

All levers are declared once on the boss (`buoyancyLevers.ts` → `HARBOR_LEVERS` on `buoyancyHarbor.boss.ts`), and the
card sets `levers: true`. The table lists two failures per mode; the third miss in each mode is answered by levers
already in the table.

| Mode | Failure (class) | Lever (type) | Carrier | Leak rule |
|---|---|---|---|---|
| both | decides by size; does not see why a boat sinks (documented + observed miss) | `xray` (marks): red arrow down = weight, blue arrow up = the water's push, as long as push / weight | shown | Only on things already in the water; the mystery is never in the tank before a right call |
| drop_test | picks a test made of other stuff as evidence (`other_thing`, observed miss) | `material_tags` (legend): a coloured tag with the material's word over all three things alike | shown + voiced | Names every thing alike, none marked |
| drop_test | judges by size (`judged_by_size`, documented) | `side_by_side` (model): a small and a big thing of one other stuff, dropped at the back of the tank | shown | Never the item's stuff (`pairLeaks`) |
| build_boat | lump or flat piece (`sinks_empty`, `no_sides`, observed miss) | `solved_boat` (model): a lump that sinks and the same stuff with sides floating with a few pennies | shown | A model never carries the item's goal from the item's stuff (`modelBoatLeaks`) |
| both | cannot do the item (all misses) | `one_step_less` (easier) | both | drop: an easy test with none of the item's things or stuff; boat: half the pennies (`practiceLeaks`) |

## Behaviour

- Which lever comes after each miss:

  | Miss | First lever | Second lever |
  |---|---|---|
  | `judged_by_size`, `wrong_call` | xray | side_by_side |
  | `other_thing` | material_tags | one_step_less |
  | `sinks_empty`, `no_sides` | xray (while the boat is in the water), else solved_boat | solved_boat |
  | `too_small` | xray | one_step_less |

- Support tier: when a model lever comes follows `supportFact`, which the lever set writes. At easy, `xray` starts
  drawn (`startLevers`). A tier's starting lever is not a pull, so nothing is recorded as help.
- A practice item is never scored (`recordPass` skips it). A lever pull is recorded on the next attempt
  (`attempt.levers`).

## Verification

- `buoyancyLevers.test.ts`: 16 tests.
  - The levers offered per mode and per screen state.
  - The miss → lever table.
  - Every leak rule, checked over 180 generated drop tests and 144 generated boats.
- `BuoyancyHarbor.workspace.test.tsx`: 3 new mounted tests.
  - A pull changes the scene and the scene facts in one commit.
  - The attempt records `['xray', 'side_by_side']`.
  - The mystery's result is never in the facts.
  - The easier drop test is practice on a fresh pier; solving it brings back `drop-1`.
  - The boat levers, including the easier boat with 3 pennies (half of 6).
- Gates:
  - `test:primitive buoyancy-harbor`: 723 pass, including `boss.test.ts` (levers in a set, every miss answered).
  - `typecheck:lumina`: 0.
  - Full tsc: 770, down from 771.
- Browser: `buoyancy-harbor-drive-2026-10-29/drive-levers.mjs` passed 13/13 in the tester's offline lever bench, with
  screenshots in `levers-g1/`.
  - Each lever is pulled from the bench and draws in the 3D tank.
  - X-ray is not offered before a test is in the water.
  - The easier test shows the Practice tag.
- Fixed during the drive: the model boats sat outside the boat camera's frame. They moved to x ±2.8 and the camera
  pulled back.
- Model spend: $0. No Live run and no tutor replay; the user runs those.

## Not built / owed

- `replay` (custom, a slow-motion replay of the last drop) is deferred. The x-ray arrows show the same forces on the
  thing at rest; build replay if a sitting shows it is needed.
- The tutor gate: tutor replay of the lever moments (paid, the user's) —
  `tutor_replay.py --primitive buoyancy-harbor --samples 5`, after the dry journey writes its moments. It answers
  whether the tutor names the arrows' meaning without saying the mystery's result.
- `docs/contracts/buoyancy-harbor.md` does not exist yet (`/primitive-contract`).
- `/review-live-wiring buoyancy-harbor` (read-only), then SB-0 `/curriculum-fit`.
